import { AdoClient } from "../services/ado/client.js";
import type { AdoWorkItem } from "../services/ado/types.js";
import type { AdoConfigOutput } from "../schemas/config.schema.js";
import type { LocalWorkItemOutput } from "../schemas/work-item.schema.js";
import { adoToLocal } from "../services/sync/mapper.js";
import { loadConfig } from "../storage/config.js";

let clientInstance: AdoClient | null = null;

export async function getAdoClient(
  configOverride?: AdoConfigOutput,
): Promise<AdoClient> {
  if (clientInstance) return clientInstance;
  const config = configOverride ?? (await loadConfig());
  clientInstance = new AdoClient(config);
  return clientInstance;
}

// Re-export mapper for use by tools
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
