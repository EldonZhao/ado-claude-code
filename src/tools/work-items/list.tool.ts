import { z } from "zod/v4";
import type { ToolDefinition } from "../../types/index.js";
import { getWorkItemStorage } from "../../storage/index.js";
import { formatWorkItemSummary } from "../helpers.js";
import { WorkItemTypeSchema } from "../../schemas/work-item.schema.js";

const inputSchema = z.object({
  type: WorkItemTypeSchema.optional().describe("Filter by work item type"),
  state: z.string().optional().describe("Filter by state (e.g., Active, New, Closed)"),
  assignedTo: z.string().optional().describe("Filter by assigned user"),
});

export const listWorkItemsTool: ToolDefinition = {
  name: "ado_work_items_list",
  description:
    "List locally synced work items. Supports filtering by type, state, and assignee.",
  inputSchema: z.toJSONSchema(inputSchema) as Record<string, unknown>,
  handler: async (params: unknown) => {
    const input = inputSchema.parse(params);
    const storage = await getWorkItemStorage();
    const items = await storage.listAll({
      type: input.type,
      state: input.state,
      assignedTo: input.assignedTo,
    });

    if (items.length === 0) {
      return {
        content: [
          {
            type: "text" as const,
            text: "No work items found matching the filters. Run ado_work_items_sync with direction 'pull' to sync from Azure DevOps.",
          },
        ],
      };
    }

    const summary = items.map(formatWorkItemSummary).join("\n\n");
    return {
      content: [
        {
          type: "text" as const,
          text: `Found ${items.length} work item(s):\n\n${summary}`,
        },
      ],
    };
  },
};
