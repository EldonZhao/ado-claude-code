import { describe, it, expect, vi, beforeEach } from "vitest";
import type { LocalWorkItemOutput } from "../../src/schemas/work-item.schema.js";

// ---------- Mocks ----------

const mockGetWorkItem = vi.fn();
const mockCreateWorkItem = vi.fn();
const mockUpdateWorkItem = vi.fn();
const mockAddComment = vi.fn();
const mockSave = vi.fn();
const mockOutput = vi.fn();
const mockFatal = vi.fn((msg: string) => { throw new Error(msg); });
const mockGetBreakdownGuidance = vi.fn();
const mockCreateBreakdownProposal = vi.fn();
const mockFormatProposal = vi.fn();

vi.mock("../../src/cli/helpers.js", () => ({
  getAdoClient: vi.fn().mockResolvedValue({
    getWorkItem: (...args: unknown[]) => mockGetWorkItem(...args),
    createWorkItem: (...args: unknown[]) => mockCreateWorkItem(...args),
    updateWorkItem: (...args: unknown[]) => mockUpdateWorkItem(...args),
    addComment: (...args: unknown[]) => mockAddComment(...args),
  }),
  getSyncStateManager: vi.fn().mockResolvedValue({
    setItemState: vi.fn().mockResolvedValue(undefined),
    save: vi.fn().mockResolvedValue(undefined),
  }),
  mapAdoToLocal: vi.fn((ado: any) => ado as LocalWorkItemOutput),
  formatWorkItemSummary: vi.fn(),
  output: (...args: unknown[]) => mockOutput(...args),
  fatal: (msg: string) => mockFatal(msg),
  parseFlags: vi.fn((args: string[]) => {
    const flags: Record<string, string> = {};
    for (const arg of args) {
      if (arg.startsWith("--")) {
        const eq = arg.indexOf("=");
        if (eq !== -1) {
          flags[arg.slice(2, eq)] = arg.slice(eq + 1);
        } else {
          flags[arg.slice(2)] = "true";
        }
      }
    }
    return flags;
  }),
}));

vi.mock("../../src/storage/index.js", () => ({
  getWorkItemStorage: vi.fn().mockResolvedValue({
    save: (...args: unknown[]) => mockSave(...args),
  }),
}));

vi.mock("../../src/services/planning/code-plan.js", () => ({
  getCodePlanGuidance: vi.fn(),
}));

vi.mock("../../src/services/planning/templates.js", () => ({
  HIERARCHY: {
    Epic: ["Feature"],
    Feature: ["User Story"],
    "User Story": ["Task"],
    Task: ["Task"],
    Bug: ["Task"],
  },
}));

vi.mock("../../src/services/planning/breakdown.js", () => ({
  createBreakdownProposal: (...args: unknown[]) => mockCreateBreakdownProposal(...args),
  formatProposal: (...args: unknown[]) => mockFormatProposal(...args),
  getBreakdownGuidance: (...args: unknown[]) => mockGetBreakdownGuidance(...args),
}));

import { handleWorkItems } from "../../src/cli/work-items.js";

// ---------- Helpers ----------

function makeItem(overrides?: Partial<LocalWorkItemOutput>): LocalWorkItemOutput {
  return {
    id: 200,
    rev: 1,
    url: "https://dev.azure.com/org/proj/_apis/wit/workItems/200",
    syncedAt: "2026-03-04T00:00:00.000Z",
    type: "User Story",
    title: "Story to break down",
    state: "Active",
    ...overrides,
  };
}

// ---------- Tests ----------

describe("handleWorkitemPlan (work-items workitem-plan)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  // ---- Routing ----

  it("routes 'workitem-plan' action to the handler", async () => {
    const parent = makeItem();
    mockGetWorkItem.mockResolvedValue(parent);
    mockGetBreakdownGuidance.mockReturnValue("guidance text");

    await handleWorkItems(["workitem-plan", "200"]);

    expect(mockGetWorkItem).toHaveBeenCalledWith(200, "relations");
    expect(mockOutput).toHaveBeenCalledWith({
      parent: { id: 200, type: "User Story", title: "Story to break down" },
      guidance: "guidance text",
    });
  });

  it("routes 'task-plan' alias to the same handler", async () => {
    const parent = makeItem();
    mockGetWorkItem.mockResolvedValue(parent);
    mockGetBreakdownGuidance.mockReturnValue("guidance text");

    await handleWorkItems(["task-plan", "200"]);

    expect(mockGetWorkItem).toHaveBeenCalledWith(200, "relations");
    expect(mockOutput).toHaveBeenCalled();
  });

  // ---- Validation ----

  it("fatals when no ID provided", async () => {
    await expect(handleWorkItems(["workitem-plan"])).rejects.toThrow(
      "Usage: work-items workitem-plan",
    );
  });

  it("fatals for non-numeric ID", async () => {
    await expect(handleWorkItems(["workitem-plan", "abc"])).rejects.toThrow(
      "Invalid work item ID: abc",
    );
  });

  // ---- Guidance mode (no --items) ----

  it("returns guidance when no --items provided", async () => {
    const parent = makeItem({ type: "Epic", title: "Big epic" });
    mockGetWorkItem.mockResolvedValue(parent);
    mockGetBreakdownGuidance.mockReturnValue("Break this Epic into Features");

    await handleWorkItems(["workitem-plan", "200"]);

    expect(mockGetBreakdownGuidance).toHaveBeenCalledWith(parent);
    expect(mockOutput).toHaveBeenCalledWith({
      parent: { id: 200, type: "Epic", title: "Big epic" },
      guidance: "Break this Epic into Features",
    });
  });

  it("returns guidance for Task→Task breakdown", async () => {
    const parent = makeItem({ type: "Task", title: "Parent task" });
    mockGetWorkItem.mockResolvedValue(parent);
    mockGetBreakdownGuidance.mockReturnValue("Break this Task into sub-tasks");

    await handleWorkItems(["workitem-plan", "200"]);

    expect(mockGetBreakdownGuidance).toHaveBeenCalledWith(parent);
    expect(mockOutput).toHaveBeenCalledWith({
      parent: { id: 200, type: "Task", title: "Parent task" },
      guidance: "Break this Task into sub-tasks",
    });
  });

  // ---- Preview mode (--items without --create) ----

  it("returns preview when --items provided without --create", async () => {
    const parent = makeItem({ type: "Feature" });
    mockGetWorkItem.mockResolvedValue(parent);

    const proposalObj = {
      parent: { id: 200, type: "Feature", title: "Story to break down" },
      childType: "User Story",
      items: [{ type: "User Story", title: "Story 1" }],
      hierarchyPath: "Feature → User Story",
    };
    mockCreateBreakdownProposal.mockReturnValue(proposalObj);
    mockFormatProposal.mockReturnValue("## Formatted proposal");

    const items = JSON.stringify([{ type: "User Story", title: "Story 1" }]);
    await handleWorkItems(["workitem-plan", "200", `--items=${items}`]);

    expect(mockCreateBreakdownProposal).toHaveBeenCalled();
    expect(mockFormatProposal).toHaveBeenCalledWith(proposalObj);
    expect(mockOutput).toHaveBeenCalledWith({
      preview: true,
      proposal: "## Formatted proposal",
      items: proposalObj.items,
    });
  });

  it("preview works for Task→Task items", async () => {
    const parent = makeItem({ type: "Task", title: "Parent task" });
    mockGetWorkItem.mockResolvedValue(parent);

    const proposalObj = {
      parent: { id: 200, type: "Task", title: "Parent task" },
      childType: "Task",
      items: [{ type: "Task", title: "Sub-task 1" }, { type: "Task", title: "Sub-task 2" }],
      hierarchyPath: "Task → Task",
    };
    mockCreateBreakdownProposal.mockReturnValue(proposalObj);
    mockFormatProposal.mockReturnValue("## Task breakdown");

    const items = JSON.stringify([{ type: "Task", title: "Sub-task 1" }, { type: "Task", title: "Sub-task 2" }]);
    await handleWorkItems(["workitem-plan", "200", `--items=${items}`]);

    expect(mockOutput).toHaveBeenCalledWith({
      preview: true,
      proposal: "## Task breakdown",
      items: proposalObj.items,
    });
  });

  // ---- Create mode (--items --create) ----

  it("creates items in ADO when --create is passed", async () => {
    const parent = makeItem({ type: "Epic" });
    mockGetWorkItem.mockResolvedValue(parent);

    const proposalObj = {
      parent: { id: 200, type: "Epic", title: "Story to break down" },
      childType: "Feature",
      items: [
        { type: "Feature", title: "Feature A", description: "Desc A", priority: 2 },
        { type: "Feature", title: "Feature B" },
      ],
      hierarchyPath: "Epic → Feature",
    };
    mockCreateBreakdownProposal.mockReturnValue(proposalObj);

    let createCallCount = 0;
    mockCreateWorkItem.mockImplementation(() => {
      createCallCount++;
      return Promise.resolve(
        makeItem({ id: 300 + createCallCount, type: "Feature", title: `Feature ${createCallCount}` }),
      );
    });

    const items = JSON.stringify([{ type: "Feature", title: "Feature A" }, { type: "Feature", title: "Feature B" }]);
    await handleWorkItems(["workitem-plan", "200", `--items=${items}`, "--create"]);

    expect(mockCreateWorkItem).toHaveBeenCalledTimes(2);
    expect(mockCreateWorkItem).toHaveBeenCalledWith(
      expect.objectContaining({ type: "Feature", title: "Feature A", parentId: 200 }),
    );
    expect(mockCreateWorkItem).toHaveBeenCalledWith(
      expect.objectContaining({ type: "Feature", title: "Feature B", parentId: 200 }),
    );

    const outputArg = mockOutput.mock.calls[0][0];
    expect(outputArg.created).toBe(2);
    expect(outputArg.items).toHaveLength(2);
  });

  it("creates nested children with correct parentId", async () => {
    const parent = makeItem({ type: "Feature" });
    mockGetWorkItem.mockResolvedValue(parent);

    const proposalObj = {
      parent: { id: 200, type: "Feature", title: "Story to break down" },
      childType: "User Story",
      items: [
        {
          type: "User Story",
          title: "Story A",
          children: [
            { type: "Task", title: "Task 1" },
            { type: "Task", title: "Task 2" },
          ],
        },
      ],
      hierarchyPath: "Feature → User Story",
    };
    mockCreateBreakdownProposal.mockReturnValue(proposalObj);

    let createCallCount = 0;
    mockCreateWorkItem.mockImplementation((data: any) => {
      createCallCount++;
      // First call creates the story (id=300), subsequent calls create tasks
      const id = 300 + createCallCount;
      return Promise.resolve(makeItem({ id, type: data.type, title: data.title }));
    });

    const items = JSON.stringify([{
      type: "User Story",
      title: "Story A",
      children: [{ type: "Task", title: "Task 1" }, { type: "Task", title: "Task 2" }],
    }]);
    await handleWorkItems(["workitem-plan", "200", `--items=${items}`, "--create"]);

    // 1 story + 2 tasks = 3 calls
    expect(mockCreateWorkItem).toHaveBeenCalledTimes(3);

    // Story is created with parent.id as parentId
    expect(mockCreateWorkItem).toHaveBeenNthCalledWith(1,
      expect.objectContaining({ type: "User Story", title: "Story A", parentId: 200 }),
    );

    // Tasks are created with the story's ADO id as parentId
    expect(mockCreateWorkItem).toHaveBeenNthCalledWith(2,
      expect.objectContaining({ type: "Task", title: "Task 1", parentId: 301 }),
    );
    expect(mockCreateWorkItem).toHaveBeenNthCalledWith(3,
      expect.objectContaining({ type: "Task", title: "Task 2", parentId: 301 }),
    );

    const outputArg = mockOutput.mock.calls[0][0];
    expect(outputArg.created).toBe(3);
  });

  it("handles child creation failure gracefully", async () => {
    const parent = makeItem({ type: "Feature" });
    mockGetWorkItem.mockResolvedValue(parent);

    const proposalObj = {
      parent: { id: 200, type: "Feature", title: "Story to break down" },
      childType: "User Story",
      items: [
        {
          type: "User Story",
          title: "Story A",
          children: [
            { type: "Task", title: "Task OK" },
            { type: "Task", title: "Task Fail" },
          ],
        },
      ],
      hierarchyPath: "Feature → User Story",
    };
    mockCreateBreakdownProposal.mockReturnValue(proposalObj);

    let createCallCount = 0;
    mockCreateWorkItem.mockImplementation((data: any) => {
      createCallCount++;
      if (data.title === "Task Fail") {
        return Promise.reject(new Error("ADO 500"));
      }
      return Promise.resolve(makeItem({ id: 300 + createCallCount, type: data.type, title: data.title }));
    });

    const stderrSpy = vi.spyOn(process.stderr, "write").mockImplementation(() => true);

    const items = JSON.stringify([{
      type: "User Story",
      title: "Story A",
      children: [{ type: "Task", title: "Task OK" }, { type: "Task", title: "Task Fail" }],
    }]);
    await handleWorkItems(["workitem-plan", "200", `--items=${items}`, "--create"]);

    expect(stderrSpy).toHaveBeenCalledWith(expect.stringContaining('Warning: Failed to create child "Task Fail"'));

    // Story + 1 successful task = 2 created
    const outputArg = mockOutput.mock.calls[0][0];
    expect(outputArg.created).toBe(2);

    stderrSpy.mockRestore();
  });

  it("saves parent to storage on fetch", async () => {
    const parent = makeItem();
    mockGetWorkItem.mockResolvedValue(parent);
    mockGetBreakdownGuidance.mockReturnValue("guidance");

    await handleWorkItems(["workitem-plan", "200"]);

    expect(mockSave).toHaveBeenCalledWith(parent);
  });

  // ---- State transition & comment side effects ----

  it("transitions New → In Progress and adds comment", async () => {
    const parent = makeItem({ state: "New" });
    const updatedParent = makeItem({ state: "In Progress" });
    mockGetWorkItem.mockResolvedValue(parent);
    mockUpdateWorkItem.mockResolvedValue(updatedParent);
    mockAddComment.mockResolvedValue({ id: 1, text: "comment" });
    mockGetBreakdownGuidance.mockReturnValue("guidance text");

    await handleWorkItems(["workitem-plan", "200"]);

    expect(mockUpdateWorkItem).toHaveBeenCalledWith({ id: 200, state: "In Progress" });
    expect(mockAddComment).toHaveBeenCalledWith(200, expect.stringContaining("Work item breakdown plan generated by Claude at"));

    const outputArg = mockOutput.mock.calls[0][0];
    expect(outputArg.stateChange).toEqual({ from: "New", to: "In Progress" });
    expect(outputArg.commentAdded).toBeDefined();
    expect(outputArg.guidance).toBe("guidance text");
  });

  it("skips update with --no-update", async () => {
    const parent = makeItem({ state: "New" });
    mockGetWorkItem.mockResolvedValue(parent);
    mockGetBreakdownGuidance.mockReturnValue("guidance text");

    await handleWorkItems(["workitem-plan", "200", "--no-update"]);

    expect(mockUpdateWorkItem).not.toHaveBeenCalled();
    expect(mockAddComment).not.toHaveBeenCalled();

    const outputArg = mockOutput.mock.calls[0][0];
    expect(outputArg.updatesSkipped).toBe(true);
    expect(outputArg.stateChange).toBeUndefined();
  });

  it("does not transition Active state (not eligible)", async () => {
    const parent = makeItem({ state: "Active" });
    mockGetWorkItem.mockResolvedValue(parent);
    mockAddComment.mockResolvedValue({ id: 1, text: "comment" });
    mockGetBreakdownGuidance.mockReturnValue("guidance");

    await handleWorkItems(["workitem-plan", "200"]);

    expect(mockUpdateWorkItem).not.toHaveBeenCalled();
    expect(mockAddComment).toHaveBeenCalled();

    const outputArg = mockOutput.mock.calls[0][0];
    expect(outputArg.stateChange).toBeUndefined();
  });

  it("posts summary comment when --create creates children", async () => {
    const parent = makeItem({ type: "Epic", state: "Active" });
    mockGetWorkItem.mockResolvedValue(parent);
    mockAddComment.mockResolvedValue({ id: 1, text: "comment" });

    const proposalObj = {
      parent: { id: 200, type: "Epic", title: "Story to break down" },
      childType: "Feature",
      items: [
        { type: "Feature", title: "Feature A" },
      ],
      hierarchyPath: "Epic → Feature",
    };
    mockCreateBreakdownProposal.mockReturnValue(proposalObj);

    let createCallCount = 0;
    mockCreateWorkItem.mockImplementation(() => {
      createCallCount++;
      return Promise.resolve(
        makeItem({ id: 300 + createCallCount, type: "Feature", title: `Feature ${createCallCount}` }),
      );
    });

    const items = JSON.stringify([{ type: "Feature", title: "Feature A" }]);
    await handleWorkItems(["workitem-plan", "200", `--items=${items}`, "--create"]);

    // Should have 2 addComment calls: one for the plan, one for create summary
    expect(mockAddComment).toHaveBeenCalledTimes(2);
    expect(mockAddComment).toHaveBeenCalledWith(200, expect.stringContaining("Created 1 child item(s):"));
  });

  it("non-blocking: state update failure doesn't prevent guidance output", async () => {
    const parent = makeItem({ state: "New" });
    mockGetWorkItem.mockResolvedValue(parent);
    mockUpdateWorkItem.mockRejectedValue(new Error("ADO 500"));
    mockAddComment.mockResolvedValue({ id: 1, text: "comment" });
    mockGetBreakdownGuidance.mockReturnValue("guidance text");

    const stderrSpy = vi.spyOn(process.stderr, "write").mockImplementation(() => true);

    await handleWorkItems(["workitem-plan", "200"]);

    expect(stderrSpy).toHaveBeenCalledWith(expect.stringContaining("Warning: Failed to update state"));
    const outputArg = mockOutput.mock.calls[0][0];
    expect(outputArg.guidance).toBe("guidance text");
    expect(outputArg.stateChange).toBeUndefined();

    stderrSpy.mockRestore();
  });
});
