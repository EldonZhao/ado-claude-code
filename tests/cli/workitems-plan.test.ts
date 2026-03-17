import { describe, it, expect, vi, beforeEach } from "vitest";
import type { LocalWorkItemOutput } from "../../src/schemas/workitem.schema.js";

// ---------- Mocks ----------

const mockGetWorkItem = vi.fn();
const mockUpdateWorkItem = vi.fn();
const mockAddComment = vi.fn();
const mockGetTerminalState = vi.fn();
const mockGetLatestComment = vi.fn();
const mockSave = vi.fn();
const mockLoadById = vi.fn();
const mockOutput = vi.fn();
const mockFatal = vi.fn((msg: string) => { throw new Error(msg); });
const mockGetItemState = vi.fn();
const mockSetItemState = vi.fn();
const mockStateSave = vi.fn();

vi.mock("../../src/cli/helpers.js", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../../src/cli/helpers.js")>();
  return {
    getAdoClient: vi.fn().mockResolvedValue({
      getWorkItem: (...args: unknown[]) => mockGetWorkItem(...args),
      updateWorkItem: (...args: unknown[]) => mockUpdateWorkItem(...args),
      addComment: (...args: unknown[]) => mockAddComment(...args),
      getTerminalState: (...args: unknown[]) => mockGetTerminalState(...args),
      getLatestComment: (...args: unknown[]) => mockGetLatestComment(...args),
    }),
    getSyncStateManager: vi.fn().mockResolvedValue({
      getItemState: (...args: unknown[]) => mockGetItemState(...args),
      setItemState: (...args: unknown[]) => mockSetItemState(...args),
      save: (...args: unknown[]) => mockStateSave(...args),
    }),
    mapAdoToLocal: vi.fn((ado: any, latestComment?: string) => {
      const result = { ...ado } as LocalWorkItemOutput;
      if (latestComment !== undefined) result.latestComment = latestComment;
      return result;
    }),
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
    markdownToHtml: actual.markdownToHtml,
    checkHelp: vi.fn(),
  };
});

vi.mock("../../src/storage/index.js", () => ({
  getWorkItemStorage: vi.fn().mockResolvedValue({
    save: (...args: unknown[]) => mockSave(...args),
    loadById: (...args: unknown[]) => mockLoadById(...args),
  }),
}));

vi.mock("../../src/services/planning/code-plan.js", () => ({
  getCodePlanGuidance: vi.fn(() => "## Code Plan Guidance\nMocked guidance"),
}));

const mockLoadConfig = vi.fn();
vi.mock("../../src/storage/config.js", () => ({
  loadConfig: (...args: unknown[]) => mockLoadConfig(...args),
}));

const mockDetectRepos = vi.fn();
vi.mock("../../src/services/planning/repo-detection.js", () => ({
  detectRepos: (...args: unknown[]) => mockDetectRepos(...args),
}));

vi.mock("../../src/services/sync/mapper.js", () => ({
  adoToLocal: vi.fn((ado: any, latestComment?: string) => {
    const result = { ...ado } as LocalWorkItemOutput;
    if (latestComment !== undefined) result.latestComment = latestComment;
    return result;
  }),
  localToAdoPatch: vi.fn(() => [{ op: "replace", path: "/fields/System.Title", value: "Updated" }]),
  serializeForHash: vi.fn(() => "mock-serialized"),
}));

vi.mock("../../src/services/sync/state.js", () => ({
  SyncStateManager: {
    computeHash: vi.fn(() => "different-hash"),
  },
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
import { SyncStateManager } from "../../src/services/sync/state.js";
import { localToAdoPatch } from "../../src/services/sync/mapper.js";

// ---------- Helpers ----------

function makeAdoItem(overrides?: Partial<LocalWorkItemOutput>): LocalWorkItemOutput {
  return {
    id: 100,
    rev: 1,
    url: "https://dev.azure.com/org/proj/_apis/wit/workItems/100",
    syncedAt: "2026-03-04T00:00:00.000Z",
    type: "User Story",
    title: "Implement feature X",
    state: "New",
    ...overrides,
  };
}

// ---------- Tests ----------

describe("handlePlan (workitems plan) state updates", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockGetLatestComment.mockResolvedValue(undefined);
  });

  it("transitions from New to In Progress", async () => {
    const item = makeAdoItem({ state: "New" });
    const updatedItem = { ...item, state: "In Progress" };
    mockGetWorkItem.mockResolvedValue(item);
    mockUpdateWorkItem.mockResolvedValue(updatedItem);

    await handleWorkItems(["plan", "100"]);

    expect(mockUpdateWorkItem).toHaveBeenCalledWith({ id: 100, state: "In Progress" });
    expect(mockAddComment).not.toHaveBeenCalled();
    const outputArg = mockOutput.mock.calls[0][0];
    expect(outputArg.stateChange).toEqual({ from: "New", to: "In Progress" });
    expect(outputArg.commentAdded).toBeUndefined();
    expect(outputArg.parent.state).toBe("In Progress");
    expect(outputArg.codePlan).toBeDefined();
  });

  it("transitions from To Do to In Progress", async () => {
    const item = makeAdoItem({ state: "To Do" });
    const updatedItem = { ...item, state: "In Progress" };
    mockGetWorkItem.mockResolvedValue(item);
    mockUpdateWorkItem.mockResolvedValue(updatedItem);

    await handleWorkItems(["plan", "100"]);

    expect(mockUpdateWorkItem).toHaveBeenCalledWith({ id: 100, state: "In Progress" });
    const outputArg = mockOutput.mock.calls[0][0];
    expect(outputArg.stateChange).toEqual({ from: "To Do", to: "In Progress" });
  });

  it("transitions from Proposed to In Progress", async () => {
    const item = makeAdoItem({ state: "Proposed" });
    const updatedItem = { ...item, state: "In Progress" };
    mockGetWorkItem.mockResolvedValue(item);
    mockUpdateWorkItem.mockResolvedValue(updatedItem);

    await handleWorkItems(["plan", "100"]);

    expect(mockUpdateWorkItem).toHaveBeenCalledWith({ id: 100, state: "In Progress" });
    const outputArg = mockOutput.mock.calls[0][0];
    expect(outputArg.stateChange).toEqual({ from: "Proposed", to: "In Progress" });
  });

  it("transitions from Approved to In Progress", async () => {
    const item = makeAdoItem({ state: "Approved" });
    const updatedItem = { ...item, state: "In Progress" };
    mockGetWorkItem.mockResolvedValue(item);
    mockUpdateWorkItem.mockResolvedValue(updatedItem);

    await handleWorkItems(["plan", "100"]);

    expect(mockUpdateWorkItem).toHaveBeenCalledWith({ id: 100, state: "In Progress" });
    const outputArg = mockOutput.mock.calls[0][0];
    expect(outputArg.stateChange).toEqual({ from: "Approved", to: "In Progress" });
  });

  it("skips state change when already In Progress, does not add comment", async () => {
    const item = makeAdoItem({ state: "In Progress" });
    mockGetWorkItem.mockResolvedValue(item);

    await handleWorkItems(["plan", "100"]);

    expect(mockUpdateWorkItem).not.toHaveBeenCalled();
    expect(mockAddComment).not.toHaveBeenCalled();
    const outputArg = mockOutput.mock.calls[0][0];
    expect(outputArg.stateChange).toBeUndefined();
    expect(outputArg.commentAdded).toBeUndefined();
    expect(outputArg.parent.state).toBe("In Progress");
  });

  it("skips state change when in Active state, does not add comment", async () => {
    const item = makeAdoItem({ state: "Active" });
    mockGetWorkItem.mockResolvedValue(item);

    await handleWorkItems(["plan", "100"]);

    expect(mockUpdateWorkItem).not.toHaveBeenCalled();
    expect(mockAddComment).not.toHaveBeenCalled();
    const outputArg = mockOutput.mock.calls[0][0];
    expect(outputArg.stateChange).toBeUndefined();
  });

  it("--no-update skips state change", async () => {
    const item = makeAdoItem({ state: "New" });
    mockGetWorkItem.mockResolvedValue(item);

    await handleWorkItems(["plan", "100", "--no-update"]);

    expect(mockUpdateWorkItem).not.toHaveBeenCalled();
    expect(mockAddComment).not.toHaveBeenCalled();
    const outputArg = mockOutput.mock.calls[0][0];
    expect(outputArg.updatesSkipped).toBe(true);
    expect(outputArg.stateChange).toBeUndefined();
    expect(outputArg.codePlan).toBeDefined();
  });

  it("still returns guidance when updateWorkItem fails", async () => {
    const item = makeAdoItem({ state: "New" });
    mockGetWorkItem.mockResolvedValue(item);
    mockUpdateWorkItem.mockRejectedValue(new Error("ADO 403"));

    const stderrSpy = vi.spyOn(process.stderr, "write").mockImplementation(() => true);

    await handleWorkItems(["plan", "100"]);

    expect(stderrSpy).toHaveBeenCalledWith(expect.stringContaining("Warning: Failed to update state"));
    const outputArg = mockOutput.mock.calls[0][0];
    expect(outputArg.stateChange).toBeUndefined();
    expect(outputArg.codePlan).toBeDefined();

    stderrSpy.mockRestore();
  });

  it("output includes parent.state field", async () => {
    const item = makeAdoItem({ state: "Active" });
    mockGetWorkItem.mockResolvedValue(item);

    await handleWorkItems(["plan", "100"]);

    const outputArg = mockOutput.mock.calls[0][0];
    expect(outputArg.parent).toHaveProperty("state", "Active");
    expect(outputArg.parent).toHaveProperty("id", 100);
    expect(outputArg.parent).toHaveProperty("type", "User Story");
    expect(outputArg.parent).toHaveProperty("title", "Implement feature X");
  });
});

describe("handlePlan bidirectional sync (local → ADO push)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // Default: no local sync state (skip push)
    mockGetItemState.mockResolvedValue(null);
    mockLoadById.mockResolvedValue(null);
    mockGetLatestComment.mockResolvedValue(undefined);
  });

  it("pushes local modifications to ADO before fetching", async () => {
    const originalItem = makeAdoItem({ state: "In Progress", title: "Original title" });
    const localItem = makeAdoItem({ state: "In Progress", title: "Updated locally" });

    // Sync state exists with a different hash (local was modified)
    mockGetItemState.mockResolvedValue({
      localPath: "/mock/path.yaml",
      adoRev: 1,
      localHash: "old-hash",
      lastSyncedAt: "2026-03-04T00:00:00.000Z",
      syncStatus: "synced",
    });
    mockLoadById.mockResolvedValue(localItem);
    // SyncStateManager.computeHash returns "different-hash" by default (≠ "old-hash")

    // First getWorkItem call: for rev check in push logic
    // Second getWorkItem call: for main fetch after push
    mockGetWorkItem
      .mockResolvedValueOnce(originalItem) // rev check
      .mockResolvedValueOnce({ ...localItem, rev: 2 }); // fresh fetch after push
    mockUpdateWorkItem.mockResolvedValue({ ...localItem, rev: 2 });
    mockAddComment.mockResolvedValue({ id: 1, text: "comment" });

    await handleWorkItems(["plan", "100"]);

    // Should have called updateWorkItem for the push (first call)
    // and possibly for the state transition
    expect(mockUpdateWorkItem).toHaveBeenCalled();
    const firstUpdateCall = mockUpdateWorkItem.mock.calls[0][0];
    expect(firstUpdateCall.id).toBe(100);
    // Plan still completes
    const outputArg = mockOutput.mock.calls[0][0];
    expect(outputArg.codePlan).toBeDefined();
  });

  it("skips push when no local sync state exists", async () => {
    const item = makeAdoItem({ state: "In Progress" });
    mockGetItemState.mockResolvedValue(null);
    mockGetWorkItem.mockResolvedValue(item);
    mockAddComment.mockResolvedValue({ id: 1, text: "comment" });

    await handleWorkItems(["plan", "100"]);

    // getWorkItem called once (main fetch only, no rev check)
    expect(mockGetWorkItem).toHaveBeenCalledTimes(1);
    const outputArg = mockOutput.mock.calls[0][0];
    expect(outputArg.codePlan).toBeDefined();
  });

  it("skips push when local hash matches (no local changes)", async () => {
    const item = makeAdoItem({ state: "In Progress" });
    const localItem = makeAdoItem({ state: "In Progress" });

    mockGetItemState.mockResolvedValue({
      localPath: "/mock/path.yaml",
      adoRev: 1,
      localHash: "different-hash", // matches what computeHash returns
      lastSyncedAt: "2026-03-04T00:00:00.000Z",
      syncStatus: "synced",
    });
    mockLoadById.mockResolvedValue(localItem);
    mockGetWorkItem.mockResolvedValue(item);
    mockAddComment.mockResolvedValue({ id: 1, text: "comment" });

    await handleWorkItems(["plan", "100"]);

    // getWorkItem called once (main fetch only)
    expect(mockGetWorkItem).toHaveBeenCalledTimes(1);
  });

  it("push failure is non-blocking — plan still works", async () => {
    const item = makeAdoItem({ state: "In Progress" });

    // Sync state exists, local file exists, hash differs
    mockGetItemState.mockResolvedValue({
      localPath: "/mock/path.yaml",
      adoRev: 1,
      localHash: "old-hash",
      lastSyncedAt: "2026-03-04T00:00:00.000Z",
      syncStatus: "synced",
    });
    mockLoadById.mockResolvedValue(makeAdoItem({ title: "Modified" }));
    // getWorkItem throws on the rev-check call inside the push try/catch
    mockGetWorkItem
      .mockRejectedValueOnce(new Error("Network error"))
      .mockResolvedValueOnce(item); // second call: main fetch
    mockAddComment.mockResolvedValue({ id: 1, text: "comment" });

    const stderrSpy = vi.spyOn(process.stderr, "write").mockImplementation(() => true);

    await handleWorkItems(["plan", "100"]);

    expect(stderrSpy).toHaveBeenCalledWith(expect.stringContaining("Warning: Failed to push local changes"));
    const outputArg = mockOutput.mock.calls[0][0];
    expect(outputArg.codePlan).toBeDefined();

    stderrSpy.mockRestore();
  });

  it("skips push when remote has newer revision (conflict)", async () => {
    const localItem = makeAdoItem({ state: "In Progress", title: "Local edit" });
    const remoteItem = makeAdoItem({ state: "In Progress", title: "Remote edit", rev: 5 });

    mockGetItemState.mockResolvedValue({
      localPath: "/mock/path.yaml",
      adoRev: 1, // baseline was rev 1
      localHash: "old-hash",
      lastSyncedAt: "2026-03-04T00:00:00.000Z",
      syncStatus: "synced",
    });
    mockLoadById.mockResolvedValue(localItem);
    // Remote has rev 5 > adoRev 1 → conflict, skip push
    mockGetWorkItem
      .mockResolvedValueOnce(remoteItem) // rev check — rev 5 > 1
      .mockResolvedValueOnce(remoteItem); // main fetch
    mockAddComment.mockResolvedValue({ id: 1, text: "comment" });

    await handleWorkItems(["plan", "100"]);

    // updateWorkItem should NOT have been called for push (conflict)
    // It may be called for state transition if applicable
    expect(mockUpdateWorkItem).not.toHaveBeenCalled();
    const outputArg = mockOutput.mock.calls[0][0];
    expect(outputArg.codePlan).toBeDefined();
  });
});

describe("handleUpdate --complete --comment", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockGetItemState.mockResolvedValue(null);
    mockGetLatestComment.mockResolvedValue(undefined);
  });

  it("merges user comment into completion comment", async () => {
    const item = makeAdoItem({ state: "Active" });
    const completedItem = { ...item, state: "Closed" };
    mockGetWorkItem.mockResolvedValue(item);
    mockGetTerminalState.mockResolvedValue("Closed");
    mockUpdateWorkItem.mockResolvedValue(completedItem);
    mockAddComment.mockResolvedValue({ id: 10, text: "merged" });

    await handleWorkItems(["update", "100", "--complete", "--comment=<h4>Summary</h4><p>All done</p>"]);

    // Comment should contain both the auto-generated completion text AND the user's comment
    expect(mockAddComment).toHaveBeenCalledTimes(1);
    const commentArg = mockAddComment.mock.calls[0][1];
    expect(commentArg).toContain("Work item marked as completed by Claude");
    expect(commentArg).toContain("<hr>");
    expect(commentArg).toContain("<h4>Summary</h4><p>All done</p>");
  });

  it("--complete without --comment posts only auto completion text", async () => {
    const item = makeAdoItem({ state: "Active" });
    const completedItem = { ...item, state: "Closed" };
    mockGetWorkItem.mockResolvedValue(item);
    mockGetTerminalState.mockResolvedValue("Closed");
    mockUpdateWorkItem.mockResolvedValue(completedItem);
    mockAddComment.mockResolvedValue({ id: 11, text: "auto" });

    await handleWorkItems(["update", "100", "--complete"]);

    const commentArg = mockAddComment.mock.calls[0][1];
    expect(commentArg).toContain("Work item marked as completed by Claude");
    expect(commentArg).not.toContain("<hr>");
  });
});

describe("handlePlan latestComment integration", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockGetItemState.mockResolvedValue(null);
    mockLoadById.mockResolvedValue(null);
    mockGetLatestComment.mockResolvedValue(undefined);
  });

  it("fetches latestComment and includes it in the mapped item", async () => {
    const item = makeAdoItem({ state: "In Progress" });
    mockGetWorkItem.mockResolvedValue(item);
    mockGetLatestComment.mockResolvedValue("Check the auth module");
    mockAddComment.mockResolvedValue({ id: 1, text: "comment" });

    await handleWorkItems(["plan", "100"]);

    // getLatestComment should have been called
    expect(mockGetLatestComment).toHaveBeenCalledWith(100);
    // mapAdoToLocal should have received the comment
    const { mapAdoToLocal } = await import("../../src/cli/helpers.js");
    expect(mapAdoToLocal).toHaveBeenCalledWith(item, "Check the auth module");
  });

  it("pushes locally modified latestComment as new ADO comment", async () => {
    const originalItem = makeAdoItem({ state: "In Progress" });
    const localItem = { ...makeAdoItem({ state: "In Progress" }), latestComment: "New feedback from local" };

    mockGetItemState.mockResolvedValue({
      localPath: "/mock/path.yaml",
      adoRev: 1,
      localHash: "old-hash",
      lastSyncedAt: "2026-03-04T00:00:00.000Z",
      syncStatus: "synced",
    });
    mockLoadById.mockResolvedValue(localItem);

    mockGetWorkItem
      .mockResolvedValueOnce(originalItem) // rev check
      .mockResolvedValueOnce({ ...originalItem, rev: 2 }); // fresh fetch
    mockUpdateWorkItem.mockResolvedValue({ ...originalItem, rev: 2 });
    mockGetLatestComment.mockResolvedValue(undefined);
    mockAddComment.mockResolvedValue({ id: 1, text: "comment" });

    await handleWorkItems(["plan", "100"]);

    // addComment should have been called for the locally edited comment (first call)
    // and for the plan comment (second call)
    const commentCalls = mockAddComment.mock.calls.filter(
      (call: unknown[]) => call[0] === 100
    );
    const commentTexts = commentCalls.map((c: unknown[]) => c[1]);
    expect(commentTexts).toContain("New feedback from local");
  });

  it("does not push latestComment when it matches baseline", async () => {
    const originalItem = makeAdoItem({ state: "In Progress" });
    const localItem = { ...makeAdoItem({ state: "In Progress" }), latestComment: "Same comment" };

    mockGetItemState.mockResolvedValue({
      localPath: "/mock/path.yaml",
      adoRev: 1,
      localHash: "old-hash",
      lastSyncedAt: "2026-03-04T00:00:00.000Z",
      syncStatus: "synced",
    });
    mockLoadById.mockResolvedValue(localItem);

    mockGetWorkItem
      .mockResolvedValueOnce(originalItem) // rev check
      .mockResolvedValueOnce({ ...originalItem, rev: 2 }); // fresh fetch
    mockUpdateWorkItem.mockResolvedValue({ ...originalItem, rev: 2 });
    // adoToLocal mock returns item without latestComment by default,
    // but mapAdoToLocal is mocked to pass through, so baseline.latestComment = undefined
    // localItem.latestComment = "Same comment" → different, so it WILL push
    // To test that same comment is NOT pushed, we'd need the baseline to match
    mockGetLatestComment.mockResolvedValue("Same comment");
    mockAddComment.mockResolvedValue({ id: 1, text: "comment" });

    await handleWorkItems(["plan", "100"]);

    // addComment first call should NOT be "Same comment" (it matches baseline)
    // Only the plan comment should be added
    const commentCalls = mockAddComment.mock.calls.filter(
      (call: unknown[]) => call[0] === 100
    );
    const commentTexts = commentCalls.map((c: unknown[]) => c[1] as string);
    expect(commentTexts.every((t: string) => t !== "Same comment")).toBe(true);
  });
});

describe("handlePlan multi-repo support", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockGetItemState.mockResolvedValue(null);
    mockLoadById.mockResolvedValue(null);
    mockGetLatestComment.mockResolvedValue(undefined);
    mockLoadConfig.mockRejectedValue(new Error("no config"));
    mockDetectRepos.mockReturnValue([]);
  });

  it("includes repos in output when repos configured and detected", async () => {
    const item = makeAdoItem({
      state: "In Progress",
      description: "- backend: Add auth\n- frontend: Add login page",
    });
    mockGetWorkItem.mockResolvedValue(item);
    mockAddComment.mockResolvedValue({ id: 1, text: "comment" });

    mockLoadConfig.mockResolvedValue({
      repos: {
        backend: { path: "/projects/backend" },
        frontend: { path: "/projects/frontend" },
      },
    });
    mockDetectRepos.mockReturnValue([
      { repoName: "backend", repoPath: "/projects/backend", features: ["Add auth"], isCurrentRepo: true },
      { repoName: "frontend", repoPath: "/projects/frontend", features: ["Add login page"], isCurrentRepo: false },
    ]);

    await handleWorkItems(["plan", "100"]);

    const outputArg = mockOutput.mock.calls[0][0];
    expect(outputArg.repos).toBeDefined();
    expect(outputArg.repos).toHaveLength(2);
    expect(outputArg.repos[0]).toEqual({
      name: "backend",
      path: "/projects/backend",
      features: ["Add auth"],
      isCurrentRepo: true,
    });
    expect(outputArg.repos[1]).toEqual({
      name: "frontend",
      path: "/projects/frontend",
      features: ["Add login page"],
      isCurrentRepo: false,
    });
  });

  it("works without repos in config (backward compatible)", async () => {
    const item = makeAdoItem({ state: "In Progress" });
    mockGetWorkItem.mockResolvedValue(item);
    mockAddComment.mockResolvedValue({ id: 1, text: "comment" });

    // Config has no repos
    mockLoadConfig.mockResolvedValue({});

    await handleWorkItems(["plan", "100"]);

    const outputArg = mockOutput.mock.calls[0][0];
    expect(outputArg.repos).toBeUndefined();
    expect(outputArg.codePlan).toBeDefined();
  });

  it("works when loadConfig fails (backward compatible)", async () => {
    const item = makeAdoItem({ state: "In Progress" });
    mockGetWorkItem.mockResolvedValue(item);
    mockAddComment.mockResolvedValue({ id: 1, text: "comment" });
    mockLoadConfig.mockRejectedValue(new Error("no config file"));

    await handleWorkItems(["plan", "100"]);

    const outputArg = mockOutput.mock.calls[0][0];
    expect(outputArg.repos).toBeUndefined();
    expect(outputArg.codePlan).toBeDefined();
  });

  it("passes getCodePlanGuidance repo context when repos detected", async () => {
    const item = makeAdoItem({ state: "In Progress" });
    mockGetWorkItem.mockResolvedValue(item);
    mockAddComment.mockResolvedValue({ id: 1, text: "comment" });
    mockLoadConfig.mockResolvedValue({
      repos: { backend: { path: "/projects/backend" } },
    });
    mockDetectRepos.mockReturnValue([
      { repoName: "backend", repoPath: "/projects/backend", features: [], isCurrentRepo: false },
    ]);

    await handleWorkItems(["plan", "100"]);

    const { getCodePlanGuidance } = await import("../../src/services/planning/code-plan.js");
    expect(getCodePlanGuidance).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({
        detectedRepos: expect.arrayContaining([
          expect.objectContaining({ repoName: "backend" }),
        ]),
      }),
    );
  });
});
