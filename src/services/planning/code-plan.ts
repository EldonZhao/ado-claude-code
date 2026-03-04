import type { LocalWorkItemOutput } from "../../schemas/work-item.schema.js";

/**
 * Generate code implementation planning guidance for a work item.
 * Works for all work item types including Tasks and Bugs.
 * Returns structured guidance that Claude uses to produce an implementation plan.
 */
export function getCodePlanGuidance(item: LocalWorkItemOutput): string {
  const context = [
    `## Work Item Context`,
    `- **ID:** #${item.id}`,
    `- **Type:** ${item.type}`,
    `- **Title:** ${item.title}`,
    `- **State:** ${item.state}`,
  ];

  if (item.priority) context.push(`- **Priority:** ${item.priority}`);
  if (item.assignedTo) context.push(`- **Assigned To:** ${item.assignedTo}`);
  if (item.areaPath) context.push(`- **Area Path:** ${item.areaPath}`);
  if (item.iterationPath)
    context.push(`- **Iteration Path:** ${item.iterationPath}`);

  context.push("");

  if (item.description) {
    context.push(`## Description`, item.description, "");
  } else {
    context.push(
      `## Description`,
      `_No description provided. Use the title and any linked items for context._`,
      "",
    );
  }

  context.push(
    `## Instructions`,
    ``,
    `Analyze the codebase and produce a code implementation plan for this work item.`,
    ``,
    `Your plan should include:`,
    `1. **Files to analyze** — List existing files relevant to understanding the change.`,
    `2. **Architectural approach** — How the change fits into the existing codebase architecture.`,
    `3. **Files to modify or create** — Specific files with a summary of changes for each.`,
    `4. **Step-by-step changes** — Ordered implementation steps with enough detail to execute.`,
    `5. **Testing suggestions** — Unit tests, integration tests, or manual verification steps.`,
    `6. **Edge cases and risks** — Potential issues, backwards compatibility concerns, or gotchas.`,
    ``,
    `Focus on concrete, actionable guidance. Reference specific files, functions, and patterns from the codebase.`,
  );

  return context.join("\n");
}
