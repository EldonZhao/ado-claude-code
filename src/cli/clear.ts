import * as fs from "node:fs/promises";
import { output, fatal, parseFlags } from "./helpers.js";
import { loadConfig } from "../storage/config.js";
import { getWorkItemStorage } from "../storage/index.js";
import { SyncStateManager } from "../services/sync/state.js";
import { SyncEngine } from "../services/sync/engine.js";
import { getAdoClient } from "./helpers.js";

export async function handleClear(args: string[]): Promise<void> {
  const flags = parseFlags(args);
  const confirm = flags.confirm !== undefined;

  const config = await loadConfig();
  const client = await getAdoClient(config);
  const storage = await getWorkItemStorage(config);
  const stateManager = new SyncStateManager(
    config.storage.basePath,
    config.azure_devops.organization,
    config.azure_devops.project,
  );
  const engine = new SyncEngine(client, storage, stateManager);

  const result = await engine.clearAll(confirm);
  output(result);
}
