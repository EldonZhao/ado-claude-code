import { describe, it, expect } from "vitest";
import { TsgService } from "../../src/services/tsg/index.js";
import type { TsgStorage } from "../../src/storage/tsg.js";
import type { TsgOutput } from "../../src/schemas/tsg.schema.js";

function makeTsg(overrides: Partial<TsgOutput>): TsgOutput {
  return {
    id: "tsg-default",
    title: "Default TSG",
    version: "1.0.0",
    category: "general",
    tags: [],
    symptoms: [],
    relatedErrors: [],
    diagnostics: [],
    resolutions: {},
    ...overrides,
  };
}

function makeMockStorage(tsgs: TsgOutput[]): TsgStorage {
  return {
    listAll: async () => tsgs,
  } as unknown as TsgStorage;
}

describe("TsgService.search", () => {
  const tsgs = [
    makeTsg({
      id: "tsg-k8s-001",
      title: "Kubernetes Pod CrashLoopBackOff",
      category: "kubernetes",
      tags: ["kubernetes", "pod", "crash"],
      symptoms: ["pod status CrashLoopBackOff", "container keeps restarting"],
      relatedErrors: ["CrashLoopBackOff", "OOMKilled"],
    }),
    makeTsg({
      id: "tsg-db-001",
      title: "Database Connection Timeout",
      category: "database",
      tags: ["database", "timeout", "connection"],
      symptoms: ["connection timeout", "cannot connect to database"],
      relatedErrors: ["ETIMEDOUT", "connection refused"],
    }),
    makeTsg({
      id: "tsg-deploy-001",
      title: "Deployment Pipeline Failure",
      category: "deployment",
      tags: ["deployment", "pipeline", "ci"],
      symptoms: ["deployment failed", "build error"],
      relatedErrors: ["exit code 1"],
    }),
  ];

  it("returns empty when no symptoms match", async () => {
    const service = new TsgService(makeMockStorage(tsgs));
    const results = await service.search({
      symptoms: ["something totally unrelated xyz"],
    });
    expect(results).toHaveLength(0);
  });

  it("matches by symptom", async () => {
    const service = new TsgService(makeMockStorage(tsgs));
    const results = await service.search({
      symptoms: ["CrashLoopBackOff"],
    });
    expect(results.length).toBeGreaterThan(0);
    expect(results[0].tsg.id).toBe("tsg-k8s-001");
  });

  it("matches by tag", async () => {
    const service = new TsgService(makeMockStorage(tsgs));
    const results = await service.search({ tags: ["database"] });
    expect(results.length).toBeGreaterThan(0);
    expect(results[0].tsg.id).toBe("tsg-db-001");
  });

  it("filters by category", async () => {
    const service = new TsgService(makeMockStorage(tsgs));
    const results = await service.search({
      symptoms: ["failed"],
      category: "deployment",
    });
    // Should only match deployment TSGs
    for (const r of results) {
      expect(r.tsg.category).toBe("deployment");
    }
  });

  it("matches by free text", async () => {
    const service = new TsgService(makeMockStorage(tsgs));
    const results = await service.search({ text: "Database Connection" });
    expect(results.length).toBeGreaterThan(0);
    expect(results[0].tsg.id).toBe("tsg-db-001");
  });

  it("sorts by score descending", async () => {
    const service = new TsgService(makeMockStorage(tsgs));
    const results = await service.search({
      text: "kubernetes pod crash",
      symptoms: ["CrashLoopBackOff"],
      tags: ["kubernetes"],
    });
    expect(results.length).toBeGreaterThan(0);
    // Scores should be in descending order
    for (let i = 1; i < results.length; i++) {
      expect(results[i - 1].score).toBeGreaterThanOrEqual(results[i].score);
    }
  });

  it("matches related errors", async () => {
    const service = new TsgService(makeMockStorage(tsgs));
    const results = await service.search({
      symptoms: ["ETIMEDOUT"],
    });
    expect(results.length).toBeGreaterThan(0);
    expect(results[0].tsg.id).toBe("tsg-db-001");
  });

  it("tag matching is case-insensitive", async () => {
    const service = new TsgService(makeMockStorage(tsgs));
    const results = await service.search({ tags: ["KUBERNETES"] });
    expect(results.length).toBeGreaterThan(0);
    expect(results[0].tsg.id).toBe("tsg-k8s-001");
  });
});
