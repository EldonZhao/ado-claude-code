import * as fs from "node:fs/promises";
import * as path from "node:path";
import * as crypto from "node:crypto";
import {
  SyncStateSchema,
  type SyncItemState,
  type SyncStateOutput,
} from "../../schemas/sync-state.schema.js";
import { SyncError } from "../../utils/errors.js";
import { logger } from "../../utils/logger.js";

export class SyncStateManager {
  private state: SyncStateOutput | null = null;
  private statePath: string;

  constructor(
    private basePath: string,
    private organization: string,
    private project: string,
  ) {
    this.statePath = path.join(basePath, ".ado-sync", "state.json");
  }

  async load(): Promise<SyncStateOutput> {
    if (this.state) return this.state;

    try {
      const raw = await fs.readFile(this.statePath, "utf-8");
      const parsed = JSON.parse(raw);
      const result = SyncStateSchema.safeParse(parsed);
      if (!result.success) {
        logger.warn("Corrupt sync state file, reinitializing");
        this.state = this.createEmpty();
      } else {
        this.state = result.data;
      }
    } catch {
      this.state = this.createEmpty();
    }

    return this.state;
  }

  async save(): Promise<void> {
    if (!this.state) return;
    const dir = path.dirname(this.statePath);
    await fs.mkdir(dir, { recursive: true });
    await fs.writeFile(
      this.statePath,
      JSON.stringify(this.state, null, 2),
      "utf-8",
    );
    logger.debug("Sync state saved");
  }

  private createEmpty(): SyncStateOutput {
    return {
      version: "1.0",
      lastFullSync: null,
      project: this.project,
      organization: this.organization,
      workItems: {},
    };
  }

  async getItemState(id: number): Promise<SyncItemState | null> {
    const state = await this.load();
    return state.workItems[String(id)] ?? null;
  }

  async setItemState(
    id: number,
    itemState: SyncItemState,
  ): Promise<void> {
    const state = await this.load();
    state.workItems[String(id)] = itemState;
  }

  async removeItemState(id: number): Promise<void> {
    const state = await this.load();
    delete state.workItems[String(id)];
  }

  async setLastFullSync(timestamp: string): Promise<void> {
    const state = await this.load();
    state.lastFullSync = timestamp;
  }

  async getAllItemStates(): Promise<
    Map<number, SyncItemState>
  > {
    const state = await this.load();
    const map = new Map<number, SyncItemState>();
    for (const [key, value] of Object.entries(state.workItems)) {
      map.set(parseInt(key, 10), value);
    }
    return map;
  }

  static computeHash(content: string): string {
    return crypto.createHash("sha256").update(content).digest("hex");
  }
}
