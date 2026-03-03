import * as path from "node:path";
import { loadConfig } from "./config.js";
import { WorkItemStorage } from "./work-items.js";
import { TsgStorage } from "./tsg.js";
import type { AdoConfigOutput } from "../schemas/config.schema.js";

let workItemStorage: WorkItemStorage | null = null;
let tsgStorage: TsgStorage | null = null;

export async function getWorkItemStorage(
  configOverride?: AdoConfigOutput,
): Promise<WorkItemStorage> {
  if (workItemStorage) return workItemStorage;

  const config = configOverride ?? (await loadConfig());
  const basePath = path.resolve(
    config.storage.basePath,
    config.storage.workItemsPath,
  );
  workItemStorage = new WorkItemStorage(basePath);
  await workItemStorage.ensureDirectories();
  return workItemStorage;
}

export async function getTsgStorage(
  configOverride?: AdoConfigOutput,
): Promise<TsgStorage> {
  if (tsgStorage) return tsgStorage;

  const config = configOverride ?? (await loadConfig());
  const basePath = path.resolve(
    config.storage.basePath,
    config.storage.tsgPath,
  );
  tsgStorage = new TsgStorage(basePath);
  return tsgStorage;
}

export { WorkItemStorage, TsgStorage };
