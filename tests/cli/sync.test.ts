import { describe, it, expect, vi, beforeEach } from "vitest";
import type { SyncResult } from "../../src/services/sync/engine.js";

// ---------- Mocks ----------

const mockPullFromAdo = vi.fn<() => Promise<SyncResult>>();
const mockPushToAdo = vi.fn<() => Promise<SyncResult>>();
const mockFullSync = vi.fn<() => Promise<SyncResult>>();
const mockOutput = vi.fn();
const mockFatal = vi.fn((msg: string) => { throw new Error(msg); });

vi.mock("../../src/storage/config.js", () => ({
  loadConfig: vi.fn().mockResolvedValue({
    version: "1.0",
    azure_devops: {
      organization: "https://dev.azure.com/org",
      project: "proj",
      auth: { type: "pat", patEnvVar: "ADO_PAT" },
    },
    storage: { basePath: "./.claude/ado", workItemsPath: "work-items", tsgPath: "tsgs" },
    sync: { autoSync: false, pullOnStartup: true, conflictResolution: "ask" },
  }),
  resolveStoragePath: vi.fn((p: string) => p),
  ensureProjectGitignore: vi.fn().mockResolvedValue(undefined),
}));

vi.mock("../../src/cli/helpers.js", () => ({
  getAdoClient: vi.fn().mockResolvedValue({}),
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
  getWorkItemStorage: vi.fn().mockResolvedValue({}),
}));

vi.mock("../../src/services/sync/state.js", () => ({
  SyncStateManager: vi.fn(),
}));

vi.mock("../../src/services/sync/engine.js", () => {
  return {
    SyncEngine: class {
      pullFromAdo = mockPullFromAdo;
      pushToAdo = mockPushToAdo;
      fullSync = mockFullSync;
    },
  };
});

import { handleSync } from "../../src/cli/sync.js";

// ---------- Helpers ----------

const OK_RESULT: SyncResult = { pulled: 2, pushed: 0, conflicts: 0, errors: [] };

const MY_ITEMS_QUERY =
  "SELECT [System.Id] FROM WorkItems " +
  "WHERE [System.AssignedTo] = @me " +
  "  AND [System.State] <> 'Closed' " +
  "  AND [System.State] <> 'Removed' " +
  "  AND [System.State] <> 'Completed' " +
  "  AND [System.State] <> 'Done' " +
  "ORDER BY [System.ChangedDate] DESC";

const MY_ALL_ITEMS_QUERY =
  "SELECT [System.Id] FROM WorkItems " +
  "WHERE [System.AssignedTo] = @me " +
  "ORDER BY [System.ChangedDate] DESC";

// ---------- Tests ----------

describe("handleSync CLI handler", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("default --mine behavior", () => {
    it("pull with no flags defaults to my active items query", async () => {
      mockPullFromAdo.mockResolvedValue(OK_RESULT);

      await handleSync(["pull"]);

      expect(mockPullFromAdo).toHaveBeenCalledWith({
        query: MY_ITEMS_QUERY,
        ids: undefined,
        pushFirst: true,
      });
    });

    it("full with no flags defaults to my active items query", async () => {
      mockFullSync.mockResolvedValue(OK_RESULT);

      await handleSync(["full"]);

      expect(mockFullSync).toHaveBeenCalledWith(MY_ITEMS_QUERY);
    });

    it("pull --mine uses the same query as the default", async () => {
      mockPullFromAdo.mockResolvedValue(OK_RESULT);

      await handleSync(["pull", "--mine"]);

      expect(mockPullFromAdo).toHaveBeenCalledWith({
        query: MY_ITEMS_QUERY,
        ids: undefined,
        pushFirst: true,
      });
    });

    it("full --mine uses the same query as the default", async () => {
      mockFullSync.mockResolvedValue(OK_RESULT);

      await handleSync(["full", "--mine"]);

      expect(mockFullSync).toHaveBeenCalledWith(MY_ITEMS_QUERY);
    });
  });

  describe("explicit flags override default", () => {
    it("pull --ids skips the default query", async () => {
      mockPullFromAdo.mockResolvedValue(OK_RESULT);

      await handleSync(["pull", "--ids=42,99"]);

      expect(mockPullFromAdo).toHaveBeenCalledWith({
        query: undefined,
        ids: [42, 99],
        pushFirst: true,
      });
    });

    it("pull --query uses the provided query", async () => {
      const custom = "SELECT [System.Id] FROM WorkItems WHERE [System.State] = 'Active'";
      mockPullFromAdo.mockResolvedValue(OK_RESULT);

      await handleSync(["pull", `--query=${custom}`]);

      expect(mockPullFromAdo).toHaveBeenCalledWith({
        query: custom,
        ids: undefined,
        pushFirst: true,
      });
    });

    it("full --query uses the provided query", async () => {
      const custom = "SELECT [System.Id] FROM WorkItems WHERE [System.State] = 'Active'";
      mockFullSync.mockResolvedValue(OK_RESULT);

      await handleSync(["full", `--query=${custom}`]);

      expect(mockFullSync).toHaveBeenCalledWith(custom);
    });
  });

  describe("push does not default to --mine", () => {
    it("push with no flags calls pushToAdo without query", async () => {
      mockPushToAdo.mockResolvedValue(OK_RESULT);

      await handleSync(["push"]);

      expect(mockPushToAdo).toHaveBeenCalledWith({ ids: undefined });
      expect(mockPullFromAdo).not.toHaveBeenCalled();
      expect(mockFullSync).not.toHaveBeenCalled();
    });

    it("push --ids filters by IDs", async () => {
      mockPushToAdo.mockResolvedValue(OK_RESULT);

      await handleSync(["push", "--ids=10,20"]);

      expect(mockPushToAdo).toHaveBeenCalledWith({ ids: [10, 20] });
    });
  });

  describe("--mine and --query are mutually exclusive", () => {
    it("fatals when both --mine and --query are provided", async () => {
      await expect(handleSync(["pull", "--mine", "--query=SELECT 1"])).rejects.toThrow(
        "Cannot use --mine and --query together",
      );
    });
  });

  describe("--all flag", () => {
    it("pull --all uses the all-items query (no state filter)", async () => {
      mockPullFromAdo.mockResolvedValue(OK_RESULT);

      await handleSync(["pull", "--all"]);

      expect(mockPullFromAdo).toHaveBeenCalledWith({
        query: MY_ALL_ITEMS_QUERY,
        ids: undefined,
        pushFirst: true,
      });
    });

    it("full --all uses the all-items query", async () => {
      mockFullSync.mockResolvedValue(OK_RESULT);

      await handleSync(["full", "--all"]);

      expect(mockFullSync).toHaveBeenCalledWith(MY_ALL_ITEMS_QUERY);
    });

    it("fatals when --all and --mine are combined", async () => {
      await expect(handleSync(["pull", "--all", "--mine"])).rejects.toThrow(
        "Cannot use --all with --mine or --query",
      );
    });

    it("fatals when --all and --query are combined", async () => {
      await expect(handleSync(["pull", "--all", "--query=SELECT 1"])).rejects.toThrow(
        "Cannot use --all with --mine or --query",
      );
    });

    it("the all-items query has no state filter", () => {
      expect(MY_ALL_ITEMS_QUERY).not.toContain("System.State");
      expect(MY_ALL_ITEMS_QUERY).toContain("[System.AssignedTo] = @me");
    });
  });

  describe("Completed state exclusion in query", () => {
    it("the default query excludes Completed, Closed, Removed, and Done states", () => {
      expect(MY_ITEMS_QUERY).toContain("[System.State] <> 'Completed'");
      expect(MY_ITEMS_QUERY).toContain("[System.State] <> 'Closed'");
      expect(MY_ITEMS_QUERY).toContain("[System.State] <> 'Removed'");
      expect(MY_ITEMS_QUERY).toContain("[System.State] <> 'Done'");
    });
  });

  describe("output", () => {
    it("outputs the sync result", async () => {
      mockPullFromAdo.mockResolvedValue(OK_RESULT);

      await handleSync(["pull"]);

      expect(mockOutput).toHaveBeenCalledWith({
        operation: "pull",
        pulled: 2,
        pushed: 0,
        conflicts: 0,
        errors: [],
      });
    });
  });

  describe("invalid action", () => {
    it("fatals on unknown action", async () => {
      await expect(handleSync(["unknown"])).rejects.toThrow("Usage: sync");
    });

    it("fatals when no action is provided", async () => {
      await expect(handleSync([])).rejects.toThrow("Usage: sync");
    });
  });
});
