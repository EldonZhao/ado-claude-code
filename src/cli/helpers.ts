import { AdoClient } from "../services/ado/client.js";
import type { AdoWorkItem } from "../services/ado/types.js";
import type { AdoConfigOutput } from "../schemas/config.schema.js";
import type { LocalWorkItemOutput } from "../schemas/work-item.schema.js";
import { adoToLocal } from "../services/sync/mapper.js";
import { SyncStateManager } from "../services/sync/state.js";
import { loadConfig } from "../storage/config.js";

let clientInstance: AdoClient | null = null;
let syncStateInstance: SyncStateManager | null = null;

export async function getAdoClient(
  configOverride?: AdoConfigOutput,
): Promise<AdoClient> {
  if (clientInstance) return clientInstance;
  const config = configOverride ?? (await loadConfig());
  clientInstance = new AdoClient(config);
  return clientInstance;
}

export async function getSyncStateManager(
  configOverride?: AdoConfigOutput,
): Promise<SyncStateManager> {
  if (syncStateInstance) return syncStateInstance;
  const config = configOverride ?? (await loadConfig());
  syncStateInstance = new SyncStateManager(
    config.storage.basePath,
    config.azure_devops.organization,
    config.azure_devops.project,
  );
  return syncStateInstance;
}

export function mapAdoToLocal(item: AdoWorkItem): LocalWorkItemOutput {
  return adoToLocal(item);
}

export function formatWorkItemSummary(item: LocalWorkItemOutput): string {
  const parts = [
    `#${item.id} [${item.type}] ${item.title}`,
    `  State: ${item.state}`,
  ];
  if (item.assignedTo) parts.push(`  Assigned: ${item.assignedTo}`);
  if (item.priority) parts.push(`  Priority: ${item.priority}`);
  if (item.storyPoints) parts.push(`  Points: ${item.storyPoints}`);
  if (item.iterationPath) parts.push(`  Iteration: ${item.iterationPath}`);
  return parts.join("\n");
}

/** Write JSON to stdout */
export function output(data: unknown): void {
  process.stdout.write(JSON.stringify(data, null, 2) + "\n");
}

/** Write error to stderr and exit */
export function fatal(message: string, exitCode = 1): never {
  process.stderr.write(`Error: ${message}\n`);
  process.exit(exitCode);
}

/** Parse --flag=value args into a record */
export function parseFlags(args: string[]): Record<string, string> {
  const flags: Record<string, string> = {};
  for (const arg of args) {
    if (arg.startsWith("--")) {
      const eq = arg.indexOf("=");
      if (eq !== -1) {
        flags[arg.slice(2, eq)] = arg.slice(eq + 1);
      } else {
        // Boolean flag
        flags[arg.slice(2)] = "true";
      }
    }
  }
  return flags;
}
