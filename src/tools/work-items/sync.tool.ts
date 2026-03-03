import { z } from "zod/v4";
import type { ToolDefinition } from "../../types/index.js";
import { getAdoClient } from "../helpers.js";
import { getWorkItemStorage } from "../../storage/index.js";
import { loadConfig } from "../../storage/config.js";
import { SyncStateManager } from "../../services/sync/state.js";
import { SyncEngine } from "../../services/sync/engine.js";

const inputSchema = z.object({
  direction: z
    .enum(["pull", "push", "full"])
    .describe("Sync direction: pull from ADO, push to ADO, or full bidirectional"),
  query: z
    .string()
    .optional()
    .describe(
      "WIQL query for pull/full. Required for pull if no ids provided. " +
        "Example: SELECT [System.Id] FROM WorkItems WHERE [System.State] = 'Active'",
    ),
  ids: z
    .array(z.number().int().positive())
    .optional()
    .describe("Specific work item IDs to sync"),
});

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

export const syncWorkItemsTool: ToolDefinition = {
  name: "ado_work_items_sync",
  description:
    "Sync work items between Azure DevOps and local storage. " +
    "Use direction='pull' to fetch from ADO, 'push' to send local changes to ADO, " +
    "or 'full' for bidirectional sync.",
  inputSchema: z.toJSONSchema(inputSchema) as Record<string, unknown>,
  handler: async (params: unknown) => {
    const input = inputSchema.parse(params);
    const engine = await createSyncEngine();

    let resultText: string;

    switch (input.direction) {
      case "pull": {
        const result = await engine.pullFromAdo({
          query: input.query,
          ids: input.ids,
        });
        resultText = formatSyncResult("Pull", result);
        break;
      }
      case "push": {
        const result = await engine.pushToAdo({
          ids: input.ids,
        });
        resultText = formatSyncResult("Push", result);
        break;
      }
      case "full": {
        if (!input.query) {
          return {
            content: [
              {
                type: "text" as const,
                text: "Full sync requires a WIQL query to determine which items to pull.",
              },
            ],
            isError: true,
          };
        }
        const result = await engine.fullSync(input.query);
        resultText = formatSyncResult("Full sync", result);
        break;
      }
    }

    return {
      content: [{ type: "text" as const, text: resultText }],
    };
  },
};

function formatSyncResult(
  operation: string,
  result: { pulled: number; pushed: number; conflicts: number; errors: string[] },
): string {
  const lines = [`${operation} completed:`];
  if (result.pulled > 0) lines.push(`  Pulled: ${result.pulled} item(s)`);
  if (result.pushed > 0) lines.push(`  Pushed: ${result.pushed} item(s)`);
  if (result.conflicts > 0)
    lines.push(`  Conflicts: ${result.conflicts} item(s) (needs manual resolution)`);
  if (result.errors.length > 0) {
    lines.push(`  Errors (${result.errors.length}):`);
    for (const err of result.errors) {
      lines.push(`    - ${err}`);
    }
  }
  if (result.pulled === 0 && result.pushed === 0 && result.conflicts === 0) {
    lines.push("  No changes detected.");
  }
  return lines.join("\n");
}
