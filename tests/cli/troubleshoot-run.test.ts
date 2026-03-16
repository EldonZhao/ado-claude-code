import { describe, it, expect, vi, beforeEach } from "vitest";
import type { TsgOutput } from "../../src/schemas/tsg.schema.js";

// Mock storage
const mockStorage = {
  loadById: vi.fn(),
  save: vi.fn(),
  listAll: vi.fn(),
  listByCategory: vi.fn(),
};

vi.mock("../../src/storage/index.js", () => ({
  getInstructionsStorage: async () => mockStorage,
  getTsgStorage: async () => mockStorage,
}));

// Capture output
let captured: unknown;
vi.mock("../../src/cli/helpers.js", () => ({
  output: (data: unknown) => {
    captured = data;
  },
  fatal: (msg: string) => {
    throw new Error(msg);
  },
  parseFlags: (args: string[]) => {
    const flags: Record<string, string> = {};
    for (const arg of args) {
      if (arg.startsWith("--")) {
        const [key, ...rest] = arg.slice(2).split("=");
        flags[key] = rest.join("=") || "";
      }
    }
    return flags;
  },
}));

const { handleTroubleshoot } = await import("../../src/cli/troubleshoot.js");

function makeTsg(overrides?: Partial<TsgOutput>): TsgOutput {
  return {
    id: "tsg-deploy-001",
    title: "Deployment OOM",
    version: "1.0",
    category: "deployment",
    tags: ["deployment", "oom"],
    symptoms: ["pod keeps restarting", "OOMKilled in events"],
    relatedErrors: ["OOMKilled", "CrashLoopBackOff"],
    diagnostics: [
      {
        id: "check-pod",
        name: "Check pod status",
        manual: false,
        command: {
          template: "kubectl get pod {{podName}} -n {{namespace}}",
          parameters: [
            { name: "podName", required: true },
            { name: "namespace", required: true, default: "default" },
          ],
        },
        analysis: {
          lookFor: [
            {
              pattern: "OOMKilled",
              type: "literal",
              indicatesRootCause: "oom",
              severity: "critical",
            },
          ],
        },
      },
    ],
    resolutions: {
      oom: {
        name: "Increase Memory Limit",
        description: "Increase the container memory limit",
        steps: [
          {
            id: "patch-mem",
            action: "Patch deployment memory",
            command: "kubectl set resources deployment/{{deploymentName}} -c {{containerName}} --limits=memory={{memoryLimit}}",
            manual: false,
          },
        ],
      },
    },
    ...overrides,
  };
}

describe("troubleshoot run", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    captured = undefined;
  });

  it("throws without symptoms", async () => {
    await expect(handleTroubleshoot(["run"])).rejects.toThrow("Usage:");
  });

  it("returns no-match message when no TSGs found", async () => {
    mockStorage.listAll.mockResolvedValue([]);
    await handleTroubleshoot(["run", '--symptoms=["totally unknown"]']);

    const result = captured as Record<string, unknown>;
    expect(result.stage).toBe("diagnose");
    expect((result.diagnose as Record<string, unknown>).matched).toBe(0);
    expect(result.message).toContain("No matching TSGs");
  });

  it("returns diagnostic steps when TSG matches", async () => {
    const tsg = makeTsg();
    mockStorage.listAll.mockResolvedValue([tsg]);
    await handleTroubleshoot(["run", '--symptoms=["pod keeps restarting"]', '--parameters={"podName":"my-pod"}']);

    const result = captured as Record<string, unknown>;
    expect(result.tsgId).toBe("tsg-deploy-001");
    expect(result.tsgTitle).toBe("Deployment OOM");
    expect(result.diagnosticSteps).toBeDefined();
    expect((result.diagnosticSteps as unknown[]).length).toBe(1);
    expect(result.nextStep).toBeDefined(); // no --output, so should suggest next step
  });

  it("analyzes output and finds root causes when --output provided", async () => {
    const tsg = makeTsg();
    mockStorage.listAll.mockResolvedValue([tsg]);
    await handleTroubleshoot([
      "run",
      '--symptoms=["pod keeps restarting"]',
      "--output=Last State: Terminated, Reason: OOMKilled",
      '--parameters={"podName":"my-pod"}',
    ]);

    const result = captured as Record<string, unknown>;
    expect(result.tsgId).toBe("tsg-deploy-001");
    const analyze = result.analyze as Record<string, unknown>;
    expect(analyze).toBeDefined();
    expect((analyze.rootCauses as string[])).toContain("oom");
  });

  it("suggests resolution when root cause is found", async () => {
    const tsg = makeTsg();
    mockStorage.listAll.mockResolvedValue([tsg]);
    await handleTroubleshoot([
      "run",
      '--symptoms=["pod keeps restarting"]',
      "--output=Reason: OOMKilled",
      '--parameters={"podName":"my-pod"}',
    ]);

    const result = captured as Record<string, unknown>;
    const suggest = result.suggest as Record<string, unknown>;
    expect(suggest).toBeDefined();
    expect(suggest.rootCause).toBe("oom");
    const resolution = suggest.resolution as Record<string, unknown>;
    expect(resolution.name).toBe("Increase Memory Limit");
  });

  it("handles category filtering", async () => {
    const deployTsg = makeTsg();
    const dbTsg = makeTsg({
      id: "tsg-db-001",
      category: "database",
      symptoms: ["connection timeout"],
      tags: ["database"],
      relatedErrors: [],
      diagnostics: [],
      resolutions: {},
    });
    mockStorage.listAll.mockResolvedValue([deployTsg, dbTsg]);

    await handleTroubleshoot([
      "run",
      '--symptoms=["pod keeps restarting"]',
      "--category=deployment",
    ]);

    const result = captured as Record<string, unknown>;
    // Should match the deployment TSG
    expect(result.tsgId).toBe("tsg-deploy-001");
  });

  it("omits analyze and suggest when no --output and no root causes", async () => {
    const tsg = makeTsg();
    mockStorage.listAll.mockResolvedValue([tsg]);
    await handleTroubleshoot(["run", '--symptoms=["pod keeps restarting"]']);

    const result = captured as Record<string, unknown>;
    expect(result.analyze).toBeUndefined();
    expect(result.suggest).toBeUndefined();
    expect(result.nextStep).toBeDefined();
  });

  it("handles output that does not match any patterns", async () => {
    const tsg = makeTsg();
    mockStorage.listAll.mockResolvedValue([tsg]);
    await handleTroubleshoot([
      "run",
      '--symptoms=["pod keeps restarting"]',
      "--output=everything is fine, no errors",
    ]);

    const result = captured as Record<string, unknown>;
    const analyze = result.analyze as Record<string, unknown>;
    expect(analyze).toBeDefined();
    expect(analyze.matchCount).toBe(0);
    expect((analyze.rootCauses as string[])).toHaveLength(0);
    // No suggest since no root causes
    expect(result.suggest).toBeUndefined();
  });
});
