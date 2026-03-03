import { z } from "zod/v4";
import type { ToolDefinition } from "../../types/index.js";
import { getAdoClient, mapAdoToLocal, formatWorkItemSummary } from "../helpers.js";
import { getWorkItemStorage } from "../../storage/index.js";
import { WorkItemTypeSchema } from "../../schemas/work-item.schema.js";

const inputSchema = z.object({
  type: WorkItemTypeSchema.describe("Work item type to create"),
  title: z.string().min(1).describe("Title of the work item"),
  description: z.string().optional().describe("Description (supports HTML)"),
  assignedTo: z.string().optional().describe("User to assign (email or display name)"),
  areaPath: z.string().optional().describe("Area path"),
  iterationPath: z.string().optional().describe("Iteration/sprint path"),
  priority: z.number().int().min(1).max(4).optional().describe("Priority (1=Critical, 4=Low)"),
  storyPoints: z.number().optional().describe("Story points"),
  parentId: z.number().int().optional().describe("Parent work item ID"),
  customFields: z
    .record(z.string(), z.unknown())
    .optional()
    .describe("Custom fields as key-value pairs (e.g., {\"Custom.Field\": \"value\"})"),
});

export const createWorkItemTool: ToolDefinition = {
  name: "ado_work_items_create",
  description:
    "Create a new work item in Azure DevOps and save it locally. Supports all standard fields plus custom fields.",
  inputSchema: z.toJSONSchema(inputSchema) as Record<string, unknown>,
  handler: async (params: unknown) => {
    const input = inputSchema.parse(params);
    const client = await getAdoClient();

    const adoItem = await client.createWorkItem({
      type: input.type,
      title: input.title,
      description: input.description,
      assignedTo: input.assignedTo,
      areaPath: input.areaPath,
      iterationPath: input.iterationPath,
      priority: input.priority,
      storyPoints: input.storyPoints,
      parentId: input.parentId,
      customFields: input.customFields,
    });

    const localItem = mapAdoToLocal(adoItem);
    const storage = await getWorkItemStorage();
    const filePath = await storage.save(localItem);

    return {
      content: [
        {
          type: "text" as const,
          text: `Created work item #${localItem.id}\n` +
            `Saved to: ${filePath}\n\n` +
            formatWorkItemSummary(localItem),
        },
      ],
    };
  },
};
