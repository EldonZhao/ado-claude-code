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

const { handleTsg } = await import("../../src/cli/tsg.js");

function makeTsg(overrides?: Partial<TsgOutput>): TsgOutput {
  return {
    id: "tsg-test-001",
    title: "Test TSG",
    version: "1.0",
    category: "test",
    tags: [],
    symptoms: [],
    relatedErrors: [],
    diagnostics: [],
    resolutions: {},
    ...overrides,
  };
}

describe("tsg score", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    captured = undefined;
  });

  it("returns 0 score for empty TSG", async () => {
    mockStorage.loadById.mockResolvedValue(makeTsg());
    await handleTsg(["score", "tsg-test-001"]);

    const result = captured as Record<string, unknown>;
    expect(result.id).toBe("tsg-test-001");
    expect(result.score).toBe(0);
    expect(result.maxScore).toBe(125);
    expect(result.percentage).toBe(0);
    expect((result.suggestions as string[]).length).toBeGreaterThan(0);
  });

  it("scores symptoms correctly", async () => {
    mockStorage.loadById.mockResolvedValue(
      makeTsg({ symptoms: ["s1", "s2", "s3", "s4", "s5"] }),
    );
    await handleTsg(["score", "tsg-test-001"]);

    const result = captured as Record<string, unknown>;
    const bd = result.breakdown as Record<string, { score: number; max: number }>;
    // 5 symptoms * 5 = 25, capped at 20
    expect(bd.symptoms.score).toBe(20);
    expect(bd.symptoms.max).toBe(20);
  });

  it("scores related errors", async () => {
    mockStorage.loadById.mockResolvedValue(
      makeTsg({ relatedErrors: ["e1", "e2"] }),
    );
    await handleTsg(["score", "tsg-test-001"]);

    const result = captured as Record<string, unknown>;
    const bd = result.breakdown as Record<string, { score: number; max: number }>;
    expect(bd.relatedErrors.score).toBe(10);
  });

  it("scores diagnostics with commands", async () => {
    mockStorage.loadById.mockResolvedValue(
      makeTsg({
        diagnostics: [
          {
            id: "d1",
            name: "Step 1",
            manual: false,
            command: { template: "kubectl get pods" },
          },
          {
            id: "d2",
            name: "Step 2",
            manual: true,
            guidance: "Check dashboard",
          },
        ],
      }),
    );
    await handleTsg(["score", "tsg-test-001"]);

    const result = captured as Record<string, unknown>;
    const bd = result.breakdown as Record<string, { score: number; max: number }>;
    // 1 step with command * 20 = 20
    expect(bd.diagnostics.score).toBe(20);
  });

  it("scores analysis patterns with root causes", async () => {
    mockStorage.loadById.mockResolvedValue(
      makeTsg({
        diagnostics: [
          {
            id: "d1",
            name: "Step 1",
            manual: false,
            command: { template: "kubectl get pods" },
            analysis: {
              lookFor: [
                {
                  pattern: "OOMKilled",
                  type: "literal",
                  indicatesRootCause: "oom",
                  severity: "high",
                },
              ],
            },
          },
        ],
      }),
    );
    await handleTsg(["score", "tsg-test-001"]);

    const result = captured as Record<string, unknown>;
    const bd = result.breakdown as Record<string, { score: number; max: number }>;
    expect(bd.analysisPatterns.score).toBe(5);
  });

  it("scores resolutions with steps", async () => {
    mockStorage.loadById.mockResolvedValue(
      makeTsg({
        resolutions: {
          oom: {
            name: "Fix OOM",
            steps: [
              { id: "r1", action: "Increase memory", manual: false },
            ],
          },
        },
      }),
    );
    await handleTsg(["score", "tsg-test-001"]);

    const result = captured as Record<string, unknown>;
    const bd = result.breakdown as Record<string, { score: number; max: number }>;
    expect(bd.resolutions.score).toBe(15);
  });

  it("scores escalation", async () => {
    mockStorage.loadById.mockResolvedValue(
      makeTsg({
        escalation: {
          timeout: "30m",
          contacts: [{ team: "SRE" }],
        },
      }),
    );
    await handleTsg(["score", "tsg-test-001"]);

    const result = captured as Record<string, unknown>;
    const bd = result.breakdown as Record<string, { score: number; max: number }>;
    expect(bd.escalation.score).toBe(10);
  });

  it("returns max score for fully complete TSG", async () => {
    mockStorage.loadById.mockResolvedValue(
      makeTsg({
        symptoms: ["s1", "s2", "s3", "s4"],
        relatedErrors: ["e1", "e2"],
        diagnostics: [
          {
            id: "d1",
            name: "Step 1",
            manual: false,
            command: { template: "cmd1" },
            analysis: {
              lookFor: [
                { pattern: "p1", type: "literal", indicatesRootCause: "rc1", severity: "high" },
                { pattern: "p2", type: "literal", indicatesRootCause: "rc2", severity: "high" },
                { pattern: "p3", type: "literal", indicatesRootCause: "rc3", severity: "high" },
              ],
            },
          },
          {
            id: "d2",
            name: "Step 2",
            manual: false,
            command: { template: "cmd2" },
          },
        ],
        resolutions: {
          rc1: { name: "Fix 1", steps: [{ id: "r1", action: "a1", manual: false }] },
          rc2: { name: "Fix 2", steps: [{ id: "r2", action: "a2", manual: false }] },
        },
        escalation: { timeout: "15m", contacts: [{ team: "SRE" }] },
      }),
    );
    await handleTsg(["score", "tsg-test-001"]);

    const result = captured as Record<string, unknown>;
    expect(result.score).toBe(125);
    expect(result.percentage).toBe(100);
    expect((result.suggestions as string[])).toHaveLength(0);
  });

  it("throws when no id provided", async () => {
    await expect(handleTsg(["score"])).rejects.toThrow("Usage:");
  });

  it("throws when TSG not found", async () => {
    mockStorage.loadById.mockResolvedValue(null);
    await expect(handleTsg(["score", "tsg-x"])).rejects.toThrow("not found");
  });
});
