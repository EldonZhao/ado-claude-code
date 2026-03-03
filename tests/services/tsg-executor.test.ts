import { describe, it, expect } from "vitest";
import {
  resolveTemplate,
  prepareDiagnosticStep,
  prepareResolution,
  getMissingParameters,
  formatTsgOverview,
} from "../../src/services/tsg/executor.js";
import type { TsgOutput } from "../../src/schemas/tsg.schema.js";

function makeTsg(overrides?: Partial<TsgOutput>): TsgOutput {
  return {
    id: "tsg-test-001",
    title: "Test TSG",
    version: "1.0.0",
    category: "test",
    tags: ["test", "unit"],
    symptoms: ["something is broken"],
    relatedErrors: ["Error 500"],
    diagnostics: [
      {
        id: "diag-1",
        name: "Check status",
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
              type: "contains",
              indicatesRootCause: "memory-limit",
              severity: "high",
            },
          ],
        },
      },
      {
        id: "diag-2",
        name: "Manual check",
        manual: true,
        guidance: "Check the dashboard",
      },
    ],
    resolutions: {
      "memory-limit": {
        name: "Increase Memory",
        description: "Increase the pod memory limit",
        steps: [
          {
            id: "res-1",
            action: "Edit deployment",
            command: "kubectl edit deployment {{name}}",
            manual: false,
          },
          {
            id: "res-2",
            action: "Verify",
            manual: true,
            guidance: "Check to see if the pod is running",
          },
        ],
      },
    },
    ...overrides,
  };
}

describe("resolveTemplate", () => {
  it("replaces placeholders with values", () => {
    expect(
      resolveTemplate("kubectl get pod {{podName}} -n {{namespace}}", {
        podName: "my-pod",
        namespace: "production",
      }),
    ).toBe("kubectl get pod my-pod -n production");
  });

  it("leaves unresolved placeholders intact", () => {
    expect(
      resolveTemplate("kubectl get pod {{podName}} -n {{namespace}}", {
        podName: "my-pod",
      }),
    ).toBe("kubectl get pod my-pod -n {{namespace}}");
  });

  it("handles template with no placeholders", () => {
    expect(resolveTemplate("echo hello", {})).toBe("echo hello");
  });

  it("handles empty params", () => {
    expect(resolveTemplate("{{a}} and {{b}}", {})).toBe("{{a}} and {{b}}");
  });
});

describe("prepareDiagnosticStep", () => {
  it("returns step with resolved command", () => {
    const tsg = makeTsg();
    const result = prepareDiagnosticStep(tsg, "diag-1", {
      parameters: { podName: "web-app", namespace: "prod" },
    });

    expect(result.stepId).toBe("diag-1");
    expect(result.stepName).toBe("Check status");
    expect(result.isManual).toBe(false);
    expect(result.command).toBe("kubectl get pod web-app -n prod");
    expect(result.analysisHints).toHaveLength(1);
    expect(result.analysisHints![0].pattern).toBe("OOMKilled");
  });

  it("returns manual step", () => {
    const tsg = makeTsg();
    const result = prepareDiagnosticStep(tsg, "diag-2", {
      parameters: {},
    });

    expect(result.stepId).toBe("diag-2");
    expect(result.isManual).toBe(true);
    expect(result.command).toBeUndefined();
    expect(result.guidance).toBe("Check the dashboard");
  });

  it("throws for unknown step", () => {
    const tsg = makeTsg();
    expect(() =>
      prepareDiagnosticStep(tsg, "diag-99", { parameters: {} }),
    ).toThrow('Diagnostic step "diag-99" not found');
  });
});

describe("prepareResolution", () => {
  it("returns resolution with resolved commands", () => {
    const tsg = makeTsg();
    const result = prepareResolution(tsg, "memory-limit", {
      parameters: { name: "my-deploy" },
    });

    expect(result.name).toBe("Increase Memory");
    expect(result.resolvedSteps).toHaveLength(2);
    expect(result.resolvedSteps[0].command).toBe(
      "kubectl edit deployment my-deploy",
    );
    expect(result.resolvedSteps[1].command).toBeUndefined();
  });

  it("throws for unknown root cause", () => {
    const tsg = makeTsg();
    expect(() =>
      prepareResolution(tsg, "unknown-cause", { parameters: {} }),
    ).toThrow('Resolution for root cause "unknown-cause" not found');
  });
});

describe("getMissingParameters", () => {
  it("returns missing required params without defaults", () => {
    const tsg = makeTsg();
    const missing = getMissingParameters(tsg, {});
    // podName is required with no default, namespace has a default
    expect(missing).toEqual(["podName"]);
  });

  it("returns empty when all required params provided", () => {
    const tsg = makeTsg();
    const missing = getMissingParameters(tsg, { podName: "x" });
    expect(missing).toEqual([]);
  });
});

describe("formatTsgOverview", () => {
  it("includes key sections", () => {
    const tsg = makeTsg({ author: "test-author" });
    const overview = formatTsgOverview(tsg);

    expect(overview).toContain("# Test TSG");
    expect(overview).toContain("tsg-test-001");
    expect(overview).toContain("Author: test-author");
    expect(overview).toContain("Tags: test, unit");
    expect(overview).toContain("## Symptoms");
    expect(overview).toContain("something is broken");
    expect(overview).toContain("## Diagnostic Steps");
    expect(overview).toContain("diag-1: Check status");
    expect(overview).toContain("## Resolutions");
    expect(overview).toContain("memory-limit");
  });

  it("includes escalation info", () => {
    const tsg = makeTsg({
      escalation: {
        timeout: "30m",
        contacts: [{ team: "SRE", channel: "#sre-oncall" }],
      },
    });
    const overview = formatTsgOverview(tsg);
    expect(overview).toContain("## Escalation");
    expect(overview).toContain("Timeout: 30m");
    expect(overview).toContain("SRE");
  });
});
