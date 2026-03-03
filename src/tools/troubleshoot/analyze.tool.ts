import { z } from "zod/v4";
import type { ToolDefinition } from "../../types/index.js";
import { getTsgStorage } from "../../storage/index.js";
import type { TsgOutput } from "../../schemas/tsg.schema.js";

const inputSchema = z.object({
  diagnosticOutput: z
    .string()
    .min(1)
    .describe("The output from a diagnostic command"),
  tsgId: z.string().optional().describe("TSG ID providing context for analysis"),
  stepId: z
    .string()
    .optional()
    .describe("The diagnostic step ID that produced this output"),
});

export const analyzeTool: ToolDefinition = {
  name: "troubleshoot_analyze",
  description:
    "Analyze the output of a diagnostic command. If a TSG and step are provided, " +
    "uses the step's analysis patterns to identify root causes. Otherwise, performs " +
    "general pattern matching against all known TSGs.",
  inputSchema: z.toJSONSchema(inputSchema) as Record<string, unknown>,
  handler: async (params: unknown) => {
    const input = inputSchema.parse(params);
    const storage = await getTsgStorage();

    const lines: string[] = ["## Diagnostic Output Analysis", ""];

    // If TSG context is provided, use its analysis patterns
    if (input.tsgId) {
      const tsg = await storage.loadById(input.tsgId);
      if (tsg) {
        const stepAnalysis = analyzeWithTsg(
          input.diagnosticOutput,
          tsg,
          input.stepId,
        );
        lines.push(...stepAnalysis);
      } else {
        lines.push(`⚠️ TSG "${input.tsgId}" not found, performing general analysis.`);
      }
    }

    // General pattern scan across all TSGs
    const allTsgs = await storage.listAll();
    const generalMatches = analyzeAgainstAllTsgs(
      input.diagnosticOutput,
      allTsgs,
    );

    if (generalMatches.length > 0) {
      lines.push("", "### Pattern Matches Across TSGs");
      for (const match of generalMatches) {
        lines.push(
          `- **${match.pattern}** → ${match.tsgId}: root cause "${match.rootCause}"` +
            (match.severity ? ` (${match.severity})` : ""),
        );
      }
    }

    // Provide summary
    const rootCauses = [
      ...new Set(generalMatches.map((m) => m.rootCause).filter(Boolean)),
    ];
    if (rootCauses.length > 0) {
      lines.push(
        "",
        "### Identified Root Causes",
        ...rootCauses.map((rc) => `- **${rc}**`),
        "",
        "Next: Use `tsg_execute` with rootCause to get resolution steps,",
        "or use `troubleshoot_suggest` with the diagnosis for recommendations.",
      );
    } else {
      lines.push(
        "",
        "No specific root causes identified from known patterns.",
        "Consider:",
        "- Providing more diagnostic output",
        "- Running additional diagnostic steps",
        "- Creating a new TSG for this issue pattern",
      );
    }

    return {
      content: [{ type: "text" as const, text: lines.join("\n") }],
    };
  },
};

interface PatternMatch {
  pattern: string;
  tsgId: string;
  rootCause: string;
  severity?: string;
}

function analyzeWithTsg(
  output: string,
  tsg: TsgOutput,
  stepId?: string,
): string[] {
  const lines: string[] = [`### Analysis using TSG: ${tsg.title}`, ""];
  const outputLower = output.toLowerCase();

  const stepsToCheck = stepId
    ? tsg.diagnostics.filter((d) => d.id === stepId)
    : tsg.diagnostics;

  let foundMatch = false;

  for (const step of stepsToCheck) {
    if (!step.analysis?.lookFor) continue;

    for (const pattern of step.analysis.lookFor) {
      let matched = false;

      if (pattern.type === "regex") {
        try {
          const re = new RegExp(pattern.pattern, "i");
          matched = re.test(output);
        } catch {
          matched = outputLower.includes(pattern.pattern.toLowerCase());
        }
      } else {
        matched = outputLower.includes(pattern.pattern.toLowerCase());
      }

      if (matched) {
        foundMatch = true;
        lines.push(
          `✅ Pattern matched: \`${pattern.pattern}\`` +
            (pattern.indicatesRootCause
              ? ` → Root cause: **${pattern.indicatesRootCause}**`
              : "") +
            (pattern.severity ? ` (severity: ${pattern.severity})` : ""),
        );
      }
    }

    // Check expected output
    if (step.expectedOutput) {
      if (step.expectedOutput.success?.pattern) {
        if (outputLower.includes(step.expectedOutput.success.pattern.toLowerCase())) {
          lines.push(`✅ Success pattern matched: "${step.expectedOutput.success.pattern}"`);
          foundMatch = true;
        }
      }
      if (step.expectedOutput.failure?.patterns) {
        for (const p of step.expectedOutput.failure.patterns) {
          if (outputLower.includes(p.toLowerCase())) {
            lines.push(`❌ Failure pattern matched: "${p}"`);
            foundMatch = true;
          }
        }
      }
    }
  }

  if (!foundMatch) {
    lines.push("No patterns matched from this TSG's analysis rules.");
  }

  return lines;
}

function analyzeAgainstAllTsgs(
  output: string,
  tsgs: TsgOutput[],
): PatternMatch[] {
  const matches: PatternMatch[] = [];
  const outputLower = output.toLowerCase();

  for (const tsg of tsgs) {
    // Check relatedErrors
    for (const err of tsg.relatedErrors) {
      if (outputLower.includes(err.toLowerCase())) {
        matches.push({
          pattern: err,
          tsgId: tsg.id,
          rootCause: Object.keys(tsg.resolutions)[0] ?? "unknown",
        });
      }
    }

    // Check diagnostic analysis patterns
    for (const step of tsg.diagnostics) {
      if (!step.analysis?.lookFor) continue;
      for (const pattern of step.analysis.lookFor) {
        let matched = false;
        if (pattern.type === "regex") {
          try {
            matched = new RegExp(pattern.pattern, "i").test(output);
          } catch {
            matched = outputLower.includes(pattern.pattern.toLowerCase());
          }
        } else {
          matched = outputLower.includes(pattern.pattern.toLowerCase());
        }

        if (matched && pattern.indicatesRootCause) {
          matches.push({
            pattern: pattern.pattern,
            tsgId: tsg.id,
            rootCause: pattern.indicatesRootCause,
            severity: pattern.severity,
          });
        }
      }
    }
  }

  // Deduplicate
  const seen = new Set<string>();
  return matches.filter((m) => {
    const key = `${m.tsgId}:${m.rootCause}:${m.pattern}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}
