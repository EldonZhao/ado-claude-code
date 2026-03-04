import { describe, it, expect, vi, beforeEach } from "vitest";
import { SyncEngine } from "../../src/services/sync/engine.js";
import { SyncStateManager } from "../../src/services/sync/state.js";
import type { AdoClient } from "../../src/services/ado/client.js";
import type { WorkItemStorage } from "../../src/storage/work-items.js";
import type { SyncItemState } from "../../src/schemas/sync-state.schema.js";

vi.mock("node:fs/promises", () => ({
  unlink: vi.fn().mockResolvedValue(undefined),
}));

import * as fs from "node:fs/promises";

// ---------- helpers ----------

function makeSyncItemState(
  overrides?: Partial<SyncItemState>,
): SyncItemState {
  return {
    localPath: "/fake/path/100.yaml",
    adoRev: 1,
    localHash: "abc123",
    lastSyncedAt: "2026-03-03T00:00:00.000Z",
    syncStatus: "synced",
    ...overrides,
  };
}

function makeMockClient() {
  return {
    getWorkItem: vi.fn(),
    queryWorkItems: vi.fn(),
    updateWorkItem: vi.fn(),
  } as unknown as AdoClient;
}

function makeMockStorage() {
  return {
    save: vi.fn().mockResolvedValue("/fake/path/100.yaml"),
    loadById: vi.fn(),
  } as unknown as WorkItemStorage;
}

function makeMockStateManager() {
  return {
    getItemState: vi.fn().mockResolvedValue(null),
    setItemState: vi.fn().mockResolvedValue(undefined),
    getAllItemStates: vi.fn().mockResolvedValue(new Map()),
    removeItemState: vi.fn().mockResolvedValue(undefined),
    save: vi.fn().mockResolvedValue(undefined),
    setLastFullSync: vi.fn().mockResolvedValue(undefined),
  } as unknown as SyncStateManager;
}

// ---------- tests ----------

describe("SyncEngine.clearAll", () => {
  let client: ReturnType<typeof makeMockClient>;
  let storage: ReturnType<typeof makeMockStorage>;
  let stateManager: ReturnType<typeof makeMockStateManager>;
  let engine: SyncEngine;

  beforeEach(() => {
    vi.clearAllMocks();
    client = makeMockClient();
    storage = makeMockStorage();
    stateManager = makeMockStateManager();
    engine = new SyncEngine(
      client as unknown as AdoClient,
      storage as unknown as WorkItemStorage,
      stateManager as unknown as SyncStateManager,
    );
  });

  it("dry-run returns summary without deleting files or state", async () => {
    const statesMap = new Map<number, SyncItemState>([
      [100, makeSyncItemState({ syncStatus: "synced" })],
      [101, makeSyncItemState({ localPath: "/fake/101.yaml", syncStatus: "localModified" })],
    ]);
    (stateManager.getAllItemStates as ReturnType<typeof vi.fn>).mockResolvedValue(statesMap);

    const result = await engine.clearAll(false);

    expect(result.status).toBe("dry-run");
    expect(result.summary.total).toBe(2);
    expect(result.summary.synced).toBe(1);
    expect(result.summary.localModified).toBe(1);
    expect(result.cleared).toBe(0);
    expect(fs.unlink).not.toHaveBeenCalled();
    expect(stateManager.removeItemState).not.toHaveBeenCalled();
    expect(stateManager.save).not.toHaveBeenCalled();
  });

  it("confirm=true deletes files, removes state, and returns cleared count", async () => {
    const statesMap = new Map<number, SyncItemState>([
      [100, makeSyncItemState({ localPath: "/fake/100.yaml", syncStatus: "synced" })],
      [101, makeSyncItemState({ localPath: "/fake/101.yaml", syncStatus: "synced" })],
    ]);
    (stateManager.getAllItemStates as ReturnType<typeof vi.fn>).mockResolvedValue(statesMap);

    const result = await engine.clearAll(true);

    expect(result.status).toBe("cleared");
    expect(result.cleared).toBe(2);
    expect(result.summary.total).toBe(2);
    expect(fs.unlink).toHaveBeenCalledWith("/fake/100.yaml");
    expect(fs.unlink).toHaveBeenCalledWith("/fake/101.yaml");
    expect(stateManager.removeItemState).toHaveBeenCalledWith(100);
    expect(stateManager.removeItemState).toHaveBeenCalledWith(101);
    expect(stateManager.setLastFullSync).toHaveBeenCalledWith(null);
    expect(stateManager.save).toHaveBeenCalled();
  });

  it("confirm=true handles mixed sync statuses", async () => {
    const statesMap = new Map<number, SyncItemState>([
      [100, makeSyncItemState({ localPath: "/fake/100.yaml", syncStatus: "synced" })],
      [101, makeSyncItemState({ localPath: "/fake/101.yaml", syncStatus: "localModified" })],
      [102, makeSyncItemState({ localPath: "/fake/102.yaml", syncStatus: "conflict" })],
      [103, makeSyncItemState({ localPath: "/fake/103.yaml", syncStatus: "remoteModified" })],
    ]);
    (stateManager.getAllItemStates as ReturnType<typeof vi.fn>).mockResolvedValue(statesMap);

    const result = await engine.clearAll(true);

    expect(result.status).toBe("cleared");
    expect(result.summary).toEqual({
      total: 4,
      synced: 1,
      localModified: 1,
      conflict: 1,
      remoteModified: 1,
    });
    expect(result.cleared).toBe(4);
    expect(fs.unlink).toHaveBeenCalledTimes(4);
    expect(stateManager.removeItemState).toHaveBeenCalledTimes(4);
  });

  it("confirm=true handles missing files without throwing", async () => {
    const statesMap = new Map<number, SyncItemState>([
      [100, makeSyncItemState({ localPath: "/fake/missing.yaml", syncStatus: "synced" })],
    ]);
    (stateManager.getAllItemStates as ReturnType<typeof vi.fn>).mockResolvedValue(statesMap);
    (fs.unlink as ReturnType<typeof vi.fn>).mockRejectedValueOnce(
      new Error("ENOENT: no such file or directory"),
    );

    const result = await engine.clearAll(true);

    expect(result.status).toBe("cleared");
    expect(result.cleared).toBe(1);
    expect(stateManager.removeItemState).toHaveBeenCalledWith(100);
    expect(stateManager.save).toHaveBeenCalled();
  });

  it("returns total=0 and cleared=0 on empty state", async () => {
    (stateManager.getAllItemStates as ReturnType<typeof vi.fn>).mockResolvedValue(new Map());

    const result = await engine.clearAll(true);

    expect(result.summary.total).toBe(0);
    expect(result.cleared).toBe(0);
    expect(fs.unlink).not.toHaveBeenCalled();
    expect(stateManager.removeItemState).not.toHaveBeenCalled();
  });
});
