import { describe, it, expect, vi, beforeEach } from "vitest";

// ---------- Mocks ----------

const mockCreateWorkItem = vi.fn();

vi.mock("azure-devops-node-api", () => {
  return {
    WebApi: class MockWebApi {
      constructor(_url: string, _handler: unknown) {}
      async getWorkItemTrackingApi() {
        return {
          createWorkItem: (...args: unknown[]) => mockCreateWorkItem(...args),
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

function makeConfig(defaults?: AdoConfigOutput["defaults"]): AdoConfigOutput {
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
    defaults,
  };
}

function makeAdoResponse(id: number) {
  return {
    id,
    rev: 1,
    url: `https://dev.azure.com/testorg/TestProject/_apis/wit/workItems/${id}`,
    fields: {
      "System.WorkItemType": "Bug",
      "System.Title": "Test Bug",
      "System.State": "New",
    },
  };
}

// ---------- Tests ----------

describe("AdoClient.createWorkItem — type defaults", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockCreateWorkItem.mockResolvedValue(makeAdoResponse(1));
  });

  it("applies type defaults from config when creating a Bug", async () => {
    const client = new AdoClient(makeConfig({
      Bug: { customFields: { "Custom.ProductImpact": "3 - Medium" } },
    }));

    await client.createWorkItem({ type: "Bug", title: "Test Bug" });

    const operations = mockCreateWorkItem.mock.calls[0][1];
    const customOp = operations.find(
      (op: any) => op.path === "/fields/Custom.ProductImpact",
    );
    expect(customOp).toBeDefined();
    expect(customOp.value).toBe("3 - Medium");
  });

  it("explicit customFields override type defaults", async () => {
    const client = new AdoClient(makeConfig({
      Bug: { customFields: { "Custom.ProductImpact": "3 - Medium" } },
    }));

    await client.createWorkItem({
      type: "Bug",
      title: "Critical Bug",
      customFields: { "Custom.ProductImpact": "1 - Critical" },
    });

    const operations = mockCreateWorkItem.mock.calls[0][1];
    const customOps = operations.filter(
      (op: any) => op.path === "/fields/Custom.ProductImpact",
    );
    // Should only have one entry (merged), not two
    expect(customOps).toHaveLength(1);
    expect(customOps[0].value).toBe("1 - Critical");
  });

  it("works when no defaults configured", async () => {
    const client = new AdoClient(makeConfig(undefined));

    await client.createWorkItem({ type: "Bug", title: "No defaults" });

    const operations = mockCreateWorkItem.mock.calls[0][1];
    const customOp = operations.find(
      (op: any) => op.path === "/fields/Custom.ProductImpact",
    );
    expect(customOp).toBeUndefined();
  });

  it("does not apply Bug defaults to Task type", async () => {
    const client = new AdoClient(makeConfig({
      Bug: { customFields: { "Custom.ProductImpact": "3 - Medium" } },
    }));

    mockCreateWorkItem.mockResolvedValue({
      ...makeAdoResponse(2),
      fields: { ...makeAdoResponse(2).fields, "System.WorkItemType": "Task" },
    });

    await client.createWorkItem({ type: "Task", title: "A Task" });

    const operations = mockCreateWorkItem.mock.calls[0][1];
    const customOp = operations.find(
      (op: any) => op.path === "/fields/Custom.ProductImpact",
    );
    expect(customOp).toBeUndefined();
  });

  it("merges multiple default custom fields", async () => {
    const client = new AdoClient(makeConfig({
      Bug: {
        customFields: {
          "Custom.ProductImpact": "3 - Medium",
          "Custom.Severity": "2 - High",
        },
      },
    }));

    await client.createWorkItem({ type: "Bug", title: "Multi-field Bug" });

    const operations = mockCreateWorkItem.mock.calls[0][1];
    const impactOp = operations.find(
      (op: any) => op.path === "/fields/Custom.ProductImpact",
    );
    const severityOp = operations.find(
      (op: any) => op.path === "/fields/Custom.Severity",
    );
    expect(impactOp?.value).toBe("3 - Medium");
    expect(severityOp?.value).toBe("2 - High");
  });

  it("partial override keeps non-overridden defaults", async () => {
    const client = new AdoClient(makeConfig({
      Bug: {
        customFields: {
          "Custom.ProductImpact": "3 - Medium",
          "Custom.Severity": "2 - High",
        },
      },
    }));

    await client.createWorkItem({
      type: "Bug",
      title: "Partial override",
      customFields: { "Custom.ProductImpact": "1 - Critical" },
    });

    const operations = mockCreateWorkItem.mock.calls[0][1];
    const impactOp = operations.find(
      (op: any) => op.path === "/fields/Custom.ProductImpact",
    );
    const severityOp = operations.find(
      (op: any) => op.path === "/fields/Custom.Severity",
    );
    expect(impactOp?.value).toBe("1 - Critical");
    expect(severityOp?.value).toBe("2 - High");
  });
});
