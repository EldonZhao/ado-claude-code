import { z } from "zod/v4";
import type { ToolDefinition } from "../../types/index.js";
import { getTsgStorage } from "../../storage/index.js";
import { TsgSchema } from "../../schemas/tsg.schema.js";

const inputSchema = z.object({
  id: z.string().describe("TSG ID to update"),
  title: z.string().optional(),
  tags: z.array(z.string()).optional(),
  symptoms: z.array(z.string()).optional(),
  relatedErrors: z.array(z.string()).optional(),
  diagnostics: z.any().optional().describe("Replacement diagnostic steps array"),
  resolutions: z.any().optional().describe("Replacement resolutions object"),
  escalation: z.any().optional().describe("Replacement escalation config"),
});

export const updateTsgTool: ToolDefinition = {
  name: "tsg_update",
  description: "Update an existing Troubleshooting Guide. Only provided fields are changed.",
  inputSchema: z.toJSONSchema(inputSchema) as Record<string, unknown>,
  handler: async (params: unknown) => {
    const input = inputSchema.parse(params);
    const storage = await getTsgStorage();
    const existing = await storage.loadById(input.id);

    if (!existing) {
      return {
        content: [
          { type: "text" as const, text: `TSG "${input.id}" not found.` },
        ],
        isError: true,
      };
    }

    const merged = {
      ...existing,
      ...(input.title !== undefined && { title: input.title }),
      ...(input.tags !== undefined && { tags: input.tags }),
      ...(input.symptoms !== undefined && { symptoms: input.symptoms }),
      ...(input.relatedErrors !== undefined && {
        relatedErrors: input.relatedErrors,
      }),
      ...(input.diagnostics !== undefined && {
        diagnostics: input.diagnostics,
      }),
      ...(input.resolutions !== undefined && {
        resolutions: input.resolutions,
      }),
      ...(input.escalation !== undefined && {
        escalation: input.escalation,
      }),
      lastUpdated: new Date().toISOString().split("T")[0],
    };

    const validated = TsgSchema.parse(merged);
    const filePath = await storage.save(validated);

    return {
      content: [
        {
          type: "text" as const,
          text: `Updated TSG "${validated.title}" (${validated.id})\nSaved to: ${filePath}`,
        },
      ],
    };
  },
};
