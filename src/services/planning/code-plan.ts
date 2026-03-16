import type { LocalWorkItemOutput } from "../../schemas/workitem.schema.js";
import type { RepoFeatures } from "./repo-detection.js";

export interface CodePlanRepoContext {
  detectedRepos: RepoFeatures[];
  currentRepoName?: string;
}

/**
 * Generate code implementation planning guidance for a work item.
 * Works for all work item types including Tasks and Bugs.
 * Returns structured guidance that Claude uses to produce an implementation plan.
 *
 * When `repoContext` is provided with detected repos, the guidance includes
 * per-repo sections with detailed guidance for the current repo and abbreviated
 * guidance for other repos.
 */
export function getCodePlanGuidance(
  item: LocalWorkItemOutput,
  repoContext?: CodePlanRepoContext,
): string {
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

  if (item.latestComment) {
    context.push(`## Latest Comment`, item.latestComment, "");
  }

  const hasRepos =
    repoContext &&
    repoContext.detectedRepos &&
    repoContext.detectedRepos.length > 0;

  if (hasRepos) {
    context.push(...buildRepoSections(repoContext!));
  } else {
    context.push(...buildStandardInstructions());
  }

  return context.join("\n");
}

function buildStandardInstructions(): string[] {
  return [
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
  ];
}

function buildRepoSections(repoContext: CodePlanRepoContext): string[] {
  const { detectedRepos } = repoContext;
  const hasCurrentRepo = detectedRepos.some((r) => r.isCurrentRepo);
  const lines: string[] = [];

  // Repositories Involved section
  lines.push(`## Repositories Involved`, ``);
  for (const repo of detectedRepos) {
    const marker = repo.isCurrentRepo ? " (CURRENT REPO)" : "";
    lines.push(`### ${repo.repoName}${marker}`);
    lines.push(`- **Path:** \`${repo.repoPath}\``);
    if (repo.features.length > 0) {
      lines.push(`- **Features:**`);
      for (const f of repo.features) {
        lines.push(`  - ${f}`);
      }
    }
    lines.push(``);
  }

  // Per-repo instructions
  lines.push(`## Instructions`, ``);
  lines.push(
    `Analyze the codebase and produce a code implementation plan for this work item.`,
    ``,
  );

  for (const repo of detectedRepos) {
    const marker = repo.isCurrentRepo ? " (CURRENT REPO)" : "";
    lines.push(`### ${repo.repoName}${marker}`, ``);

    if (hasCurrentRepo && repo.isCurrentRepo) {
      lines.push(...buildDetailedRepoPlan(repo));
    } else if (hasCurrentRepo && !repo.isCurrentRepo) {
      lines.push(...buildAbbreviatedRepoPlan(repo));
    } else {
      // Not in any known repo — equal detail for all
      lines.push(...buildDetailedRepoPlan(repo));
    }
    lines.push(``);
  }

  lines.push(
    `Focus on concrete, actionable guidance. Reference specific files, functions, and patterns from each repository.`,
  );

  return lines;
}

function buildDetailedRepoPlan(repo: RepoFeatures): string[] {
  const featureNote =
    repo.features.length > 0
      ? ` for: ${repo.features.join("; ")}`
      : "";
  return [
    `Your plan for **${repo.repoName}**${featureNote} should include:`,
    `1. **Files to analyze** — List existing files relevant to understanding the change.`,
    `2. **Architectural approach** — How the change fits into the existing codebase architecture.`,
    `3. **Files to modify or create** — Specific files with a summary of changes for each.`,
    `4. **Step-by-step changes** — Ordered implementation steps with enough detail to execute.`,
    `5. **Testing suggestions** — Unit tests, integration tests, or manual verification steps.`,
    `6. **Edge cases and risks** — Potential issues, backwards compatibility concerns, or gotchas.`,
  ];
}

function buildAbbreviatedRepoPlan(repo: RepoFeatures): string[] {
  const featureNote =
    repo.features.length > 0
      ? ` for: ${repo.features.join("; ")}`
      : "";
  return [
    `Your plan for **${repo.repoName}**${featureNote} should include:`,
    `1. **Key changes** — Summary of what needs to change in this repo.`,
    `2. **Interface contracts** — API signatures, shared types, or contracts that other repos depend on.`,
    `3. **Coordination notes** — Dependencies or ordering constraints with other repos.`,
  ];
}
