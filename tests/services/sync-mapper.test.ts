import { describe, it, expect } from "vitest";
import {
  adoToLocal,
  localToAdoPatch,
  serializeForHash,
  toWebUrl,
} from "../../src/services/sync/mapper.js";
import type { AdoWorkItem } from "../../src/services/ado/types.js";
import type { LocalWorkItemOutput } from "../../src/schemas/work-item.schema.js";

function makeAdoItem(overrides?: Partial<AdoWorkItem>): AdoWorkItem {
  return {
    id: 12345,
    rev: 3,
    url: "https://dev.azure.com/org/project/_apis/wit/workItems/12345",
    fields: {
      "System.WorkItemType": "User Story",
      "System.Title": "Test Story",
      "System.State": "Active",
      "System.AssignedTo": "user@example.com",
      "System.AreaPath": "Project\\Team",
      "System.IterationPath": "Project\\Sprint 1",
      "Microsoft.VSTS.Common.Priority": 2,
      "Microsoft.VSTS.Scheduling.StoryPoints": 5,
      "System.Description": "A test description",
      "System.Parent": 12340,
    },
    ...overrides,
  };
}

function makeLocalItem(
  overrides?: Partial<LocalWorkItemOutput>,
): LocalWorkItemOutput {
  return {
    id: 12345,
    rev: 3,
    url: "https://dev.azure.com/org/project/_workitems/edit/12345",
    syncedAt: "2026-03-03T00:00:00.000Z",
    type: "User Story",
    title: "Test Story",
    state: "Active",
    assignedTo: "user@example.com",
    areaPath: "Project\\Team",
    iterationPath: "Project\\Sprint 1",
    priority: 2,
    storyPoints: 5,
    description: "A test description",
    parent: 12340,
    ...overrides,
  };
}

describe("toWebUrl", () => {
  it("converts dev.azure.com API URL to web URL", () => {
    expect(
      toWebUrl("https://dev.azure.com/org/project/_apis/wit/workItems/12345"),
    ).toBe("https://dev.azure.com/org/project/_workitems/edit/12345");
  });

  it("converts visualstudio.com API URL to web URL", () => {
    expect(
      toWebUrl("https://outlookweb.visualstudio.com/96d8c580-9d17-4232-9a8f-30d9ed915689/_apis/wit/workItems/415168"),
    ).toBe("https://outlookweb.visualstudio.com/96d8c580-9d17-4232-9a8f-30d9ed915689/_workitems/edit/415168");
  });

  it("passes through already-correct web URLs", () => {
    const webUrl = "https://dev.azure.com/org/project/_workitems/edit/12345";
    expect(toWebUrl(webUrl)).toBe(webUrl);
  });

  it("passes through empty string", () => {
    expect(toWebUrl("")).toBe("");
  });
});

describe("adoToLocal", () => {
  it("maps all fields correctly", () => {
    const ado = makeAdoItem();
    const local = adoToLocal(ado);

    expect(local.id).toBe(12345);
    expect(local.rev).toBe(3);
    expect(local.url).toBe("https://dev.azure.com/org/project/_workitems/edit/12345");
    expect(local.type).toBe("User Story");
    expect(local.title).toBe("Test Story");
    expect(local.state).toBe("Active");
    expect(local.assignedTo).toBe("user@example.com");
    expect(local.areaPath).toBe("Project\\Team");
    expect(local.priority).toBe(2);
    expect(local.storyPoints).toBe(5);
    expect(local.parent).toBe(12340);
    expect(local.syncedAt).toBeDefined();
  });

  it("handles object-form assignedTo with uniqueName", () => {
    const ado = makeAdoItem({
      fields: {
        ...makeAdoItem().fields,
        "System.AssignedTo": {
          uniqueName: "user@example.com",
          displayName: "User",
        },
      },
    });
    const local = adoToLocal(ado);
    expect(local.assignedTo).toBe("user@example.com");
  });

  it("handles object-form assignedTo with displayName only", () => {
    const ado = makeAdoItem({
      fields: {
        ...makeAdoItem().fields,
        "System.AssignedTo": { displayName: "Display User" },
      },
    });
    const local = adoToLocal(ado);
    expect(local.assignedTo).toBe("Display User");
  });

  it("handles missing assignedTo", () => {
    const ado = makeAdoItem({
      fields: {
        ...makeAdoItem().fields,
        "System.AssignedTo": undefined,
      },
    });
    const local = adoToLocal(ado);
    expect(local.assignedTo).toBeUndefined();
  });

  it("extracts children from relations", () => {
    const ado = makeAdoItem({
      relations: [
        {
          rel: "System.LinkTypes.Hierarchy-Forward",
          url: "https://dev.azure.com/org/project/_apis/wit/workItems/100",
          attributes: {},
        },
        {
          rel: "System.LinkTypes.Hierarchy-Forward",
          url: "https://dev.azure.com/org/project/_apis/wit/workItems/101",
          attributes: {},
        },
        {
          rel: "System.LinkTypes.Hierarchy-Reverse",
          url: "https://dev.azure.com/org/project/_apis/wit/workItems/99",
          attributes: {},
        },
      ],
    });
    const local = adoToLocal(ado);
    expect(local.children).toEqual([100, 101]);
  });

  it("returns undefined children when no forward relations", () => {
    const ado = makeAdoItem({ relations: undefined });
    const local = adoToLocal(ado);
    expect(local.children).toBeUndefined();
  });
});

describe("localToAdoPatch", () => {
  it("returns empty array when nothing changed", () => {
    const item = makeLocalItem();
    const ops = localToAdoPatch(item, item);
    expect(ops).toEqual([]);
  });

  it("detects title change", () => {
    const baseline = makeLocalItem();
    const updated = makeLocalItem({ title: "Updated Title" });
    const ops = localToAdoPatch(updated, baseline);
    expect(ops).toEqual([
      {
        op: "replace",
        path: "/fields/System.Title",
        value: "Updated Title",
      },
    ]);
  });

  it("detects multiple field changes", () => {
    const baseline = makeLocalItem();
    const updated = makeLocalItem({
      title: "New Title",
      state: "Closed",
      priority: 1,
    });
    const ops = localToAdoPatch(updated, baseline);
    expect(ops).toHaveLength(3);
    expect(ops.map((o) => o.path)).toContain("/fields/System.Title");
    expect(ops.map((o) => o.path)).toContain("/fields/System.State");
    expect(ops.map((o) => o.path)).toContain(
      "/fields/Microsoft.VSTS.Common.Priority",
    );
  });

  it("handles clearing optional fields", () => {
    const baseline = makeLocalItem({ description: "old desc" });
    const updated = makeLocalItem({ description: undefined });
    const ops = localToAdoPatch(updated, baseline);
    expect(ops).toHaveLength(1);
    expect(ops[0].value).toBe("");
  });
});

describe("serializeForHash", () => {
  it("excludes syncedAt from serialization", () => {
    const item1 = makeLocalItem({ syncedAt: "2026-01-01T00:00:00.000Z" });
    const item2 = makeLocalItem({ syncedAt: "2026-12-31T00:00:00.000Z" });
    expect(serializeForHash(item1)).toBe(serializeForHash(item2));
  });

  it("produces different hashes for different content", () => {
    const item1 = makeLocalItem({ title: "Title A" });
    const item2 = makeLocalItem({ title: "Title B" });
    expect(serializeForHash(item1)).not.toBe(serializeForHash(item2));
  });
});
