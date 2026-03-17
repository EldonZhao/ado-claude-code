import { describe, it, expect, vi, beforeEach } from "vitest";
import type { LocalWorkItemOutput } from "../../src/schemas/workitem.schema.js";

// ---------- Mocks ----------

const mockQueryWorkItems = vi.fn();
const mockGetWorkItem = vi.fn();
const mockGetLatestComment = vi.fn();
const mockOutput = vi.fn();
const mockFatal = vi.fn((msg: string) => { throw new Error(msg); });

vi.mock("../../src/cli/helpers.js", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../../src/cli/helpers.js")>();
  return {
    getAdoClient: vi.fn().mockResolvedValue({
      queryWorkItems: (...args: unknown[]) => mockQueryWorkItems(...args),
      getWorkItem: (...args: unknown[]) => mockGetWorkItem(...args),
      getLatestComment: (...args: unknown[]) => mockGetLatestComment(...args),
      updateWorkItem: vi.fn(),
      addComment: vi.fn(),
      getTerminalState: vi.fn(),
    }),
    getSyncStateManager: vi.fn().mockResolvedValue({
      getItemState: vi.fn(),
      setItemState: vi.fn(),
      save: vi.fn(),
    }),
    mapAdoToLocal: vi.fn((ado: any, latestComment?: string) => {
      const result = { ...ado } as LocalWorkItemOutput;
      if (latestComment !== undefined) result.latestComment = latestComment;
      return result;
    }),
    output: (...args: unknown[]) => mockOutput(...args),
    fatal: (msg: string) => mockFatal(msg),
    parseFlags: actual.parseFlags,
    markdownToHtml: actual.markdownToHtml,
    checkHelp: vi.fn(),
  };
});

vi.mock("../../src/storage/index.js", () => ({
  getWorkItemStorage: vi.fn().mockResolvedValue({
    save: vi.fn(),
    loadById: vi.fn(),
  }),
}));

vi.mock("../../src/services/planning/code-plan.js", () => ({
  getCodePlanGuidance: vi.fn(() => "mock"),
}));

vi.mock("../../src/services/sync/mapper.js", () => ({
  adoToLocal: vi.fn((ado: any) => ({ ...ado })),
  localToAdoPatch: vi.fn(() => []),
  serializeForHash: vi.fn(() => "mock-serialized"),
}));

vi.mock("../../src/services/sync/state.js", () => ({
  SyncStateManager: { computeHash: vi.fn(() => "mock-hash") },
}));

vi.mock("../../src/services/planning/templates.js", () => ({
  HIERARCHY: {},
}));

vi.mock("../../src/services/planning/breakdown.js", () => ({
  createBreakdownProposal: vi.fn(),
  formatProposal: vi.fn(),
  getBreakdownGuidance: vi.fn(),
}));

import { handleWorkItems } from "../../src/cli/workitems.js";

// ---------- Helpers ----------

function makeItem(overrides: Partial<LocalWorkItemOutput> & { id: number }): LocalWorkItemOutput {
  return {
    rev: 1,
    url: `https://dev.azure.com/org/proj/_apis/wit/workItems/${overrides.id}`,
    syncedAt: "2026-03-04T00:00:00.000Z",
    type: "Task",
    title: `Item ${overrides.id}`,
    state: "Active",
    ...overrides,
  };
}

function makeAdoWorkItem(id: number, fields: Record<string, unknown>) {
  return {
    id,
    rev: 1,
    url: `https://dev.azure.com/org/proj/_apis/wit/workItems/${id}`,
    fields: {
      "System.WorkItemType": "Task",
      "System.Title": `Item ${id}`,
      "System.State": "Active",
      ...fields,
    },
  };
}

// ---------- Tests ----------

describe("handleSummary (workitems summary)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockGetLatestComment.mockResolvedValue(undefined);
  });

  it("outputs empty summary when no items match", async () => {
    mockQueryWorkItems.mockResolvedValue([]);

    await handleWorkItems(["summary"]);

    const wiql = mockQueryWorkItems.mock.calls[0][0] as string;
    expect(wiql).toContain("@today - 7");
    expect(wiql).toContain("[System.AssignedTo] = @me");
    const result = mockOutput.mock.calls[0][0];
    expect(result.period).toBe("week");
    expect(result.days).toBe(7);
    expect(result.totalItems).toBe(0);
    expect(result.allItems).toEqual([]);
  });

  it("uses 30 days for --period=month", async () => {
    mockQueryWorkItems.mockResolvedValue([]);

    await handleWorkItems(["summary", "--period=month"]);

    const wiql = mockQueryWorkItems.mock.calls[0][0] as string;
    expect(wiql).toContain("@today - 30");
    expect(wiql).toContain("[System.AssignedTo] = @me");
    const result = mockOutput.mock.calls[0][0];
    expect(result.period).toBe("month");
    expect(result.days).toBe(30);
  });

  it("appends assignedTo filter to WIQL instead of @me", async () => {
    mockQueryWorkItems.mockResolvedValue([]);

    await handleWorkItems(["summary", "--assignedTo=alice@example.com"]);

    const wiql = mockQueryWorkItems.mock.calls[0][0] as string;
    expect(wiql).toContain("[System.AssignedTo] = 'alice@example.com'");
    expect(wiql).not.toContain("@me");
    expect(wiql).toContain("@today - 7");
  });

  it("--all removes assignedTo filter", async () => {
    mockQueryWorkItems.mockResolvedValue([]);

    await handleWorkItems(["summary", "--all"]);

    const wiql = mockQueryWorkItems.mock.calls[0][0] as string;
    expect(wiql).not.toContain("AssignedTo");
  });

  it("uses custom --query when provided", async () => {
    mockQueryWorkItems.mockResolvedValue([]);

    await handleWorkItems(["summary", "--query=SELECT [System.Id] FROM WorkItems WHERE [System.State] = 'Active'"]);

    expect(mockQueryWorkItems).toHaveBeenCalledWith(
      "SELECT [System.Id] FROM WorkItems WHERE [System.State] = 'Active'",
    );
  });

  it("classifies items into completed, inProgress, blocked, new", async () => {
    const items = [
      makeItem({ id: 1, state: "Closed", type: "Task" }),
      makeItem({ id: 2, state: "Done", type: "User Story" }),
      makeItem({ id: 3, state: "Active", type: "Task" }),
      makeItem({ id: 4, state: "In Progress", type: "Task" }),
      makeItem({ id: 5, state: "Blocked", type: "Task" }),
      makeItem({ id: 6, state: "New", type: "Task" }),
      makeItem({ id: 7, state: "To Do", type: "Task" }),
      makeItem({ id: 8, state: "Active", type: "Bug" }),
    ];
    mockQueryWorkItems.mockResolvedValue(items);

    await handleWorkItems(["summary"]);

    const result = mockOutput.mock.calls[0][0];
    expect(result.totalItems).toBe(8);
    expect(result.summary.completed.count).toBe(2); // Closed + Done
    expect(result.summary.inProgress.count).toBe(2); // Active Task + In Progress Task
    expect(result.summary.blocked.count).toBe(2); // Blocked + Active Bug
    expect(result.summary.new.count).toBe(2); // New + To Do
  });

  it("groups items under their parent feature", async () => {
    const featureId = 100;
    const items = [
      makeItem({ id: 1, state: "Closed", type: "Task", parent: featureId }),
      makeItem({ id: 2, state: "Closed", type: "Task", parent: featureId }),
      makeItem({ id: 3, state: "Closed", type: "Task" }), // standalone
    ];
    mockQueryWorkItems.mockResolvedValue(items);
    mockGetWorkItem.mockResolvedValue(
      makeAdoWorkItem(featureId, {
        "System.WorkItemType": "Feature",
        "System.Title": "Login Feature",
        "System.State": "Active",
      }),
    );

    await handleWorkItems(["summary"]);

    const result = mockOutput.mock.calls[0][0];
    const completedGroups = result.summary.completed.groups;
    expect(completedGroups.length).toBe(2); // one feature group + one ungrouped

    const featureGroup = completedGroups.find(
      (g: any) => g.parent && g.parent.id === featureId,
    );
    expect(featureGroup).toBeDefined();
    expect(featureGroup.parent.title).toBe("Login Feature");
    expect(featureGroup.items.length).toBe(2);

    const ungrouped = completedGroups.find(
      (g: any) => !g.parent,
    );
    expect(ungrouped).toBeDefined();
    expect(ungrouped.items.length).toBe(1);
    expect(ungrouped.items[0].id).toBe(3);
  });

  it("fetches latest comments for each item", async () => {
    const items = [makeItem({ id: 1, state: "Active" })];
    mockQueryWorkItems.mockResolvedValue(items);
    mockGetLatestComment.mockResolvedValue("Check auth module");

    await handleWorkItems(["summary"]);

    expect(mockGetLatestComment).toHaveBeenCalledWith(1);
    const result = mockOutput.mock.calls[0][0];
    expect(result.allItems[0].latestComment).toBe("Check auth module");
  });

  it("continues when latest comment fetch fails", async () => {
    const items = [makeItem({ id: 1, state: "Active" })];
    mockQueryWorkItems.mockResolvedValue(items);
    mockGetLatestComment.mockRejectedValue(new Error("403"));

    await handleWorkItems(["summary"]);

    const result = mockOutput.mock.calls[0][0];
    expect(result.totalItems).toBe(1);
    expect(result.allItems[0].latestComment).toBeUndefined();
  });

  it("does not fetch parent if parent is already in the item set", async () => {
    const items = [
      makeItem({ id: 100, state: "Active", type: "Feature" }),
      makeItem({ id: 1, state: "Active", type: "Task", parent: 100 }),
    ];
    mockQueryWorkItems.mockResolvedValue(items);

    await handleWorkItems(["summary"]);

    // getWorkItem should NOT be called since parent 100 is in the item set
    expect(mockGetWorkItem).not.toHaveBeenCalled();

    const result = mockOutput.mock.calls[0][0];
    const inProgressGroups = result.summary.inProgress.groups;
    const featureGroup = inProgressGroups.find(
      (g: any) => g.parent && g.parent.id === 100,
    );
    expect(featureGroup).toBeDefined();
    expect(featureGroup.parent.title).toBe("Item 100");
  });

  it("includes all items in allItems array", async () => {
    const items = [
      makeItem({ id: 1, state: "Closed", type: "Task" }),
      makeItem({ id: 2, state: "Active", type: "Bug" }),
    ];
    mockQueryWorkItems.mockResolvedValue(items);

    await handleWorkItems(["summary"]);

    const result = mockOutput.mock.calls[0][0];
    expect(result.allItems.length).toBe(2);
    expect(result.allItems[0]).toEqual(expect.objectContaining({ id: 1, type: "Task", state: "Closed" }));
    expect(result.allItems[1]).toEqual(expect.objectContaining({ id: 2, type: "Bug", state: "Active" }));
  });

  it("handles parent fetch failure gracefully", async () => {
    const items = [
      makeItem({ id: 1, state: "Closed", type: "Task", parent: 999 }),
    ];
    mockQueryWorkItems.mockResolvedValue(items);
    mockGetWorkItem.mockRejectedValue(new Error("Not found"));

    await handleWorkItems(["summary"]);

    const result = mockOutput.mock.calls[0][0];
    // Item should be ungrouped since parent fetch failed
    const completedGroups = result.summary.completed.groups;
    expect(completedGroups.length).toBe(1);
    expect(completedGroups[0].parent).toBeUndefined();
  });

  it("uses --days flag to override period", async () => {
    mockQueryWorkItems.mockResolvedValue([]);

    await handleWorkItems(["summary", "--days=14"]);

    expect(mockQueryWorkItems).toHaveBeenCalledWith(
      expect.stringContaining("@today - 14"),
    );
    const result = mockOutput.mock.calls[0][0];
    expect(result.days).toBe(14);
  });

  it("--days overrides --period", async () => {
    mockQueryWorkItems.mockResolvedValue([]);

    await handleWorkItems(["summary", "--period=month", "--days=5"]);

    expect(mockQueryWorkItems).toHaveBeenCalledWith(
      expect.stringContaining("@today - 5"),
    );
    const result = mockOutput.mock.calls[0][0];
    expect(result.days).toBe(5);
  });

  it("caps results with --top flag", async () => {
    const items = Array.from({ length: 10 }, (_, i) =>
      makeItem({ id: i + 1, state: "Active", type: "Task" }),
    );
    mockQueryWorkItems.mockResolvedValue(items);

    await handleWorkItems(["summary", "--top=5"]);

    const result = mockOutput.mock.calls[0][0];
    expect(result.totalItems).toBe(5);
    expect(result.allItems.length).toBe(5);
  });

  it("sanitizes single quotes in assignedTo", async () => {
    mockQueryWorkItems.mockResolvedValue([]);

    await handleWorkItems(["summary", "--assignedTo=O'Brien"]);

    const wiql = mockQueryWorkItems.mock.calls[0][0] as string;
    expect(wiql).toContain("[System.AssignedTo] = 'O''Brien'");
  });

  it("groups multiple standalone items into one ungrouped group", async () => {
    const items = [
      makeItem({ id: 1, state: "Active", type: "Task" }),
      makeItem({ id: 2, state: "Active", type: "Task" }),
      makeItem({ id: 3, state: "Active", type: "Task" }),
    ];
    mockQueryWorkItems.mockResolvedValue(items);

    await handleWorkItems(["summary"]);

    const result = mockOutput.mock.calls[0][0];
    const inProgressGroups = result.summary.inProgress.groups;
    expect(inProgressGroups.length).toBe(1); // all in one ungrouped group
    expect(inProgressGroups[0].parent).toBeUndefined();
    expect(inProgressGroups[0].items.length).toBe(3);
  });
});
