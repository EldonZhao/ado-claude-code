import { z } from "zod/v4";
import type { ToolDefinition } from "../../types/index.js";
import { getAdoClient, mapAdoToLocal, formatWorkItemSummary } from "../helpers.js";
import { getWorkItemStorage } from "../../storage/index.js";

const inputSchema = z.object({
  wiql: z
    .string()
    .min(1)
    .describe(
      "WIQL query string. Example: SELECT [System.Id], [System.Title] FROM WorkItems WHERE [System.State] = 'Active'",
    ),
  save: z
    .boolean()
    .optional()
    .default(false)
    .describe("Whether to save query results locally"),
});

export const queryWorkItemsTool: ToolDefinition = {
  name: "ado_work_items_query",
  description:
    "Run a WIQL (Work Item Query Language) query against Azure DevOps and return matching work items.",
  inputSchema: z.toJSONSchema(inputSchema) as Record<string, unknown>,
  handler: async (params: unknown) => {
    const input = inputSchema.parse(params);
    const client = await getAdoClient();
    const adoItems = await client.queryWorkItems(input.wiql);

    if (adoItems.length === 0) {
      return {
        content: [
          {
            type: "text" as const,
            text: "No work items matched the query.",
          },
        ],
      };
    }

    const localItems = adoItems.map(mapAdoToLocal);

    if (input.save) {
      const storage = await getWorkItemStorage();
      for (const item of localItems) {
        await storage.save(item);
      }
    }

    const summary = localItems.map(formatWorkItemSummary).join("\n\n");
    return {
      content: [
        {
          type: "text" as const,
          text: `Query returned ${localItems.length} work item(s)${input.save ? " (saved locally)" : ""}:\n\n${summary}`,
        },
      ],
    };
  },
};
