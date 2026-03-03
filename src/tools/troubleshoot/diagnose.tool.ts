import { z } from "zod/v4";
import type { ToolDefinition } from "../../types/index.js";
import { getTsgStorage } from "../../storage/index.js";
import { TsgService } from "../../services/tsg/index.js";
import { getMissingParameters, formatTsgOverview } from "../../services/tsg/executor.js";

const inputSchema = z.object({
  symptoms: z
    .array(z.string())
    .min(1)
    .describe("List of observed symptoms or error messages"),
  category: z.string().optional().describe("Limit search to this TSG category"),
  service: z.string().optional().describe("Service or component name for context"),
  environment: z.string().optional().describe("Environment (e.g., production, staging)"),
});

export const diagnoseTool: ToolDefinition = {
  name: "troubleshoot_diagnose",
  description:
    "Start a troubleshooting session. Provide symptoms or error messages and get matched TSGs " +
    "with recommended diagnostic steps to run. This is the entry point for AI-assisted troubleshooting.",
  inputSchema: z.toJSONSchema(inputSchema) as Record<string, unknown>,
  handler: async (params: unknown) => {
    const input = inputSchema.parse(params);
    const storage = await getTsgStorage();
    const service = new TsgService(storage);

    // Search for matching TSGs
    const results = await service.search({
      symptoms: input.symptoms,
      category: input.category,
    });

    if (results.length === 0) {
      return {
        content: [
          {
            type: "text" as const,
            text:
              "No matching TSGs found for the reported symptoms.\n\n" +
              "Suggestions:\n" +
              "- Try rephrasing the symptoms\n" +
              "- Use tsg_list to see available TSGs\n" +
              "- Create a new TSG with tsg_create for this issue pattern",
          },
        ],
      };
    }

    const lines: string[] = [
      `## Troubleshooting: Found ${results.length} matching TSG(s)`,
      "",
      `Symptoms reported:`,
      ...input.symptoms.map((s) => `- ${s}`),
      "",
    ];

    if (input.service) lines.push(`Service: ${input.service}`);
    if (input.environment) lines.push(`Environment: ${input.environment}`);
    lines.push("");

    // Show top matches with their first diagnostic steps
    const topResults = results.slice(0, 3);
    for (const result of topResults) {
      const tsg = result.tsg;
      lines.push(`### ${tsg.id}: ${tsg.title} (score: ${result.score})`);
      lines.push(`Matched on: ${result.matchedOn.join(", ")}`);

      // Show prerequisites context
      const missingParams = getMissingParameters(tsg, {});
      if (missingParams.length > 0) {
        lines.push(
          `\n⚠️ Required context: ${missingParams.join(", ")}`,
        );
      }

      // Show first diagnostic steps
      if (tsg.diagnostics.length > 0) {
        lines.push("\nRecommended diagnostic steps:");
        const stepsToShow = tsg.diagnostics.slice(0, 3);
        for (const step of stepsToShow) {
          lines.push(`  ${step.id}: ${step.name}`);
          if (step.command) {
            lines.push(`    Command: \`${step.command.template}\``);
          }
          if (step.manual) {
            lines.push(`    [MANUAL STEP]`);
          }
        }
        if (tsg.diagnostics.length > 3) {
          lines.push(`  ... and ${tsg.diagnostics.length - 3} more steps`);
        }
      }

      // Show available resolutions
      const resKeys = Object.keys(tsg.resolutions);
      if (resKeys.length > 0) {
        lines.push(`\nPossible root causes: ${resKeys.join(", ")}`);
      }

      lines.push("");
    }

    lines.push(
      "---",
      "Next steps:",
      "1. Use `tsg_execute` with the TSG id and stepId to run diagnostic steps",
      "2. Once root cause is identified, use `tsg_execute` with rootCause to get resolution",
      "3. Use `troubleshoot_analyze` to analyze diagnostic command output",
    );

    return {
      content: [{ type: "text" as const, text: lines.join("\n") }],
    };
  },
};
