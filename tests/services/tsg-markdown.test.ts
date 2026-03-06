import { describe, it, expect } from "vitest";
import {
  tsgToMarkdown,
  markdownToTsg,
} from "../../src/services/tsg/markdown.js";
import type { TsgOutput } from "../../src/schemas/tsg.schema.js";
import { TsgSchema } from "../../src/schemas/tsg.schema.js";

function makeFullTsg(): TsgOutput {
  return TsgSchema.parse({
    id: "tsg-deployment-001",
    title: "Pod OOM Troubleshooting",
    version: "1.0",
    lastUpdated: "2025-01-15",
    author: "Platform Team",
    category: "deployment",
    tags: ["oom", "kubernetes", "pod"],
    symptoms: ["pod keeps restarting", "OOMKilled in events"],
    relatedErrors: ["OOMKilled", "CrashLoopBackOff"],
    applicability: {
      services: ["my-service"],
      environments: ["production"],
      platforms: ["aks"],
    },
    prerequisites: {
      tools: [
        { name: "kubectl" },
        { name: "az", minVersion: "2.0" },
      ],
      permissions: ["cluster read access"],
      context: ["cluster name", "namespace"],
    },
    diagnostics: [
      {
        id: "check-pod-status",
        name: "Check pod status",
        description: "Check the current status of pods in the deployment.",
        manual: false,
        command: {
          template:
            "kubectl get pods -n {{namespace}} -l app={{deploymentName}} -o wide",
          parameters: [
            {
              name: "namespace",
              required: true,
              default: "default",
              description: "Kubernetes namespace",
            },
            {
              name: "deploymentName",
              required: true,
              description: "Name of the deployment",
            },
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
            {
              pattern: "CrashLoopBackOff",
              type: "literal",
              indicatesRootCause: "crash-loop",
              severity: "high",
            },
          ],
        },
      },
      {
        id: "manual-check",
        name: "Check dashboard",
        manual: true,
        guidance: "Check CPU and memory graphs for the last 24 hours.",
      },
    ],
    resolutions: {
      oom: {
        name: "Out of Memory",
        description: "Pod is being killed because it exceeds memory limits.",
        steps: [
          {
            id: "increase-memory-limit",
            action: "Increase memory limit",
            manual: false,
            command:
              "kubectl set resources deployment/{{deploymentName}} -n {{namespace}} --limits=memory=512Mi",
            successCriteria: { pattern: "resource requirements updated" },
          },
          {
            id: "check-memory-leak",
            action: "Investigate memory leak",
            manual: true,
            guidance:
              "Review application logs and profiling data to identify memory leaks.",
          },
        ],
      },
    },
    escalation: {
      timeout: "30m",
      contacts: [
        { team: "Platform Engineering" },
        { team: "SRE", channel: "#sre-oncall" },
      ],
    },
    related: {
      tsgs: ["tsg-performance-001"],
      docs: [
        {
          title: "K8s Resources",
          url: "https://kubernetes.io/docs/concepts/configuration/manage-resources-containers/",
        },
      ],
      runbooks: ["runbook-oom-response"],
    },
  });
}

function makeMinimalTsg(): TsgOutput {
  return TsgSchema.parse({
    id: "tsg-min-001",
    title: "Minimal TSG",
    category: "test",
  });
}

// ─── Round-trip tests ──────────────────────────────────────────

describe("tsgToMarkdown / markdownToTsg round-trips", () => {
  it("round-trips full TSG with all fields", () => {
    const original = makeFullTsg();
    const md = tsgToMarkdown(original);
    const parsed = markdownToTsg(md);
    expect(parsed).toEqual(original);
  });

  it("round-trips minimal TSG (just id, title, category)", () => {
    const original = makeMinimalTsg();
    const md = tsgToMarkdown(original);
    const parsed = markdownToTsg(md);
    expect(parsed).toEqual(original);
  });

  it("round-trips TSG with manual steps and guidance", () => {
    const tsg = TsgSchema.parse({
      id: "tsg-manual-001",
      title: "Manual Guide",
      category: "ops",
      diagnostics: [
        {
          id: "manual-step",
          name: "Manual inspection",
          manual: true,
          guidance: "Open the dashboard and check the graphs.",
        },
      ],
    });
    const md = tsgToMarkdown(tsg);
    const parsed = markdownToTsg(md);
    expect(parsed).toEqual(tsg);
  });

  it("round-trips TSG with analysis patterns (literal + regex types)", () => {
    const tsg = TsgSchema.parse({
      id: "tsg-patterns-001",
      title: "Pattern Matching",
      category: "test",
      diagnostics: [
        {
          id: "step1",
          name: "Check logs",
          manual: false,
          command: { template: "kubectl logs {{pod}}" },
          analysis: {
            lookFor: [
              {
                pattern: "error",
                type: "literal",
                indicatesRootCause: "app-error",
                severity: "high",
              },
              {
                pattern: "AADSTS\\d+",
                type: "regex",
                indicatesRootCause: "aad-error",
                severity: "critical",
              },
            ],
          },
        },
      ],
    });
    const md = tsgToMarkdown(tsg);
    const parsed = markdownToTsg(md);
    expect(parsed).toEqual(tsg);
  });

  it("round-trips TSG with multiple resolutions and success criteria", () => {
    const tsg = TsgSchema.parse({
      id: "tsg-multi-001",
      title: "Multi Resolution",
      category: "test",
      resolutions: {
        "cause-a": {
          name: "Cause A",
          steps: [
            {
              id: "fix-a1",
              action: "First fix",
              manual: false,
              command: "run-fix-a",
              successCriteria: { pattern: "fixed" },
            },
          ],
        },
        "cause-b": {
          name: "Cause B",
          description: "Secondary issue",
          steps: [
            {
              id: "fix-b1",
              action: "Second fix",
              manual: true,
              guidance: "Check manually",
            },
          ],
        },
      },
    });
    const md = tsgToMarkdown(tsg);
    const parsed = markdownToTsg(md);
    expect(parsed).toEqual(tsg);
  });

  it("is idempotent — serialize → parse → serialize produces same output", () => {
    const original = makeFullTsg();
    const md1 = tsgToMarkdown(original);
    const parsed = markdownToTsg(md1);
    const md2 = tsgToMarkdown(parsed);
    expect(md2).toBe(md1);
  });
});

// ─── Serializer tests ──────────────────────────────────────────

describe("tsgToMarkdown", () => {
  it("produces valid frontmatter with --- delimiters", () => {
    const md = tsgToMarkdown(makeMinimalTsg());
    expect(md.startsWith("---\n")).toBe(true);
    expect(md).toContain("\n---\n");
  });

  it("includes title as H1 heading", () => {
    const md = tsgToMarkdown(makeFullTsg());
    expect(md).toContain("# Pod OOM Troubleshooting");
  });

  it("renders diagnostic steps with Step: prefix and [MANUAL] tag", () => {
    const md = tsgToMarkdown(makeFullTsg());
    expect(md).toContain("### Step: check-pod-status — Check pod status\n");
    expect(md).toContain("### Step: manual-check — Check dashboard [MANUAL]");
  });

  it("renders command in backticks after Run", () => {
    const md = tsgToMarkdown(makeFullTsg());
    expect(md).toContain(
      "Run `kubectl get pods -n {{namespace}} -l app={{deploymentName}} -o wide`",
    );
  });

  it("omits empty sections", () => {
    const md = tsgToMarkdown(makeMinimalTsg());
    expect(md).not.toContain("## Diagnostics");
    expect(md).not.toContain("## Resolutions");
    expect(md).not.toContain("## Prerequisites");
    expect(md).not.toContain("## Escalation");
    expect(md).not.toContain("## Related");
  });
});

// ─── Parser tests ──────────────────────────────────────────────

describe("markdownToTsg", () => {
  it("parses frontmatter fields", () => {
    const tsg = markdownToTsg(tsgToMarkdown(makeFullTsg()));
    expect(tsg.id).toBe("tsg-deployment-001");
    expect(tsg.title).toBe("Pod OOM Troubleshooting");
    expect(tsg.category).toBe("deployment");
    expect(tsg.tags).toEqual(["oom", "kubernetes", "pod"]);
    expect(tsg.author).toBe("Platform Team");
  });

  it("extracts diagnostic step id/name from header", () => {
    const tsg = markdownToTsg(tsgToMarkdown(makeFullTsg()));
    expect(tsg.diagnostics[0].id).toBe("check-pod-status");
    expect(tsg.diagnostics[0].name).toBe("Check pod status");
  });

  it("extracts command template from Run `...`", () => {
    const tsg = markdownToTsg(tsgToMarkdown(makeFullTsg()));
    expect(tsg.diagnostics[0].command?.template).toBe(
      "kubectl get pods -n {{namespace}} -l app={{deploymentName}} -o wide",
    );
  });

  it("parses parameter lines with defaults and descriptions", () => {
    const tsg = markdownToTsg(tsgToMarkdown(makeFullTsg()));
    const params = tsg.diagnostics[0].command?.parameters;
    expect(params).toHaveLength(2);
    expect(params![0]).toEqual({
      name: "namespace",
      required: true,
      default: "default",
      description: "Kubernetes namespace",
    });
    expect(params![1]).toEqual({
      name: "deploymentName",
      required: true,
      description: "Name of the deployment",
    });
  });

  it("parses analysis patterns with root cause and severity", () => {
    const tsg = markdownToTsg(tsgToMarkdown(makeFullTsg()));
    const lookFor = tsg.diagnostics[0].analysis?.lookFor;
    expect(lookFor).toHaveLength(2);
    expect(lookFor![0]).toMatchObject({
      pattern: "OOMKilled",
      type: "literal",
      indicatesRootCause: "oom",
      severity: "critical",
    });
  });

  it("returns defaults for missing body sections", () => {
    const md = `---
id: tsg-bare-001
title: Bare TSG
category: test
---

# Bare TSG
`;
    const tsg = markdownToTsg(md);
    expect(tsg.diagnostics).toEqual([]);
    expect(tsg.resolutions).toEqual({});
    expect(tsg.escalation).toBeUndefined();
  });

  it("throws on missing frontmatter", () => {
    expect(() => markdownToTsg("# No frontmatter")).toThrow(
      "missing YAML frontmatter",
    );
  });

  it("validates result through TsgSchema", () => {
    const md = tsgToMarkdown(makeFullTsg());
    const tsg = markdownToTsg(md);
    // If it parsed without throwing, schema validation passed
    expect(tsg.id).toBe("tsg-deployment-001");
    // Double-check via parse
    expect(() => TsgSchema.parse(tsg)).not.toThrow();
  });
});
