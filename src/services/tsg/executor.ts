import type { TsgOutput, DiagnosticStep, Resolution } from "../../schemas/tsg.schema.js";
import { TsgError } from "../../utils/errors.js";
import { logger } from "../../utils/logger.js";

export interface ExecutionContext {
  parameters: Record<string, string>;
}

export interface StepExecutionResult {
  stepId: string;
  stepName: string;
  command?: string;
  isManual: boolean;
  guidance?: string;
  analysisHints?: Array<{
    pattern: string;
    indicatesRootCause?: string;
    severity?: string;
  }>;
}

/**
 * Resolves {{param}} placeholders in a command template.
 */
export function resolveTemplate(
  template: string,
  params: Record<string, string>,
): string {
  return template.replace(/\{\{(\w+)\}\}/g, (_, key: string) => {
    if (key in params) return params[key];
    return `{{${key}}}`;
  });
}

/**
 * Get a specific diagnostic step from a TSG, ready for execution.
 */
export function prepareDiagnosticStep(
  tsg: TsgOutput,
  stepId: string,
  context: ExecutionContext,
): StepExecutionResult {
  const step = tsg.diagnostics.find((d) => d.id === stepId);
  if (!step) {
    throw new TsgError(
      `Diagnostic step "${stepId}" not found in TSG "${tsg.id}"`,
    );
  }

  const resolved: StepExecutionResult = {
    stepId: step.id,
    stepName: step.name,
    isManual: step.manual,
    guidance: step.guidance,
  };

  if (step.command) {
    resolved.command = resolveTemplate(
      step.command.template,
      context.parameters,
    );
  }

  if (step.analysis?.lookFor) {
    resolved.analysisHints = step.analysis.lookFor.map((p) => ({
      pattern: p.pattern,
      indicatesRootCause: p.indicatesRootCause,
      severity: p.severity,
    }));
  }

  return resolved;
}

/**
 * Get a resolution plan for a specific root cause.
 */
export function prepareResolution(
  tsg: TsgOutput,
  rootCause: string,
  context: ExecutionContext,
): Resolution & { resolvedSteps: Array<{ command?: string }> } {
  const resolution = tsg.resolutions[rootCause];
  if (!resolution) {
    throw new TsgError(
      `Resolution for root cause "${rootCause}" not found in TSG "${tsg.id}". ` +
        `Available: ${Object.keys(tsg.resolutions).join(", ")}`,
    );
  }

  const resolvedSteps = resolution.steps.map((step) => ({
    command: step.command
      ? resolveTemplate(step.command, context.parameters)
      : undefined,
  }));

  return { ...resolution, resolvedSteps };
}

/**
 * List missing parameters required for a TSG's diagnostic steps.
 */
export function getMissingParameters(
  tsg: TsgOutput,
  provided: Record<string, string>,
): string[] {
  const required = new Set<string>();

  for (const step of tsg.diagnostics) {
    if (step.command?.parameters) {
      for (const param of step.command.parameters) {
        if (param.required && !(param.name in provided) && !param.default) {
          required.add(param.name);
        }
      }
    }
  }

  return Array.from(required);
}

/**
 * Format a full TSG overview for display.
 */
export function formatTsgOverview(tsg: TsgOutput): string {
  const lines: string[] = [
    `# ${tsg.title}`,
    `ID: ${tsg.id} | Category: ${tsg.category} | Version: ${tsg.version}`,
  ];

  if (tsg.author) lines.push(`Author: ${tsg.author}`);
  if (tsg.tags.length > 0) lines.push(`Tags: ${tsg.tags.join(", ")}`);
  if (tsg.symptoms.length > 0) {
    lines.push("", "## Symptoms");
    for (const s of tsg.symptoms) lines.push(`- ${s}`);
  }
  if (tsg.relatedErrors.length > 0) {
    lines.push("", "## Related Errors");
    for (const e of tsg.relatedErrors) lines.push(`- ${e}`);
  }
  if (tsg.prerequisites) {
    lines.push("", "## Prerequisites");
    if (tsg.prerequisites.tools) {
      for (const t of tsg.prerequisites.tools) {
        lines.push(`- ${t.name}${t.minVersion ? ` >= ${t.minVersion}` : ""}`);
      }
    }
    if (tsg.prerequisites.context) {
      lines.push("Required context:");
      for (const c of tsg.prerequisites.context) lines.push(`  - ${c}`);
    }
  }
  if (tsg.diagnostics.length > 0) {
    lines.push("", "## Diagnostic Steps");
    for (const d of tsg.diagnostics) {
      lines.push(
        `${d.id}: ${d.name}${d.manual ? " [MANUAL]" : ""}` +
          (d.command ? ` — \`${d.command.template}\`` : ""),
      );
    }
  }
  if (Object.keys(tsg.resolutions).length > 0) {
    lines.push("", "## Resolutions");
    for (const [key, res] of Object.entries(tsg.resolutions)) {
      lines.push(`- **${key}**: ${res.name} (${res.steps.length} steps)`);
    }
  }
  if (tsg.escalation) {
    lines.push("", "## Escalation");
    if (tsg.escalation.timeout) lines.push(`Timeout: ${tsg.escalation.timeout}`);
    if (tsg.escalation.contacts) {
      for (const c of tsg.escalation.contacts) {
        lines.push(`- ${c.team}${c.channel ? ` (${c.channel})` : ""}`);
      }
    }
  }

  return lines.join("\n");
}
