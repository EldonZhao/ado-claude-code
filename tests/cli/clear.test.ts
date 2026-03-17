import { describe, it, expect, vi, beforeEach } from "vitest";
import type { ClearResult } from "../../src/services/sync/engine.js";

// ---------- Mocks ----------

const mockClearAll = vi.fn<(confirm: boolean) => Promise<ClearResult>>();
const mockOutput = vi.fn();

vi.mock("../../src/storage/config.js", () => ({
  loadConfig: vi.fn().mockResolvedValue({
    version: "1.0",
    azure_devops: {
      organization: "https://dev.azure.com/org",
      project: "proj",
      auth: { type: "pat", patEnvVar: "ADO_PAT" },
    },
    storage: { basePath: "./.github", workItemsPath: "workitems", instructionsPath: "instructions" },
    sync: { autoSync: false, pullOnStartup: true, conflictResolution: "ask" },
  }),
  resolveStoragePath: vi.fn((p: string) => p),
  getProjectRoot: vi.fn(() => "/fake/root"),
}));

vi.mock("../../src/cli/helpers.js", () => ({
  output: (...args: unknown[]) => mockOutput(...args),
  fatal: vi.fn((msg: string) => { throw new Error(msg); }),
  checkHelp: vi.fn(),
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

vi.mock("../../src/storage/workitems.js", () => ({
  WorkItemStorage: vi.fn(),
}));

vi.mock("../../src/services/sync/state.js", () => ({
  SyncStateManager: vi.fn(),
}));

vi.mock("../../src/services/sync/engine.js", () => {
  return {
    SyncEngine: class {
      clearAll = mockClearAll;
    },
  };
});

vi.mock("../../src/utils/logger.js", () => ({
  logger: { info: vi.fn(), debug: vi.fn(), warn: vi.fn(), error: vi.fn() },
}));

import { handleClear } from "../../src/cli/clear.js";

// ---------- Tests ----------

describe("handleClear CLI handler", () => {
  const dryRunResult: ClearResult = {
    status: "dry-run",
    summary: { total: 3, synced: 2, localModified: 1, remoteModified: 0, conflict: 0 },
    cleared: 0,
  };

  const clearedResult: ClearResult = {
    status: "cleared",
    summary: { total: 3, synced: 2, localModified: 1, remoteModified: 0, conflict: 0 },
    cleared: 3,
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("calls clearAll with confirm=false when --confirm is not passed", async () => {
    mockClearAll.mockResolvedValue(dryRunResult);

    await handleClear([]);

    expect(mockClearAll).toHaveBeenCalledWith(false);
    expect(mockOutput).toHaveBeenCalledWith(dryRunResult);
  });

  it("calls clearAll with confirm=true when --confirm is passed", async () => {
    mockClearAll.mockResolvedValue(clearedResult);

    await handleClear(["--confirm"]);

    expect(mockClearAll).toHaveBeenCalledWith(true);
    expect(mockOutput).toHaveBeenCalledWith(clearedResult);
  });

  it("ignores unrelated flags and still defaults to dry-run", async () => {
    mockClearAll.mockResolvedValue(dryRunResult);

    await handleClear(["--verbose", "--ids=1,2"]);

    expect(mockClearAll).toHaveBeenCalledWith(false);
  });

  it("outputs the result from clearAll", async () => {
    const customResult: ClearResult = {
      status: "cleared",
      summary: { total: 0, synced: 0, localModified: 0, remoteModified: 0, conflict: 0 },
      cleared: 0,
    };
    mockClearAll.mockResolvedValue(customResult);

    await handleClear(["--confirm"]);

    expect(mockOutput).toHaveBeenCalledWith(customResult);
  });

  it("falls back to defaults when config is not found", async () => {
    const { loadConfig } = await import("../../src/storage/config.js");
    vi.mocked(loadConfig).mockRejectedValueOnce(new Error("Config not found"));
    mockClearAll.mockResolvedValue(dryRunResult);

    await handleClear([]);

    expect(mockClearAll).toHaveBeenCalledWith(false);
    expect(mockOutput).toHaveBeenCalledWith(dryRunResult);
  });
});
