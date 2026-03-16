import * as path from "node:path";
import { output, parseFlags } from "./helpers.js";
import { loadConfig, resolveStoragePath, getProjectRoot } from "../storage/config.js";
import { WorkItemStorage } from "../storage/workitems.js";
import { SyncStateManager } from "../services/sync/state.js";
import { SyncEngine } from "../services/sync/engine.js";
import { logger } from "../utils/logger.js";

// Default storage layout matching config schema defaults
const DEFAULT_BASE_PATH = "./.claude/ado";
const DEFAULT_WORK_ITEMS_PATH = "workitems";

export async function handleClear(args: string[]): Promise<void> {
  const flags = parseFlags(args);
  const confirm = flags.confirm !== undefined;

  // Try loading config; fall back to defaults so clear works without setup
  let storagePath: string;
  let workItemsDir: string;
  let organization = "unknown";
  let project = "unknown";

  try {
    const config = await loadConfig();
    storagePath = resolveStoragePath(config.storage.basePath);
    workItemsDir = path.resolve(storagePath, config.storage.workItemsPath);
    organization = config.azure_devops.organization;
    project = config.azure_devops.project;
  } catch {
    logger.debug("Config not found, using default storage paths for clear");
    const root = getProjectRoot();
    storagePath = path.resolve(root, DEFAULT_BASE_PATH);
    workItemsDir = path.resolve(storagePath, DEFAULT_WORK_ITEMS_PATH);
  }

  const storage = new WorkItemStorage(workItemsDir);
  const stateManager = new SyncStateManager(storagePath, organization, project);
  // clearAll only uses storage/stateManager, never the ADO client
  const engine = new SyncEngine(null as any, storage, stateManager);

  const result = await engine.clearAll(confirm);
  output(result);
}
