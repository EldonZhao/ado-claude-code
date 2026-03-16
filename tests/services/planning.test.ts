import { describe, it, expect } from "vitest";
import { HIERARCHY, TEMPLATES, getDepthLabel } from "../../src/services/planning/templates.js";
import {
  createBreakdownProposal,
  formatProposal,
  getBreakdownGuidance,
} from "../../src/services/planning/breakdown.js";
import type { LocalWorkItemOutput } from "../../src/schemas/workitem.schema.js";

function makeParent(
  overrides?: Partial<LocalWorkItemOutput>,
): LocalWorkItemOutput {
  return {
    id: 100,
    rev: 1,
    url: "https://example.com",
    syncedAt: "2026-03-03T00:00:00.000Z",
    type: "Epic",
    title: "Test Epic",
    state: "Active",
    ...overrides,
  };
}

describe("HIERARCHY", () => {
  it("Epic breaks down to Feature", () => {
    expect(HIERARCHY["Epic"]).toEqual(["Feature"]);
  });

  it("Feature breaks down to User Story", () => {
    expect(HIERARCHY["Feature"]).toEqual(["User Story"]);
  });

  it("User Story breaks down to Task", () => {
    expect(HIERARCHY["User Story"]).toEqual(["Task"]);
  });

  it("Task breaks down to Task (sub-tasks)", () => {
    expect(HIERARCHY["Task"]).toEqual(["Task"]);
  });

  it("Bug breaks down to Task", () => {
    expect(HIERARCHY["Bug"]).toEqual(["Task"]);
  });
});

describe("TEMPLATES", () => {
  it("User Story has title prefix", () => {
    expect(TEMPLATES["User Story"].titlePrefix).toBe("As a user, ");
  });

  it("all types have a template", () => {
    for (const type of ["Epic", "Feature", "User Story", "Task", "Bug"] as const) {
      expect(TEMPLATES[type]).toBeDefined();
      expect(TEMPLATES[type].type).toBe(type);
    }
  });
});

describe("getDepthLabel", () => {
  it("returns single type for depth 0", () => {
    expect(getDepthLabel("Epic", 0)).toBe("Epic");
  });

  it("returns chain for depth 1", () => {
    expect(getDepthLabel("Epic", 1)).toBe("Epic → Feature");
  });

  it("returns full chain for depth 3", () => {
    expect(getDepthLabel("Epic", 3)).toBe(
      "Epic → Feature → User Story → Task",
    );
  });

  it("chains for Task→Task", () => {
    expect(getDepthLabel("Task", 5)).toBe("Task → Task → Task → Task → Task → Task");
  });

  it("works for Bug", () => {
    expect(getDepthLabel("Bug", 1)).toBe("Bug → Task");
  });
});

describe("createBreakdownProposal", () => {
  it("creates proposal for Epic→Feature", () => {
    const parent = makeParent();
    const items = [
      { type: "Feature" as const, title: "Feature 1" },
      { type: "Feature" as const, title: "Feature 2" },
    ];

    const proposal = createBreakdownProposal(parent, items);
    expect(proposal.parent.id).toBe(100);
    expect(proposal.childType).toBe("Feature");
    expect(proposal.items).toHaveLength(2);
    expect(proposal.hierarchyPath).toBe("Epic → Feature");
  });

  it("corrects mismatched child types", () => {
    const parent = makeParent();
    const items = [
      { type: "Task" as const, title: "Wrong type" },
    ];

    const proposal = createBreakdownProposal(parent, items);
    // Should correct to Feature (Epic's child type)
    expect(proposal.items[0].type).toBe("Feature");
  });

  it("creates proposal for Task→Task", () => {
    const parent = makeParent({ type: "Task" });
    const items = [
      { type: "Task" as const, title: "Sub task 1" },
    ];

    const proposal = createBreakdownProposal(parent, items);
    expect(proposal.parent.id).toBe(100);
    expect(proposal.childType).toBe("Task");
    expect(proposal.items).toHaveLength(1);
    expect(proposal.hierarchyPath).toBe("Task → Task");
  });
});

describe("formatProposal", () => {
  it("formats proposal with items", () => {
    const parent = makeParent();
    const proposal = createBreakdownProposal(parent, [
      {
        type: "Feature" as const,
        title: "Feature A",
        description: "Description A",
        priority: 1,
        storyPoints: 8,
      },
    ]);

    const output = formatProposal(proposal);
    expect(output).toContain("## Breakdown Proposal");
    expect(output).toContain("Parent: #100");
    expect(output).toContain("Feature A");
    expect(output).toContain("Priority: 1");
    expect(output).toContain("Points: 8");
    expect(output).toContain("Description A");
  });

  it("formats nested children", () => {
    const parent = makeParent({ type: "Feature" });
    const proposal = createBreakdownProposal(parent, [
      {
        type: "User Story" as const,
        title: "Story A",
        children: [
          { type: "Task" as const, title: "Task 1" },
          { type: "Task" as const, title: "Task 2" },
        ],
      },
    ]);

    const output = formatProposal(proposal);
    expect(output).toContain("Sub-items:");
    expect(output).toContain("[Task] Task 1");
    expect(output).toContain("[Task] Task 2");
  });
});

describe("getBreakdownGuidance", () => {
  it("returns guidance for Epic", () => {
    const parent = makeParent();
    const guidance = getBreakdownGuidance(parent);
    expect(guidance).toContain("Break down this Epic into Feature(s)");
    expect(guidance).toContain("#100");
    expect(guidance).toContain("ado_workitems_workitem_plan");
  });

  it("includes description when available", () => {
    const parent = makeParent({ description: "My epic description" });
    const guidance = getBreakdownGuidance(parent);
    expect(guidance).toContain("My epic description");
  });

  it("returns guidance for Task breakdown", () => {
    const parent = makeParent({ type: "Task" });
    const guidance = getBreakdownGuidance(parent);
    expect(guidance).toContain("Break down this Task into Task(s)");
  });
});
