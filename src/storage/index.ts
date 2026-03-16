import * as path from "node:path";
import { loadConfig, resolveStoragePath } from "./config.js";
import { WorkItemStorage } from "./workitems.js";
import { TsgStorage } from "./tsg.js";
import type { AdoConfigOutput } from "../schemas/config.schema.js";

let workItemStorage: WorkItemStorage | null = null;
let instructionsStorage: TsgStorage | null = null;

export async function getWorkItemStorage(
  configOverride?: AdoConfigOutput,
): Promise<WorkItemStorage> {
  if (workItemStorage) return workItemStorage;

  const config = configOverride ?? (await loadConfig());
  const resolvedBase = resolveStoragePath(config.storage.basePath);
  const basePath = path.resolve(resolvedBase, config.storage.workItemsPath);
  workItemStorage = new WorkItemStorage(basePath);
  await workItemStorage.ensureDirectories();
  return workItemStorage;
}

export async function getInstructionsStorage(
  configOverride?: AdoConfigOutput,
): Promise<TsgStorage> {
  if (instructionsStorage) return instructionsStorage;

  const config = configOverride ?? (await loadConfig());
  const resolvedBase = resolveStoragePath(config.storage.basePath);
  const basePath = path.resolve(resolvedBase, config.storage.instructionsPath);
  instructionsStorage = new TsgStorage(basePath);
  return instructionsStorage;
}

/** @deprecated Use getInstructionsStorage instead. */
export const getTsgStorage = getInstructionsStorage;

export { WorkItemStorage, TsgStorage };
