import type { AdoClient } from "../ado/client.js";
import type { AdoWorkItem } from "../ado/types.js";
import type { WorkItemStorage } from "../../storage/work-items.js";
import type { LocalWorkItemOutput } from "../../schemas/work-item.schema.js";
import type { SyncItemState } from "../../schemas/sync-state.schema.js";
import { SyncStateManager } from "./state.js";
import { adoToLocal, serializeForHash, localToAdoPatch } from "./mapper.js";
import { SyncError } from "../../utils/errors.js";
import { logger } from "../../utils/logger.js";

export interface SyncResult {
  pulled: number;
  pushed: number;
  conflicts: number;
  errors: string[];
}

export interface PullOptions {
  query?: string;
  ids?: number[];
  pushFirst?: boolean;
}

export interface PushOptions {
  ids?: number[];
}

export class SyncEngine {
  constructor(
    private client: AdoClient,
    private storage: WorkItemStorage,
    private stateManager: SyncStateManager,
  ) {}

  /**
   * Pull work items from ADO to local storage.
   */
  async pullFromAdo(options: PullOptions = {}): Promise<SyncResult> {
    const result: SyncResult = { pulled: 0, pushed: 0, conflicts: 0, errors: [] };

    // Push locally modified items first to avoid overwriting local edits
    if (options.pushFirst) {
      const modified = await this.detectLocalChanges();
      if (modified > 0) {
        const pushResult = await this.pushToAdo();
        result.pushed = pushResult.pushed;
        result.conflicts = pushResult.conflicts;
        result.errors.push(...pushResult.errors);
      }
    }

    let adoItems: AdoWorkItem[];

    if (options.ids && options.ids.length > 0) {
      // Fetch specific IDs
      adoItems = [];
      for (const id of options.ids) {
        try {
          const item = await this.client.getWorkItem(id, "relations");
          adoItems.push(item);
        } catch (err) {
          const msg = `Failed to fetch work item #${id}: ${err}`;
          result.errors.push(msg);
          logger.warn(msg);
        }
      }
    } else if (options.query) {
      // Run WIQL query
      adoItems = await this.client.queryWorkItems(options.query);
      // Re-fetch with relations since query only returns basic fields
      const detailed: AdoWorkItem[] = [];
      for (const item of adoItems) {
        try {
          detailed.push(await this.client.getWorkItem(item.id, "relations"));
        } catch (err) {
          result.errors.push(`Failed to fetch details for #${item.id}: ${err}`);
        }
      }
      adoItems = detailed;
    } else {
      throw new SyncError(
        "Pull requires either specific IDs or a WIQL query.",
      );
    }

    for (const adoItem of adoItems) {
      try {
        const localItem = adoToLocal(adoItem);
        const yamlContent = serializeForHash(localItem);
        const hash = SyncStateManager.computeHash(yamlContent);

        // Check existing state
        const existing = await this.stateManager.getItemState(adoItem.id);

        if (existing && existing.adoRev === adoItem.rev) {
          // Same revision, check if locally modified
          if (existing.localHash !== hash && existing.syncStatus !== "localModified") {
            // No change needed
            continue;
          }
        }

        // Save locally
        const filePath = await this.storage.save(localItem);

        // Recompute hash from what was actually saved
        const savedHash = SyncStateManager.computeHash(
          serializeForHash(localItem),
        );

        // Update sync state
        await this.stateManager.setItemState(adoItem.id, {
          localPath: filePath,
          adoRev: adoItem.rev,
          localHash: savedHash,
          lastSyncedAt: new Date().toISOString(),
          syncStatus: "synced",
        });

        result.pulled++;
        logger.debug({ id: adoItem.id, rev: adoItem.rev }, "Pulled work item");
      } catch (err) {
        const msg = `Failed to save work item #${adoItem.id}: ${err}`;
        result.errors.push(msg);
        logger.error(msg);
      }
    }

    await this.stateManager.save();
    logger.info(
      { pulled: result.pulled, errors: result.errors.length },
      "Pull completed",
    );
    return result;
  }

  /**
   * Push locally modified work items back to ADO.
   */
  async pushToAdo(options: PushOptions = {}): Promise<SyncResult> {
    const result: SyncResult = { pulled: 0, pushed: 0, conflicts: 0, errors: [] };
    const allStates = await this.stateManager.getAllItemStates();

    const idsToProcess = options.ids
      ? options.ids
      : Array.from(allStates.entries())
          .filter(([_, state]) => state.syncStatus === "localModified")
          .map(([id]) => id);

    if (idsToProcess.length === 0) {
      logger.info("No locally modified work items to push");
      return result;
    }

    for (const id of idsToProcess) {
      try {
        // Load current local file
        const localItem = await this.storage.loadById(id);
        if (!localItem) {
          result.errors.push(`Local file for #${id} not found`);
          continue;
        }

        const existingState = await this.stateManager.getItemState(id);

        // Check if remote has been updated since last sync
        let remoteItem: AdoWorkItem;
        try {
          remoteItem = await this.client.getWorkItem(id, "relations");
        } catch {
          result.errors.push(`Cannot fetch remote state for #${id}`);
          continue;
        }

        if (existingState && remoteItem.rev > existingState.adoRev) {
          // Remote changed since our last sync — conflict
          await this.stateManager.setItemState(id, {
            ...existingState,
            syncStatus: "conflict",
          });
          result.conflicts++;
          result.errors.push(
            `Conflict on #${id}: remote rev ${remoteItem.rev} > synced rev ${existingState.adoRev}`,
          );
          continue;
        }

        // Compute diff against what we last synced (use remote as baseline)
        const baseline = adoToLocal(remoteItem);
        const patchOps = localToAdoPatch(localItem, baseline);

        if (patchOps.length === 0) {
          // No meaningful changes
          if (existingState) {
            await this.stateManager.setItemState(id, {
              ...existingState,
              syncStatus: "synced",
            });
          }
          continue;
        }

        // Push to ADO
        const updated = await this.client.updateWorkItem({
          id,
          title: localItem.title !== baseline.title ? localItem.title : undefined,
          description:
            localItem.description !== baseline.description
              ? localItem.description
              : undefined,
          state: localItem.state !== baseline.state ? localItem.state : undefined,
          assignedTo:
            localItem.assignedTo !== baseline.assignedTo
              ? localItem.assignedTo
              : undefined,
          areaPath:
            localItem.areaPath !== baseline.areaPath
              ? localItem.areaPath
              : undefined,
          iterationPath:
            localItem.iterationPath !== baseline.iterationPath
              ? localItem.iterationPath
              : undefined,
          priority:
            localItem.priority !== baseline.priority
              ? localItem.priority
              : undefined,
          storyPoints:
            localItem.storyPoints !== baseline.storyPoints
              ? localItem.storyPoints
              : undefined,
        });

        // Re-save with updated rev
        const updatedLocal = adoToLocal(updated);
        const filePath = await this.storage.save(updatedLocal);
        const newHash = SyncStateManager.computeHash(
          serializeForHash(updatedLocal),
        );

        await this.stateManager.setItemState(id, {
          localPath: filePath,
          adoRev: updated.rev,
          localHash: newHash,
          lastSyncedAt: new Date().toISOString(),
          syncStatus: "synced",
        });

        result.pushed++;
        logger.debug({ id, newRev: updated.rev }, "Pushed work item");
      } catch (err) {
        const msg = `Failed to push work item #${id}: ${err}`;
        result.errors.push(msg);
        logger.error(msg);
      }
    }

    await this.stateManager.save();
    logger.info(
      { pushed: result.pushed, conflicts: result.conflicts },
      "Push completed",
    );
    return result;
  }

  /**
   * Full bidirectional sync: pull, detect local changes, resolve conflicts, push.
   */
  async fullSync(query: string): Promise<SyncResult> {
    // Pull (with push-first) handles: detect local changes → push → pull
    const result = await this.pullFromAdo({ query, pushFirst: true });

    // Push any remaining local-only items that weren't covered by the pull query
    const pushResult = await this.pushToAdo();
    result.pushed += pushResult.pushed;
    result.conflicts += pushResult.conflicts;
    result.errors.push(...pushResult.errors);

    // Update full sync timestamp
    await this.stateManager.setLastFullSync(new Date().toISOString());
    await this.stateManager.save();

    logger.info(result, "Full sync completed");
    return result;
  }

  /**
   * Scan local files and mark any that have changed since last sync.
   */
  async detectLocalChanges(): Promise<number> {
    const allStates = await this.stateManager.getAllItemStates();
    let modified = 0;

    for (const [id, itemState] of allStates) {
      if (itemState.syncStatus === "conflict") continue;

      try {
        const localItem = await this.storage.loadById(id);
        if (!localItem) continue;

        const currentHash = SyncStateManager.computeHash(
          serializeForHash(localItem),
        );

        if (currentHash !== itemState.localHash) {
          await this.stateManager.setItemState(id, {
            ...itemState,
            syncStatus: "localModified",
          });
          modified++;
          logger.debug({ id }, "Detected local modification");
        }
      } catch {
        // File might have been deleted
      }
    }

    if (modified > 0) {
      await this.stateManager.save();
    }
    return modified;
  }
}
