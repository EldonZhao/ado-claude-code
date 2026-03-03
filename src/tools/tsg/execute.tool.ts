import { z } from "zod/v4";
import type { ToolDefinition } from "../../types/index.js";
import { getTsgStorage } from "../../storage/index.js";
import {
  prepareDiagnosticStep,
  prepareResolution,
  getMissingParameters,
} from "../../services/tsg/executor.js";

const inputSchema = z.object({
  id: z.string().describe("TSG ID"),
  stepId: z.string().optional().describe("Specific diagnostic step ID to execute"),
  rootCause: z
    .string()
    .optional()
    .describe("Root cause key to get resolution steps for"),
  parameters: z
    .record(z.string(), z.string())
    .optional()
    .describe("Template parameters (e.g., {podName: 'my-pod', namespace: 'default'})"),
});

export const executeTsgTool: ToolDefinition = {
  name: "tsg_execute",
  description:
    "Execute a TSG step or get resolution steps. Provide stepId for a diagnostic step, " +
    "or rootCause for resolution steps. Commands are returned with parameters resolved — " +
    "you can then run them via shell.",
  inputSchema: z.toJSONSchema(inputSchema) as Record<string, unknown>,
  handler: async (params: unknown) => {
    const input = inputSchema.parse(params);
    const storage = await getTsgStorage();
    const tsg = await storage.loadById(input.id);

    if (!tsg) {
      return {
        content: [
          { type: "text" as const, text: `TSG "${input.id}" not found.` },
        ],
        isError: true,
      };
    }

    const context = { parameters: input.parameters ?? {} };

    // Check for missing parameters
    const missing = getMissingParameters(tsg, context.parameters);
    if (missing.length > 0 && !input.rootCause) {
      return {
        content: [
          {
            type: "text" as const,
            text:
              `Missing required parameters: ${missing.join(", ")}\n\n` +
              "Please provide these in the 'parameters' field.",
          },
        ],
        isError: true,
      };
    }

    // Execute specific diagnostic step
    if (input.stepId) {
      const result = prepareDiagnosticStep(tsg, input.stepId, context);
      const lines = [`## Diagnostic Step: ${result.stepName}`];

      if (result.isManual) {
        lines.push("[MANUAL STEP]");
        if (result.guidance) lines.push("", result.guidance);
      } else if (result.command) {
        lines.push("", "Command to run:", "```", result.command, "```");
      }

      if (result.analysisHints && result.analysisHints.length > 0) {
        lines.push("", "Analysis — look for:");
        for (const hint of result.analysisHints) {
          lines.push(
            `- Pattern: \`${hint.pattern}\`` +
              (hint.indicatesRootCause
                ? ` → root cause: **${hint.indicatesRootCause}**`
                : "") +
              (hint.severity ? ` (${hint.severity})` : ""),
          );
        }
      }

      return {
        content: [{ type: "text" as const, text: lines.join("\n") }],
      };
    }

    // Get resolution plan
    if (input.rootCause) {
      const resolution = prepareResolution(tsg, input.rootCause, context);
      const lines = [
        `## Resolution: ${resolution.name}`,
        resolution.description ?? "",
        "",
        "Steps:",
      ];

      for (let i = 0; i < resolution.steps.length; i++) {
        const step = resolution.steps[i];
        const resolved = resolution.resolvedSteps[i];
        lines.push(
          `\n### ${step.id}: ${step.action}` +
            (step.manual ? " [MANUAL]" : ""),
        );
        if (step.description) lines.push(step.description);
        if (resolved.command) {
          lines.push("```", resolved.command, "```");
        }
        if (step.guidance) lines.push("", step.guidance);
        if (step.successCriteria) {
          lines.push(
            `Success: look for \`${step.successCriteria.pattern}\``,
          );
        }
      }

      return {
        content: [{ type: "text" as const, text: lines.join("\n") }],
      };
    }

    // No stepId or rootCause — list available steps
    const lines = [`## TSG: ${tsg.title}`, ""];

    if (tsg.diagnostics.length > 0) {
      lines.push("Available diagnostic steps:");
      for (const d of tsg.diagnostics) {
        lines.push(`  - ${d.id}: ${d.name}`);
      }
    }

    if (Object.keys(tsg.resolutions).length > 0) {
      lines.push("", "Available resolutions (by root cause):");
      for (const [key, res] of Object.entries(tsg.resolutions)) {
        lines.push(`  - ${key}: ${res.name}`);
      }
    }

    lines.push(
      "",
      "Provide 'stepId' for a diagnostic step or 'rootCause' for resolution.",
    );

    return {
      content: [{ type: "text" as const, text: lines.join("\n") }],
    };
  },
};
