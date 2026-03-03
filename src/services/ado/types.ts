import type { WorkItemType } from "../../types/index.js";

// Re-export useful types from azure-devops-node-api
export interface AdoWorkItemFields {
  "System.Id": number;
  "System.Rev": number;
  "System.WorkItemType": string;
  "System.Title": string;
  "System.State": string;
  "System.AssignedTo"?: { displayName: string; uniqueName: string };
  "System.AreaPath"?: string;
  "System.IterationPath"?: string;
  "System.Description"?: string;
  "System.Parent"?: number;
  "Microsoft.VSTS.Common.Priority"?: number;
  "Microsoft.VSTS.Scheduling.StoryPoints"?: number;
  [key: string]: unknown;
}

export interface AdoWorkItem {
  id: number;
  rev: number;
  url: string;
  fields: AdoWorkItemFields;
  relations?: AdoWorkItemRelation[];
}

export interface AdoWorkItemRelation {
  rel: string;
  url: string;
  attributes: {
    name?: string;
    [key: string]: unknown;
  };
}

export interface AdoQueryResult {
  workItems: Array<{ id: number; url: string }>;
}

export interface WorkItemCreateParams {
  type: WorkItemType;
  title: string;
  description?: string;
  assignedTo?: string;
  areaPath?: string;
  iterationPath?: string;
  priority?: number;
  storyPoints?: number;
  parentId?: number;
  customFields?: Record<string, unknown>;
}

export interface WorkItemUpdateParams {
  id: number;
  title?: string;
  description?: string;
  state?: string;
  assignedTo?: string;
  areaPath?: string;
  iterationPath?: string;
  priority?: number;
  storyPoints?: number;
  customFields?: Record<string, unknown>;
}

export interface JsonPatchOperation {
  op: "add" | "replace" | "remove" | "test";
  path: string;
  value?: unknown;
}
