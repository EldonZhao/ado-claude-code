import type { WorkItemType } from "../../types/index.js";

export interface WorkItemTemplate {
  type: WorkItemType;
  titlePrefix: string;
  defaultFields?: Record<string, unknown>;
}

/**
 * Defines which child types each parent can break down into.
 */
export const HIERARCHY: Record<WorkItemType, WorkItemType[]> = {
  Epic: ["Feature"],
  Feature: ["User Story"],
  "User Story": ["Task"],
  Task: ["Task"],
  Bug: ["Task"],
};

/**
 * Default templates for new work items generated during planning.
 */
export const TEMPLATES: Record<WorkItemType, WorkItemTemplate> = {
  Epic: {
    type: "Epic",
    titlePrefix: "",
    defaultFields: { "Microsoft.VSTS.Common.Priority": 2 },
  },
  Feature: {
    type: "Feature",
    titlePrefix: "",
    defaultFields: { "Microsoft.VSTS.Common.Priority": 2 },
  },
  "User Story": {
    type: "User Story",
    titlePrefix: "As a user, ",
    defaultFields: { "Microsoft.VSTS.Common.Priority": 2 },
  },
  Task: {
    type: "Task",
    titlePrefix: "",
    defaultFields: { "Microsoft.VSTS.Common.Priority": 2 },
  },
  Bug: {
    type: "Bug",
    titlePrefix: "",
    defaultFields: { "Microsoft.VSTS.Common.Priority": 2 },
  },
};

/**
 * Get a display label for the hierarchy depth.
 */
export function getDepthLabel(parentType: WorkItemType, depth: number): string {
  const chain: WorkItemType[] = [parentType];
  let current = parentType;
  for (let i = 0; i < depth; i++) {
    const children = HIERARCHY[current];
    if (children.length === 0) break;
    current = children[0];
    chain.push(current);
  }
  return chain.join(" → ");
}
