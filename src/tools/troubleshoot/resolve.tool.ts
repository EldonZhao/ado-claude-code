import { z } from "zod/v4";
import type { ToolDefinition } from "../../types/index.js";
import { getTsgStorage } from "../../storage/index.js";
import { prepareResolution } from "../../services/tsg/executor.js";

const inputSchema = z.object({
  tsgId: z.string().describe("TSG ID that matched the issue"),
  rootCause: z.string().describe("Identified root cause key (from analysis step)"),
  parameters: z
    .record(z.string(), z.string())
    .optional()
    .describe("Parameters to resolve in command templates"),
  additionalContext: z
    .string()
    .optional()
    .describe("Additional diagnostic info or observations to consider"),
});

export const suggestTool: ToolDefinition = {
  name: "troubleshoot_suggest",
  description:
    "Suggest resolution steps for an identified root cause. Retrieves the resolution plan " +
    "from the matching TSG and returns actionable steps with resolved commands.",
  inputSchema: z.toJSONSchema(inputSchema) as Record<string, unknown>,
  handler: async (params: unknown) => {
    const input = inputSchema.parse(params);
    const storage = await getTsgStorage();
    const tsg = await storage.loadById(input.tsgId);

    if (!tsg) {
      return {
        content: [
          { type: "text" as const, text: `TSG "${input.tsgId}" not found.` },
        ],
        isError: true,
      };
    }

    const context = { parameters: input.parameters ?? {} };

    let resolution;
    try {
      resolution = prepareResolution(tsg, input.rootCause, context);
    } catch (err) {
      return {
        content: [
          {
            type: "text" as const,
            text: `${err instanceof Error ? err.message : String(err)}`,
          },
        ],
        isError: true,
      };
    }

    const lines: string[] = [
      `## Resolution Plan: ${resolution.name}`,
      `TSG: ${tsg.title} (${tsg.id})`,
      `Root Cause: ${input.rootCause}`,
    ];

    if (resolution.description) {
      lines.push("", resolution.description);
    }

    if (input.additionalContext) {
      lines.push("", `Additional context: ${input.additionalContext}`);
    }

    lines.push("", `### Steps (${resolution.steps.length})`);

    for (let i = 0; i < resolution.steps.length; i++) {
      const step = resolution.steps[i];
      const resolved = resolution.resolvedSteps[i];

      lines.push("");
      lines.push(
        `**Step ${i + 1}** (${step.id}): ${step.action}` +
          (step.manual ? " 🔧 [MANUAL]" : " ⚡ [AUTO]"),
      );

      if (step.description) {
        lines.push(step.description);
      }

      if (resolved.command) {
        lines.push("", "```bash", resolved.command, "```");
      }

      if (step.guidance) {
        lines.push("", "Guidance:", step.guidance);
      }

      if (step.successCriteria) {
        lines.push(
          "",
          `✅ Success criteria: look for \`${step.successCriteria.pattern}\``,
        );
      }
    }

    // Escalation info
    if (tsg.escalation) {
      lines.push("", "---", "### Escalation");
      if (tsg.escalation.timeout) {
        lines.push(`If not resolved within ${tsg.escalation.timeout}:`);
      }
      if (tsg.escalation.contacts) {
        for (const contact of tsg.escalation.contacts) {
          lines.push(
            `- Contact: ${contact.team}${contact.channel ? ` via ${contact.channel}` : ""}`,
          );
        }
      }
    }

    // Related resources
    if (tsg.related) {
      if (tsg.related.tsgs && tsg.related.tsgs.length > 0) {
        lines.push("", "Related TSGs:", ...tsg.related.tsgs.map((t) => `- ${t}`));
      }
      if (tsg.related.docs && tsg.related.docs.length > 0) {
        lines.push(
          "",
          "Documentation:",
          ...tsg.related.docs.map((d) => `- [${d.title}](${d.url})`),
        );
      }
    }

    return {
      content: [{ type: "text" as const, text: lines.join("\n") }],
    };
  },
};
