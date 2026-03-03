import { z } from "zod/v4";
import type { ToolDefinition } from "../../types/index.js";
import { getAdoClient, mapAdoToLocal, formatWorkItemSummary } from "../helpers.js";
import { getWorkItemStorage } from "../../storage/index.js";

const inputSchema = z.object({
  id: z.number().int().positive().describe("Work item ID to update"),
  title: z.string().optional().describe("New title"),
  description: z.string().optional().describe("New description (supports HTML)"),
  state: z.string().optional().describe("New state (e.g., Active, Resolved, Closed)"),
  assignedTo: z.string().optional().describe("New assignee (email or display name)"),
  areaPath: z.string().optional().describe("New area path"),
  iterationPath: z.string().optional().describe("New iteration/sprint path"),
  priority: z.number().int().min(1).max(4).optional().describe("New priority"),
  storyPoints: z.number().optional().describe("New story points"),
  customFields: z
    .record(z.string(), z.unknown())
    .optional()
    .describe("Custom fields to update"),
});

export const updateWorkItemTool: ToolDefinition = {
  name: "ado_work_items_update",
  description:
    "Update an existing work item in Azure DevOps and sync the changes locally.",
  inputSchema: z.toJSONSchema(inputSchema) as Record<string, unknown>,
  handler: async (params: unknown) => {
    const input = inputSchema.parse(params);
    const client = await getAdoClient();

    const adoItem = await client.updateWorkItem({
      id: input.id,
      title: input.title,
      description: input.description,
      state: input.state,
      assignedTo: input.assignedTo,
      areaPath: input.areaPath,
      iterationPath: input.iterationPath,
      priority: input.priority,
      storyPoints: input.storyPoints,
      customFields: input.customFields,
    });

    const localItem = mapAdoToLocal(adoItem);
    const storage = await getWorkItemStorage();
    await storage.save(localItem);

    return {
      content: [
        {
          type: "text" as const,
          text: `Updated work item #${localItem.id}\n\n` +
            formatWorkItemSummary(localItem),
        },
      ],
    };
  },
};
