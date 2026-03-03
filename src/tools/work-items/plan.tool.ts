import { z } from "zod/v4";
import type { ToolDefinition } from "../../types/index.js";
import type { WorkItemType } from "../../types/index.js";
import { getAdoClient, mapAdoToLocal, formatWorkItemSummary } from "../helpers.js";
import { getWorkItemStorage } from "../../storage/index.js";
import { HIERARCHY } from "../../services/planning/templates.js";
import {
  createBreakdownProposal,
  formatProposal,
  getBreakdownGuidance,
  type PlannedItem,
} from "../../services/planning/breakdown.js";

const plannedItemSchema: z.ZodType<PlannedItem> = z.object({
  type: z.enum(["Epic", "Feature", "User Story", "Task", "Bug"]),
  title: z.string().min(1),
  description: z.string().optional(),
  priority: z.number().int().min(1).max(4).optional(),
  storyPoints: z.number().optional(),
  children: z.lazy(() => z.array(plannedItemSchema)).optional(),
});

const inputSchema = z.object({
  id: z.number().int().positive().describe("Parent work item ID to break down"),
  items: z
    .array(plannedItemSchema)
    .optional()
    .describe(
      "Proposed child items. If omitted, returns guidance for Claude to generate a proposal.",
    ),
  createInAdo: z
    .boolean()
    .optional()
    .default(false)
    .describe("If true, create the proposed items in Azure DevOps. If false, preview only."),
});

export const planWorkItemsTool: ToolDefinition = {
  name: "ado_work_items_plan",
  description:
    "AI-assisted work item breakdown. Fetches a parent work item and either: " +
    "(1) returns guidance for generating child items if no items provided, or " +
    "(2) validates and optionally creates the proposed items in ADO. " +
    "Supports Epic→Feature, Feature→User Story, User Story→Task, Bug→Task.",
  inputSchema: z.toJSONSchema(inputSchema) as Record<string, unknown>,
  handler: async (params: unknown) => {
    const input = inputSchema.parse(params);
    const client = await getAdoClient();
    const storage = await getWorkItemStorage();

    // Fetch parent work item
    const adoParent = await client.getWorkItem(input.id, "relations");
    const parent = mapAdoToLocal(adoParent);
    await storage.save(parent);

    // Check if this type can be broken down
    const childTypes = HIERARCHY[parent.type];
    if (childTypes.length === 0) {
      return {
        content: [
          {
            type: "text" as const,
            text: `Work item #${parent.id} is a "${parent.type}" — it cannot be broken down further.`,
          },
        ],
      };
    }

    // If no items provided, return guidance for Claude
    if (!input.items || input.items.length === 0) {
      const guidance = getBreakdownGuidance(parent);
      return {
        content: [
          {
            type: "text" as const,
            text: guidance,
          },
        ],
      };
    }

    // Validate and create proposal
    const proposal = createBreakdownProposal(parent, input.items);

    // Preview only
    if (!input.createInAdo) {
      return {
        content: [
          {
            type: "text" as const,
            text:
              formatProposal(proposal) +
              "\n---\nThis is a preview. Set createInAdo=true to create these items in Azure DevOps.",
          },
        ],
      };
    }

    // Create items in ADO
    const created: string[] = [];
    for (const item of proposal.items) {
      try {
        const adoItem = await client.createWorkItem({
          type: item.type,
          title: item.title,
          description: item.description,
          priority: item.priority,
          storyPoints: item.storyPoints,
          parentId: parent.id,
        });
        const local = mapAdoToLocal(adoItem);
        await storage.save(local);
        created.push(formatWorkItemSummary(local));

        // Create nested children if any
        if (item.children && item.children.length > 0) {
          for (const child of item.children) {
            try {
              const childAdo = await client.createWorkItem({
                type: child.type,
                title: child.title,
                description: child.description,
                priority: child.priority,
                storyPoints: child.storyPoints,
                parentId: adoItem.id,
              });
              const childLocal = mapAdoToLocal(childAdo);
              await storage.save(childLocal);
              created.push("  └─ " + formatWorkItemSummary(childLocal));
            } catch (err) {
              created.push(`  └─ FAILED: ${child.title} — ${err}`);
            }
          }
        }
      } catch (err) {
        created.push(`FAILED: ${item.title} — ${err}`);
      }
    }

    return {
      content: [
        {
          type: "text" as const,
          text:
            `Created ${created.length} item(s) under #${parent.id} [${parent.type}] ${parent.title}:\n\n` +
            created.join("\n\n"),
        },
      ],
    };
  },
};
