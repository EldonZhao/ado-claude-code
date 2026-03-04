import type { WorkItemType } from "../../types/index.js";
import type { LocalWorkItemOutput } from "../../schemas/work-item.schema.js";
import { HIERARCHY } from "./templates.js";
import { logger } from "../../utils/logger.js";

export interface PlannedItem {
  type: WorkItemType;
  title: string;
  description?: string;
  priority?: number;
  storyPoints?: number;
  children?: PlannedItem[];
}

export interface BreakdownProposal {
  parent: {
    id: number;
    type: WorkItemType;
    title: string;
  };
  childType: WorkItemType;
  items: PlannedItem[];
  hierarchyPath: string;
}

/**
 * Generate a breakdown proposal for a parent work item.
 * This returns a structured proposal — AI (Claude) provides the actual content
 * by calling this tool with the items it generates.
 */
export function createBreakdownProposal(
  parent: LocalWorkItemOutput,
  items: PlannedItem[],
): BreakdownProposal {
  const childTypes = HIERARCHY[parent.type];
  if (childTypes.length === 0) {
    throw new Error(
      `Work item type "${parent.type}" cannot be broken down further.`,
    );
  }

  const childType = childTypes[0];

  // Validate all items match expected child type
  for (const item of items) {
    if (item.type !== childType) {
      logger.warn(
        { expected: childType, got: item.type, title: item.title },
        "Item type mismatch in proposal, correcting",
      );
      item.type = childType;
    }
  }

  return {
    parent: {
      id: parent.id,
      type: parent.type,
      title: parent.title,
    },
    childType,
    items,
    hierarchyPath: `${parent.type} → ${childType}`,
  };
}

/**
 * Format a proposal for display to the user.
 */
export function formatProposal(proposal: BreakdownProposal): string {
  const lines: string[] = [
    `## Breakdown Proposal`,
    `Parent: #${proposal.parent.id} [${proposal.parent.type}] ${proposal.parent.title}`,
    `Hierarchy: ${proposal.hierarchyPath}`,
    `Proposed ${proposal.items.length} ${proposal.childType}(s):`,
    "",
  ];

  for (let i = 0; i < proposal.items.length; i++) {
    const item = proposal.items[i];
    lines.push(`### ${i + 1}. ${item.title}`);
    lines.push(`  Type: ${item.type}`);
    if (item.priority) lines.push(`  Priority: ${item.priority}`);
    if (item.storyPoints) lines.push(`  Points: ${item.storyPoints}`);
    if (item.description) {
      lines.push(`  Description: ${item.description.slice(0, 200)}${item.description.length > 200 ? "..." : ""}`);
    }
    if (item.children && item.children.length > 0) {
      lines.push(`  Sub-items:`);
      for (const child of item.children) {
        lines.push(`    - [${child.type}] ${child.title}`);
      }
    }
    lines.push("");
  }

  return lines.join("\n");
}

/**
 * Get guidance text for Claude on how to break down a work item.
 */
export function getBreakdownGuidance(
  parent: LocalWorkItemOutput,
): string {
  const childTypes = HIERARCHY[parent.type];
  if (childTypes.length === 0) {
    return `"${parent.type}" items cannot be broken down further.`;
  }

  const childType = childTypes[0];
  const guidelines: Record<string, string> = {
    Feature:
      "Break into independent, deliverable features. Each feature should provide distinct user value. " +
      "Include acceptance criteria in the description.",
    "User Story":
      "Write user stories in 'As a [role], I want [goal], so that [benefit]' format. " +
      "Each story should be independent, negotiable, valuable, estimable, small, and testable (INVEST).",
    Task:
      "Break into smaller, atomic sub-tasks. Each sub-task should represent a single concrete action. " +
      "Include specific implementation details and clear completion criteria.",
  };

  return (
    `Break down this ${parent.type} into ${childType}(s).\n\n` +
    `Parent: #${parent.id} "${parent.title}"\n` +
    (parent.description
      ? `Description:\n${parent.description}\n\n`
      : "\n") +
    `Guidelines for ${childType}:\n${guidelines[childType] ?? "Create appropriate child items."}\n\n` +
    `Return your proposal by calling ado_work_items_workitem_plan with:\n` +
    `- id: ${parent.id}\n` +
    `- items: array of {title, description, priority?, storyPoints?}\n` +
    `- createInAdo: true (to create) or false (preview only)`
  );
}
