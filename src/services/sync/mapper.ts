import type { AdoWorkItem } from "../ado/types.js";
import type { LocalWorkItemOutput } from "../../schemas/workitem.schema.js";
import type { WorkItemType } from "../../types/index.js";
import { stringify as stringifyYaml } from "yaml";

/**
 * Convert an ADO REST API URL to a web-browsable URL.
 * e.g. https://org.visualstudio.com/{project}/_apis/wit/workItems/123
 *    → https://org.visualstudio.com/{project}/_workitems/edit/123
 */
export function toWebUrl(apiUrl: string): string {
  return apiUrl.replace(/_apis\/wit\/workItems\/(\d+)$/, "_workitems/edit/$1");
}

/**
 * Map an ADO API work item to the local YAML-compatible format.
 */
export function adoToLocal(item: AdoWorkItem, latestComment?: string): LocalWorkItemOutput {
  const f = item.fields;

  const assignedTo = resolveAssignedTo(f["System.AssignedTo"]);

  const children: number[] = [];
  if (item.relations) {
    for (const rel of item.relations) {
      if (rel.rel === "System.LinkTypes.Hierarchy-Forward") {
        const match = rel.url.match(/\/workItems\/(\d+)$/);
        if (match) children.push(parseInt(match[1], 10));
      }
    }
  }

  return {
    id: item.id,
    rev: item.rev,
    url: toWebUrl(item.url),
    syncedAt: new Date().toISOString(),
    type: (f["System.WorkItemType"] as WorkItemType) ?? "Task",
    title: f["System.Title"] as string,
    state: f["System.State"] as string,
    assignedTo,
    areaPath: (f["System.AreaPath"] as string) ?? undefined,
    iterationPath: (f["System.IterationPath"] as string) ?? undefined,
    priority: (f["Microsoft.VSTS.Common.Priority"] as number) ?? undefined,
    storyPoints:
      (f["Microsoft.VSTS.Scheduling.StoryPoints"] as number) ?? undefined,
    parent: (f["System.Parent"] as number) ?? undefined,
    children: children.length > 0 ? children : undefined,
    description: (f["System.Description"] as string) ?? "",
    latestComment,
  };
}

/**
 * Convert a local work item back to ADO JsonPatch operations for fields that changed.
 */
export function localToAdoPatch(
  local: LocalWorkItemOutput,
  baseline: LocalWorkItemOutput,
): Array<{ op: "replace"; path: string; value: unknown }> {
  const ops: Array<{ op: "replace"; path: string; value: unknown }> = [];

  if (local.title !== baseline.title) {
    ops.push({ op: "replace", path: "/fields/System.Title", value: local.title });
  }
  if (local.state !== baseline.state) {
    ops.push({ op: "replace", path: "/fields/System.State", value: local.state });
  }
  if (local.description !== baseline.description) {
    ops.push({
      op: "replace",
      path: "/fields/System.Description",
      value: local.description ?? "",
    });
  }
  if (local.assignedTo !== baseline.assignedTo) {
    ops.push({
      op: "replace",
      path: "/fields/System.AssignedTo",
      value: local.assignedTo ?? "",
    });
  }
  if (local.areaPath !== baseline.areaPath) {
    ops.push({
      op: "replace",
      path: "/fields/System.AreaPath",
      value: local.areaPath ?? "",
    });
  }
  if (local.iterationPath !== baseline.iterationPath) {
    ops.push({
      op: "replace",
      path: "/fields/System.IterationPath",
      value: local.iterationPath ?? "",
    });
  }
  if (local.priority !== baseline.priority) {
    ops.push({
      op: "replace",
      path: "/fields/Microsoft.VSTS.Common.Priority",
      value: local.priority,
    });
  }
  if (local.storyPoints !== baseline.storyPoints) {
    ops.push({
      op: "replace",
      path: "/fields/Microsoft.VSTS.Scheduling.StoryPoints",
      value: local.storyPoints,
    });
  }

  return ops;
}

/**
 * Serialize a local work item to a stable YAML string for hashing.
 * Excludes syncedAt since that changes on every sync but doesn't represent a content change.
 */
export function serializeForHash(item: LocalWorkItemOutput): string {
  const { syncedAt, latestComment, ...rest } = item;
  return stringifyYaml(rest, { sortMapEntries: true });
}

function resolveAssignedTo(value: unknown): string | undefined {
  if (!value) return undefined;
  if (typeof value === "string") return value;
  if (typeof value === "object" && value !== null) {
    const obj = value as Record<string, unknown>;
    return (obj.uniqueName as string) ?? (obj.displayName as string) ?? undefined;
  }
  return undefined;
}
