import { describe, it, expect } from "vitest";
import { getCodePlanGuidance } from "../../src/services/planning/code-plan.js";
import type { LocalWorkItemOutput } from "../../src/schemas/work-item.schema.js";

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
