import { z } from "zod/v4";
import type { ToolDefinition } from "../../types/index.js";
import { getAdoClient, mapAdoToLocal, formatWorkItemSummary } from "../helpers.js";
import { getWorkItemStorage } from "../../storage/index.js";

const inputSchema = z.object({
  id: z.number().int().positive().describe("Work item ID"),
  expand: z
    .enum(["all", "relations", "fields", "links", "none"])
    .optional()
    .describe("Expand level for the work item"),
  save: z
    .boolean()
    .optional()
    .default(true)
    .describe("Whether to save the work item locally"),
});

export const getWorkItemTool: ToolDefinition = {
  name: "ado_work_items_get",
  description:
    "Get a single work item from Azure DevOps by ID. Fetches from ADO API and optionally saves locally.",
  inputSchema: z.toJSONSchema(inputSchema) as Record<string, unknown>,
  handler: async (params: unknown) => {
    const input = inputSchema.parse(params);
    const client = await getAdoClient();
    const adoItem = await client.getWorkItem(input.id, input.expand ?? "relations");
    const localItem = mapAdoToLocal(adoItem);

    if (input.save) {
      const storage = await getWorkItemStorage();
      await storage.save(localItem);
    }

    return {
      content: [
        {
          type: "text" as const,
          text: formatWorkItemSummary(localItem) +
            "\n\n---\nFull details:\n" +
            JSON.stringify(localItem, null, 2),
        },
      ],
    };
  },
};
