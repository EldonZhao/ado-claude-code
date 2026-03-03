import { z } from "zod/v4";
import type { ToolDefinition } from "../../types/index.js";
import { getTsgStorage } from "../../storage/index.js";
import { TsgSchema } from "../../schemas/tsg.schema.js";

const inputSchema = z.object({
  title: z.string().min(1).describe("TSG title"),
  category: z.string().min(1).describe("Category (e.g., deployment, performance, security)"),
  tags: z.array(z.string()).optional().describe("Searchable tags"),
  symptoms: z.array(z.string()).optional().describe("Observable symptoms this TSG addresses"),
  relatedErrors: z.array(z.string()).optional().describe("Error messages related to this issue"),
  author: z.string().optional().describe("Author name or team"),
  prerequisites: z
    .object({
      tools: z
        .array(z.object({ name: z.string(), minVersion: z.string().optional() }))
        .optional(),
      permissions: z.array(z.string()).optional(),
      context: z.array(z.string()).optional(),
    })
    .optional()
    .describe("Required tools, permissions, and context info"),
  diagnostics: z
    .array(
      z.object({
        id: z.string(),
        name: z.string(),
        description: z.string().optional(),
        command: z
          .object({
            template: z.string(),
            parameters: z
              .array(
                z.object({
                  name: z.string(),
                  required: z.boolean().default(true),
                  default: z.string().optional(),
                  description: z.string().optional(),
                }),
              )
              .optional(),
          })
          .optional(),
        manual: z.boolean().optional(),
        guidance: z.string().optional(),
        analysis: z
          .object({
            lookFor: z
              .array(
                z.object({
                  pattern: z.string(),
                  type: z.enum(["literal", "regex"]).optional(),
                  indicatesRootCause: z.string().optional(),
                  severity: z.enum(["low", "medium", "high", "critical"]).optional(),
                }),
              )
              .optional(),
          })
          .optional(),
      }),
    )
    .optional()
    .describe("Diagnostic steps with commands and analysis patterns"),
  resolutions: z
    .record(
      z.string(),
      z.object({
        name: z.string(),
        description: z.string().optional(),
        steps: z.array(
          z.object({
            id: z.string(),
            action: z.string(),
            description: z.string().optional(),
            command: z.string().optional(),
            manual: z.boolean().optional(),
            guidance: z.string().optional(),
          }),
        ),
      }),
    )
    .optional()
    .describe("Resolution plans keyed by root cause"),
  escalation: z
    .object({
      timeout: z.string().optional(),
      contacts: z
        .array(z.object({ team: z.string(), channel: z.string().optional() }))
        .optional(),
    })
    .optional(),
});

export const createTsgTool: ToolDefinition = {
  name: "tsg_create",
  description:
    "Create a new Troubleshooting Guide (TSG). TSGs are structured documents with symptoms, " +
    "diagnostic steps, resolution plans, and escalation paths.",
  inputSchema: z.toJSONSchema(inputSchema) as Record<string, unknown>,
  handler: async (params: unknown) => {
    const input = inputSchema.parse(params);
    const storage = await getTsgStorage();

    // Generate ID
    const existing = await storage.listByCategory(input.category);
    const nextNum = existing.length + 1;
    const id = `tsg-${input.category}-${String(nextNum).padStart(3, "0")}`;

    const tsg = TsgSchema.parse({
      id,
      title: input.title,
      category: input.category,
      lastUpdated: new Date().toISOString().split("T")[0],
      author: input.author,
      tags: input.tags ?? [],
      symptoms: input.symptoms ?? [],
      relatedErrors: input.relatedErrors ?? [],
      prerequisites: input.prerequisites,
      diagnostics: input.diagnostics ?? [],
      resolutions: input.resolutions ?? {},
      escalation: input.escalation,
    });

    const filePath = await storage.save(tsg);

    return {
      content: [
        {
          type: "text" as const,
          text: `Created TSG "${tsg.title}" (${tsg.id})\nSaved to: ${filePath}`,
        },
      ],
    };
  },
};
