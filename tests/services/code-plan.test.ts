import { describe, it, expect } from "vitest";
import { getCodePlanGuidance, type CodePlanRepoContext } from "../../src/services/planning/code-plan.js";
import type { LocalWorkItemOutput } from "../../src/schemas/workitem.schema.js";
import type { RepoFeatures } from "../../src/services/planning/repo-detection.js";

function makeItem(
  overrides?: Partial<LocalWorkItemOutput>,
): LocalWorkItemOutput {
  return {
    id: 200,
    rev: 1,
    url: "https://example.com",
    syncedAt: "2026-03-04T00:00:00.000Z",
    type: "Task",
    title: "Implement login validation",
    state: "Active",
    ...overrides,
  };
}

describe("getCodePlanGuidance", () => {
  it("returns guidance containing work item id and title", () => {
    const item = makeItem();
    const guidance = getCodePlanGuidance(item);
    expect(guidance).toContain("#200");
    expect(guidance).toContain("Implement login validation");
  });

  it("includes description when available", () => {
    const item = makeItem({ description: "Add email format validation to login form" });
    const guidance = getCodePlanGuidance(item);
    expect(guidance).toContain("Add email format validation to login form");
  });

  it("handles items without description", () => {
    const item = makeItem({ description: undefined });
    const guidance = getCodePlanGuidance(item);
    expect(guidance).toContain("No description provided");
  });

  it("works for Task type", () => {
    const item = makeItem({ type: "Task" });
    const guidance = getCodePlanGuidance(item);
    expect(guidance).toContain("**Type:** Task");
    expect(guidance).toContain("code implementation plan");
  });

  it("works for Bug type", () => {
    const item = makeItem({ type: "Bug", title: "Fix null pointer in auth" });
    const guidance = getCodePlanGuidance(item);
    expect(guidance).toContain("**Type:** Bug");
    expect(guidance).toContain("Fix null pointer in auth");
  });

  it("works for Epic type", () => {
    const item = makeItem({ type: "Epic", title: "Platform Redesign" });
    const guidance = getCodePlanGuidance(item);
    expect(guidance).toContain("**Type:** Epic");
    expect(guidance).toContain("Platform Redesign");
  });

  it("works for Feature type", () => {
    const item = makeItem({ type: "Feature", title: "SSO Integration" });
    const guidance = getCodePlanGuidance(item);
    expect(guidance).toContain("**Type:** Feature");
  });

  it("works for User Story type", () => {
    const item = makeItem({ type: "User Story", title: "As a user, I want to reset my password" });
    const guidance = getCodePlanGuidance(item);
    expect(guidance).toContain("**Type:** User Story");
  });

  it("includes priority when available", () => {
    const item = makeItem({ priority: 1 });
    const guidance = getCodePlanGuidance(item);
    expect(guidance).toContain("**Priority:** 1");
  });

  it("includes state", () => {
    const item = makeItem({ state: "New" });
    const guidance = getCodePlanGuidance(item);
    expect(guidance).toContain("**State:** New");
  });

  it("includes latestComment when available", () => {
    const item = makeItem({ latestComment: "Please also handle the edge case for empty input" });
    const guidance = getCodePlanGuidance(item);
    expect(guidance).toContain("## Latest Comment");
    expect(guidance).toContain("Please also handle the edge case for empty input");
  });

  it("excludes Latest Comment section when latestComment is undefined", () => {
    const item = makeItem({ latestComment: undefined });
    const guidance = getCodePlanGuidance(item);
    expect(guidance).not.toContain("## Latest Comment");
  });

  it("includes implementation plan structure requirements", () => {
    const item = makeItem();
    const guidance = getCodePlanGuidance(item);
    expect(guidance).toContain("Files to analyze");
    expect(guidance).toContain("Architectural approach");
    expect(guidance).toContain("Files to modify or create");
    expect(guidance).toContain("Step-by-step changes");
    expect(guidance).toContain("Testing suggestions");
    expect(guidance).toContain("Edge cases and risks");
  });
});

describe("getCodePlanGuidance with repo context", () => {
  function makeRepo(overrides?: Partial<RepoFeatures>): RepoFeatures {
    return {
      repoName: "backend",
      repoPath: "/projects/backend",
      features: [],
      isCurrentRepo: false,
      ...overrides,
    };
  }

  it("includes repo sections when repoContext is provided", () => {
    const item = makeItem();
    const repoContext: CodePlanRepoContext = {
      detectedRepos: [
        makeRepo({ repoName: "backend", isCurrentRepo: true, features: ["Add auth"] }),
        makeRepo({ repoName: "frontend", repoPath: "/projects/frontend", features: ["Login page"] }),
      ],
      currentRepoName: "backend",
    };
    const guidance = getCodePlanGuidance(item, repoContext);
    expect(guidance).toContain("## Repositories Involved");
    expect(guidance).toContain("### backend (CURRENT REPO)");
    expect(guidance).toContain("### frontend");
    expect(guidance).toContain("Add auth");
    expect(guidance).toContain("Login page");
  });

  it("falls back to standard guidance when no repoContext", () => {
    const item = makeItem();
    const guidance = getCodePlanGuidance(item);
    expect(guidance).not.toContain("## Repositories Involved");
    expect(guidance).toContain("## Instructions");
    expect(guidance).toContain("Files to analyze");
  });

  it("falls back when repoContext has empty detectedRepos", () => {
    const item = makeItem();
    const repoContext: CodePlanRepoContext = { detectedRepos: [] };
    const guidance = getCodePlanGuidance(item, repoContext);
    expect(guidance).not.toContain("## Repositories Involved");
    expect(guidance).toContain("## Instructions");
    expect(guidance).toContain("Files to analyze");
  });

  it("shows detailed guidance for current repo and abbreviated for others", () => {
    const item = makeItem();
    const repoContext: CodePlanRepoContext = {
      detectedRepos: [
        makeRepo({ repoName: "backend", isCurrentRepo: true }),
        makeRepo({ repoName: "frontend", repoPath: "/projects/frontend" }),
      ],
      currentRepoName: "backend",
    };
    const guidance = getCodePlanGuidance(item, repoContext);
    // Current repo gets full 6-point plan
    expect(guidance).toContain("Files to analyze");
    expect(guidance).toContain("Architectural approach");
    // Other repo gets abbreviated 3-point plan
    expect(guidance).toContain("Key changes");
    expect(guidance).toContain("Interface contracts");
    expect(guidance).toContain("Coordination notes");
  });

  it("shows equal guidance for all repos when not in any known repo", () => {
    const item = makeItem();
    const repoContext: CodePlanRepoContext = {
      detectedRepos: [
        makeRepo({ repoName: "backend", isCurrentRepo: false }),
        makeRepo({ repoName: "frontend", repoPath: "/projects/frontend", isCurrentRepo: false }),
      ],
    };
    const guidance = getCodePlanGuidance(item, repoContext);
    // Both repos should get detailed plans (no Key changes / Interface contracts)
    expect(guidance).not.toContain("Key changes");
    expect(guidance).not.toContain("Interface contracts");
    // Count occurrences of "Files to analyze" — should appear once per repo
    const matches = guidance.match(/Files to analyze/g);
    expect(matches).toHaveLength(2);
  });

  it("handles repos with no specific features listed", () => {
    const item = makeItem();
    const repoContext: CodePlanRepoContext = {
      detectedRepos: [
        makeRepo({ repoName: "backend", isCurrentRepo: true, features: [] }),
      ],
      currentRepoName: "backend",
    };
    const guidance = getCodePlanGuidance(item, repoContext);
    expect(guidance).toContain("### backend (CURRENT REPO)");
    expect(guidance).not.toContain("**Features:**");
    // Plan text should not include "for:" when no features
    expect(guidance).toContain("Your plan for **backend** should include:");
  });

  it("includes feature note in plan header when features exist", () => {
    const item = makeItem();
    const repoContext: CodePlanRepoContext = {
      detectedRepos: [
        makeRepo({ repoName: "backend", isCurrentRepo: true, features: ["Add auth", "Add logging"] }),
      ],
      currentRepoName: "backend",
    };
    const guidance = getCodePlanGuidance(item, repoContext);
    expect(guidance).toContain("Your plan for **backend** for: Add auth; Add logging should include:");
  });
});
