import { getAdoClient, output, fatal, parseFlags } from "./helpers.js";
import { getWorkItemStorage } from "../storage/index.js";
import { loadConfig, resolveStoragePath, ensureProjectGitignore } from "../storage/config.js";
import { SyncStateManager } from "../services/sync/state.js";
import { SyncEngine, type SyncResult } from "../services/sync/engine.js";

export async function handleSync(args: string[]): Promise<void> {
  const action = args[0];
  if (!action || !["pull", "push", "full"].includes(action)) {
    fatal("Usage: sync <pull|push|full> [--ids=1,2,3] [--query=<wiql>] [--mine] [--all]");
  }

  const flags = parseFlags(args.slice(1));
  const ids = flags.ids
    ? flags.ids.split(",").map((s) => parseInt(s.trim(), 10))
    : undefined;
  const mine = flags.mine !== undefined;
  const all = flags.all !== undefined;

  if (mine && flags.query) {
    fatal("Cannot use --mine and --query together. Use one or the other.");
  }
  if (all && (mine || flags.query)) {
    fatal("Cannot use --all with --mine or --query.");
  }

  const needsQuery = action === "pull" || action === "full";
  const useMyItems = mine || (needsQuery && !flags.query && !ids && !all);
  const query = all
    ? buildMyAllItemsQuery()
    : useMyItems
      ? buildMyActiveItemsQuery()
      : flags.query;

  const engine = await createSyncEngine();

  let result: SyncResult;

  switch (action) {
    case "pull":
      result = await engine.pullFromAdo({ query, ids, pushFirst: true });
      break;
    case "push":
      result = await engine.pushToAdo({ ids });
      break;
    case "full":
      result = await engine.fullSync(query!);
      break;
    default:
      fatal(`Unknown sync action: ${action}`);
  }

  output({
    operation: action,
    pulled: result.pulled,
    pushed: result.pushed,
    conflicts: result.conflicts,
    errors: result.errors,
  });
}

async function createSyncEngine(): Promise<SyncEngine> {
  const config = await loadConfig();
  await ensureProjectGitignore();
  const client = await getAdoClient(config);
  const storage = await getWorkItemStorage(config);
  const stateManager = new SyncStateManager(
    resolveStoragePath(config.storage.basePath),
    config.azure_devops.organization,
    config.azure_devops.project,
  );
  return new SyncEngine(client, storage, stateManager);
}

function buildMyActiveItemsQuery(): string {
  return [
    "SELECT [System.Id] FROM WorkItems",
    "WHERE [System.AssignedTo] = @me",
    "  AND [System.State] <> 'Closed'",
    "  AND [System.State] <> 'Removed'",
    "  AND [System.State] <> 'Completed'",
    "  AND [System.State] <> 'Done'",
    "ORDER BY [System.ChangedDate] DESC",
  ].join(" ");
}

function buildMyAllItemsQuery(): string {
  return [
    "SELECT [System.Id] FROM WorkItems",
    "WHERE [System.AssignedTo] = @me",
    "ORDER BY [System.ChangedDate] DESC",
  ].join(" ");
}
