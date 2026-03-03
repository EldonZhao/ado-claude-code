import { getAdoClient, output, fatal, parseFlags } from "./helpers.js";
import { getWorkItemStorage } from "../storage/index.js";
import { loadConfig } from "../storage/config.js";
import { SyncStateManager } from "../services/sync/state.js";
import { SyncEngine, type SyncResult } from "../services/sync/engine.js";

export async function handleSync(args: string[]): Promise<void> {
  const action = args[0];
  if (!action || !["pull", "push", "full"].includes(action)) {
    fatal("Usage: sync <pull|push|full> [--ids=1,2,3] [--query=<wiql>]");
  }

  const flags = parseFlags(args.slice(1));
  const ids = flags.ids
    ? flags.ids.split(",").map((s) => parseInt(s.trim(), 10))
    : undefined;
  const query = flags.query;

  const engine = await createSyncEngine();

  let result: SyncResult;

  switch (action) {
    case "pull":
      result = await engine.pullFromAdo({ query, ids });
      break;
    case "push":
      result = await engine.pushToAdo({ ids });
      break;
    case "full":
      if (!query) {
        fatal("Full sync requires --query=<wiql> to determine which items to pull.");
      }
      result = await engine.fullSync(query);
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
  const client = await getAdoClient(config);
  const storage = await getWorkItemStorage(config);
  const stateManager = new SyncStateManager(
    config.storage.basePath,
    config.azure_devops.organization,
    config.azure_devops.project,
  );
  return new SyncEngine(client, storage, stateManager);
}
