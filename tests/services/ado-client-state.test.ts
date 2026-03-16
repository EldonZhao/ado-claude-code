import { describe, it, expect, vi, beforeEach } from "vitest";

// ---------- Mocks ----------

const mockGetWorkItemType = vi.fn();

vi.mock("azure-devops-node-api", () => {
  return {
    WebApi: class MockWebApi {
      constructor(_url: string, _handler: unknown) {}
      async getWorkItemTrackingApi() {
        return {
          getWorkItemType: (...args: unknown[]) => mockGetWorkItemType(...args),
        };
      }
    },
    getPersonalAccessTokenHandler: () => ({}),
    getBearerHandler: () => ({}),
  };
});

vi.mock("../../src/services/ado/auth.js", () => ({
  getCredentials: vi.fn().mockResolvedValue({ type: "pat", token: "fake" }),
  getTokenExpiration: vi.fn().mockResolvedValue(null),
}));

vi.mock("../../src/storage/cache.js", () => ({
  getApiCache: vi.fn(() => ({
    get: vi.fn(),
    set: vi.fn(),
    invalidateByPrefix: vi.fn(),
  })),
  CacheKeys: { workItem: (id: number) => `wi:${id}` },
}));

vi.mock("../../src/utils/logger.js", () => ({
  logger: { info: vi.fn(), debug: vi.fn(), warn: vi.fn(), error: vi.fn() },
}));

import { AdoClient } from "../../src/services/ado/client.js";
import type { AdoConfigOutput } from "../../src/schemas/config.schema.js";

// ---------- Helpers ----------

function makeConfig(): AdoConfigOutput {
  return {
    version: "1.0",
    azure_devops: {
      organization: "https://dev.azure.com/testorg",
      project: "TestProject",
      auth: { type: "pat", patEnvVar: "ADO_PAT" },
    },
    storage: {
      basePath: "./.github",
      workItemsPath: "workitems",
      instructionsPath: "instructions",
    },
    sync: {
      autoSync: false,
      pullOnStartup: true,
      conflictResolution: "ask",
    },
  };
}

// ---------- Tests ----------

describe("AdoClient.getTerminalState", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns Done when transitions include Done", async () => {
    mockGetWorkItemType.mockResolvedValue({
      transitions: {
        "Active": [{ to: "Resolved" }, { to: "Done" }],
        "Resolved": [{ to: "Done" }, { to: "Active" }],
      },
    });

    const client = new AdoClient(makeConfig());
    const result = await client.getTerminalState("User Story");

    expect(result).toBe("Done");
    expect(mockGetWorkItemType).toHaveBeenCalledWith("TestProject", "User Story");
  });

  it("returns Closed when Done not available", async () => {
    mockGetWorkItemType.mockResolvedValue({
      transitions: {
        "Active": [{ to: "Resolved" }, { to: "Closed" }],
        "Resolved": [{ to: "Closed" }, { to: "Active" }],
      },
    });

    const client = new AdoClient(makeConfig());
    const result = await client.getTerminalState("Bug");

    expect(result).toBe("Closed");
  });

  it("returns Completed when it is the only terminal state", async () => {
    mockGetWorkItemType.mockResolvedValue({
      transitions: {
        "Active": [{ to: "Completed" }],
      },
    });

    const client = new AdoClient(makeConfig());
    const result = await client.getTerminalState("Task");

    expect(result).toBe("Completed");
  });

  it("caches result per work item type", async () => {
    mockGetWorkItemType.mockResolvedValue({
      transitions: {
        "Active": [{ to: "Done" }],
      },
    });

    const client = new AdoClient(makeConfig());
    const result1 = await client.getTerminalState("User Story");
    const result2 = await client.getTerminalState("User Story");

    expect(result1).toBe("Done");
    expect(result2).toBe("Done");
    // API should only be called once due to caching
    expect(mockGetWorkItemType).toHaveBeenCalledTimes(1);
  });

  it("caches separately per work item type", async () => {
    mockGetWorkItemType
      .mockResolvedValueOnce({
        transitions: { "Active": [{ to: "Done" }] },
      })
      .mockResolvedValueOnce({
        transitions: { "Active": [{ to: "Closed" }] },
      });

    const client = new AdoClient(makeConfig());
    const result1 = await client.getTerminalState("User Story");
    const result2 = await client.getTerminalState("Bug");

    expect(result1).toBe("Done");
    expect(result2).toBe("Closed");
    expect(mockGetWorkItemType).toHaveBeenCalledTimes(2);
  });

  it("throws when no terminal state found", async () => {
    mockGetWorkItemType.mockResolvedValue({
      transitions: {
        "Active": [{ to: "InReview" }],
      },
    });

    const client = new AdoClient(makeConfig());
    await expect(client.getTerminalState("Custom Type")).rejects.toThrow(
      'No terminal state found for work item type "Custom Type"',
    );
  });

  it("handles string-based transitions", async () => {
    mockGetWorkItemType.mockResolvedValue({
      transitions: {
        "Active": ["Resolved", "Closed"],
      },
    });

    const client = new AdoClient(makeConfig());
    const result = await client.getTerminalState("Bug");

    expect(result).toBe("Closed");
  });
});
