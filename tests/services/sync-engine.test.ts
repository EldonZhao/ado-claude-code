import { describe, it, expect, vi, beforeEach } from "vitest";
import { SyncEngine } from "../../src/services/sync/engine.js";
import { SyncStateManager } from "../../src/services/sync/state.js";
import type { AdoClient } from "../../src/services/ado/client.js";
import type { WorkItemStorage } from "../../src/storage/work-items.js";
import type { AdoWorkItem } from "../../src/services/ado/types.js";
import type { LocalWorkItemOutput } from "../../src/schemas/work-item.schema.js";
import type { SyncItemState } from "../../src/schemas/sync-state.schema.js";
import { SyncError } from "../../src/utils/errors.js";

// ---------- Factory helpers ----------

function makeAdoItem(overrides?: Partial<AdoWorkItem>): AdoWorkItem {
  return {
    id: 100,
    rev: 1,
    url: "https://dev.azure.com/org/project/_workitems/edit/100",
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
      "System.Parent": 99,
    },
    ...overrides,
  };
}

function makeLocalItem(
  overrides?: Partial<LocalWorkItemOutput>,
): LocalWorkItemOutput {
  return {
    id: 100,
    rev: 1,
    url: "https://dev.azure.com/org/project/_workitems/edit/100",
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
    parent: 99,
    ...overrides,
  };
}

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

// ---------- Mock builders ----------

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
    save: vi.fn().mockResolvedValue(undefined),
    setLastFullSync: vi.fn().mockResolvedValue(undefined),
  } as unknown as SyncStateManager;
}

// ---------- Tests ----------

describe("SyncEngine", () => {
  let client: ReturnType<typeof makeMockClient>;
  let storage: ReturnType<typeof makeMockStorage>;
  let stateManager: ReturnType<typeof makeMockStateManager>;
  let engine: SyncEngine;

  beforeEach(() => {
    client = makeMockClient();
    storage = makeMockStorage();
    stateManager = makeMockStateManager();
    engine = new SyncEngine(
      client as unknown as AdoClient,
      storage as unknown as WorkItemStorage,
      stateManager as unknown as SyncStateManager,
    );
  });

  // ---- pullFromAdo ----

  describe("pullFromAdo", () => {
    it("pulls items via WIQL query", async () => {
      const adoItem = makeAdoItem({ id: 100 });
      (client.queryWorkItems as ReturnType<typeof vi.fn>).mockResolvedValue([adoItem]);
      (client.getWorkItem as ReturnType<typeof vi.fn>).mockResolvedValue(adoItem);

      const result = await engine.pullFromAdo({ query: "SELECT [System.Id] FROM WorkItems" });

      expect(client.queryWorkItems).toHaveBeenCalledWith("SELECT [System.Id] FROM WorkItems");
      expect(client.getWorkItem).toHaveBeenCalledWith(100, "relations");
      expect(storage.save).toHaveBeenCalled();
      expect(stateManager.setItemState).toHaveBeenCalled();
      expect(stateManager.save).toHaveBeenCalled();
      expect(result.pulled).toBe(1);
    });

    it("pulls items via specific IDs", async () => {
      const item1 = makeAdoItem({ id: 101, rev: 2 });
      const item2 = makeAdoItem({ id: 102, rev: 3 });
      (client.getWorkItem as ReturnType<typeof vi.fn>)
        .mockResolvedValueOnce(item1)
        .mockResolvedValueOnce(item2);

      const result = await engine.pullFromAdo({ ids: [101, 102] });

      expect(client.getWorkItem).toHaveBeenCalledWith(101, "relations");
      expect(client.getWorkItem).toHaveBeenCalledWith(102, "relations");
      expect(result.pulled).toBe(2);
    });

    it("throws SyncError when neither query nor IDs provided", async () => {
      await expect(engine.pullFromAdo({})).rejects.toThrow(SyncError);
    });

    it("skips items where ADO rev matches and local hash differs (undetected local edit)", async () => {
      // When same rev, different hash, and NOT marked localModified => skip (preserve local edits)
      const adoItem = makeAdoItem({ id: 100, rev: 1 });
      (client.getWorkItem as ReturnType<typeof vi.fn>).mockResolvedValue(adoItem);

      (stateManager.getItemState as ReturnType<typeof vi.fn>).mockResolvedValue(
        makeSyncItemState({ adoRev: 1, localHash: "different-hash", syncStatus: "synced" }),
      );

      const result = await engine.pullFromAdo({ ids: [100] });
      expect(result.pulled).toBe(0);
      expect(storage.save).not.toHaveBeenCalled();
    });
  });

  // ---- pullFromAdo with pushFirst ----

  describe("pullFromAdo with pushFirst", () => {
    it("goes straight to pull when pushFirst:true and no local modifications", async () => {
      const adoItem = makeAdoItem({ id: 100 });
      (client.queryWorkItems as ReturnType<typeof vi.fn>).mockResolvedValue([adoItem]);
      (client.getWorkItem as ReturnType<typeof vi.fn>).mockResolvedValue(adoItem);
      // detectLocalChanges will call getAllItemStates, which returns empty map (default)

      const result = await engine.pullFromAdo({
        query: "SELECT [System.Id] FROM WorkItems",
        pushFirst: true,
      });

      expect(result.pushed).toBe(0);
      expect(result.pulled).toBe(1);
    });

    it("pushes modified items first when pushFirst:true and local modifications exist", async () => {
      const adoItem = makeAdoItem({ id: 200, rev: 1 });
      const localItem = makeLocalItem({ id: 200, title: "Modified Title" });
      const updatedAdoItem = makeAdoItem({ id: 200, rev: 2 });

      // First call to getAllItemStates (from detectLocalChanges) returns item with old hash
      // Second call (from pushToAdo) returns item marked localModified
      const detectStatesMap = new Map<number, SyncItemState>([
        [200, makeSyncItemState({ localPath: "/fake/200.yaml", adoRev: 1, localHash: "oldhash" })],
      ]);
      const pushStatesMap = new Map<number, SyncItemState>([
        [200, makeSyncItemState({ localPath: "/fake/200.yaml", adoRev: 1, localHash: "oldhash", syncStatus: "localModified" })],
      ]);
      (stateManager.getAllItemStates as ReturnType<typeof vi.fn>)
        .mockResolvedValueOnce(detectStatesMap)
        .mockResolvedValueOnce(pushStatesMap);

      (storage.loadById as ReturnType<typeof vi.fn>).mockResolvedValue(localItem);

      // getItemState called by pushToAdo for existing state check
      (stateManager.getItemState as ReturnType<typeof vi.fn>)
        .mockResolvedValueOnce(makeSyncItemState({ adoRev: 1, syncStatus: "localModified" })) // pushToAdo
        .mockResolvedValue(null); // pull phase

      // getWorkItem called by pushToAdo (remote check) and then by pull (re-fetch with relations)
      (client.getWorkItem as ReturnType<typeof vi.fn>).mockResolvedValue(adoItem);
      (client.updateWorkItem as ReturnType<typeof vi.fn>).mockResolvedValue(updatedAdoItem);
      (storage.save as ReturnType<typeof vi.fn>).mockResolvedValue("/fake/200.yaml");

      // Pull query phase
      (client.queryWorkItems as ReturnType<typeof vi.fn>).mockResolvedValue([adoItem]);

      const result = await engine.pullFromAdo({
        query: "SELECT [System.Id] FROM WorkItems",
        pushFirst: true,
      });

      expect(result.pushed).toBe(1);
      expect(result.pulled).toBeGreaterThanOrEqual(0);
    });

    it("does not call detectLocalChanges when pushFirst is false", async () => {
      const adoItem = makeAdoItem({ id: 100 });
      (client.getWorkItem as ReturnType<typeof vi.fn>).mockResolvedValue(adoItem);

      await engine.pullFromAdo({ ids: [100], pushFirst: false });

      // getAllItemStates is only called by detectLocalChanges and pushToAdo
      expect(stateManager.getAllItemStates).not.toHaveBeenCalled();
    });
  });

  // ---- pushToAdo ----

  describe("pushToAdo", () => {
    it("pushes locally modified items", async () => {
      const localItem = makeLocalItem({ id: 100, title: "Updated Title" });
      const remoteItem = makeAdoItem({ id: 100, rev: 1 });
      const updatedItem = makeAdoItem({ id: 100, rev: 2 });

      const statesMap = new Map<number, SyncItemState>([
        [100, makeSyncItemState({ syncStatus: "localModified", adoRev: 1 })],
      ]);
      (stateManager.getAllItemStates as ReturnType<typeof vi.fn>).mockResolvedValue(statesMap);
      (storage.loadById as ReturnType<typeof vi.fn>).mockResolvedValue(localItem);
      (stateManager.getItemState as ReturnType<typeof vi.fn>).mockResolvedValue(
        makeSyncItemState({ syncStatus: "localModified", adoRev: 1 }),
      );
      (client.getWorkItem as ReturnType<typeof vi.fn>).mockResolvedValue(remoteItem);
      (client.updateWorkItem as ReturnType<typeof vi.fn>).mockResolvedValue(updatedItem);

      const result = await engine.pushToAdo();

      expect(client.updateWorkItem).toHaveBeenCalled();
      expect(storage.save).toHaveBeenCalled();
      expect(result.pushed).toBe(1);
      expect(result.conflicts).toBe(0);
    });

    it("detects conflict when remote rev > synced rev", async () => {
      const localItem = makeLocalItem({ id: 100, title: "Local Edit" });
      const remoteItem = makeAdoItem({ id: 100, rev: 5 }); // Remote advanced to rev 5

      const statesMap = new Map<number, SyncItemState>([
        [100, makeSyncItemState({ syncStatus: "localModified", adoRev: 1 })],
      ]);
      (stateManager.getAllItemStates as ReturnType<typeof vi.fn>).mockResolvedValue(statesMap);
      (storage.loadById as ReturnType<typeof vi.fn>).mockResolvedValue(localItem);
      (stateManager.getItemState as ReturnType<typeof vi.fn>).mockResolvedValue(
        makeSyncItemState({ syncStatus: "localModified", adoRev: 1 }),
      );
      (client.getWorkItem as ReturnType<typeof vi.fn>).mockResolvedValue(remoteItem);

      const result = await engine.pushToAdo();

      expect(client.updateWorkItem).not.toHaveBeenCalled();
      expect(result.conflicts).toBe(1);
      expect(result.pushed).toBe(0);
      expect(stateManager.setItemState).toHaveBeenCalledWith(
        100,
        expect.objectContaining({ syncStatus: "conflict" }),
      );
    });

    it("skips items with no meaningful field changes", async () => {
      // Local and remote are identical — localToAdoPatch produces empty array
      const localItem = makeLocalItem({ id: 100 });
      const remoteItem = makeAdoItem({ id: 100, rev: 1 });

      const statesMap = new Map<number, SyncItemState>([
        [100, makeSyncItemState({ syncStatus: "localModified", adoRev: 1 })],
      ]);
      (stateManager.getAllItemStates as ReturnType<typeof vi.fn>).mockResolvedValue(statesMap);
      (storage.loadById as ReturnType<typeof vi.fn>).mockResolvedValue(localItem);
      (stateManager.getItemState as ReturnType<typeof vi.fn>).mockResolvedValue(
        makeSyncItemState({ syncStatus: "localModified", adoRev: 1 }),
      );
      (client.getWorkItem as ReturnType<typeof vi.fn>).mockResolvedValue(remoteItem);

      const result = await engine.pushToAdo();

      expect(client.updateWorkItem).not.toHaveBeenCalled();
      expect(result.pushed).toBe(0);
    });
  });

  // ---- fullSync ----

  describe("fullSync", () => {
    it("calls pullFromAdo with pushFirst, then pushToAdo, then sets lastFullSync", async () => {
      const adoItem = makeAdoItem({ id: 100 });
      (client.queryWorkItems as ReturnType<typeof vi.fn>).mockResolvedValue([adoItem]);
      (client.getWorkItem as ReturnType<typeof vi.fn>).mockResolvedValue(adoItem);

      const result = await engine.fullSync("SELECT [System.Id] FROM WorkItems");

      // pullFromAdo was called (via queryWorkItems)
      expect(client.queryWorkItems).toHaveBeenCalled();
      // setLastFullSync was called
      expect(stateManager.setLastFullSync).toHaveBeenCalledWith(expect.any(String));
      // save was called (multiple times: in pull, in push, and after fullSync)
      expect(stateManager.save).toHaveBeenCalled();
      expect(result.pulled).toBeGreaterThanOrEqual(1);
    });
  });

  // ---- detectLocalChanges ----

  describe("detectLocalChanges", () => {
    it("marks items as localModified when hash differs", async () => {
      const localItem = makeLocalItem({ id: 100, title: "Changed locally" });
      const statesMap = new Map<number, SyncItemState>([
        [100, makeSyncItemState({ localHash: "outdated-hash", syncStatus: "synced" })],
      ]);
      (stateManager.getAllItemStates as ReturnType<typeof vi.fn>).mockResolvedValue(statesMap);
      (storage.loadById as ReturnType<typeof vi.fn>).mockResolvedValue(localItem);

      const modified = await engine.detectLocalChanges();

      expect(modified).toBe(1);
      expect(stateManager.setItemState).toHaveBeenCalledWith(
        100,
        expect.objectContaining({ syncStatus: "localModified" }),
      );
      expect(stateManager.save).toHaveBeenCalled();
    });

    it("skips items already in conflict status", async () => {
      const statesMap = new Map<number, SyncItemState>([
        [100, makeSyncItemState({ syncStatus: "conflict" })],
      ]);
      (stateManager.getAllItemStates as ReturnType<typeof vi.fn>).mockResolvedValue(statesMap);

      const modified = await engine.detectLocalChanges();

      expect(modified).toBe(0);
      expect(storage.loadById).not.toHaveBeenCalled();
    });
  });
});
