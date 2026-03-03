import { z } from "zod/v4";
import type { ToolDefinition } from "../../types/index.js";
import { getTsgStorage } from "../../storage/index.js";

const inputSchema = z.object({
  category: z.string().optional().describe("Filter by category"),
});

export const listTsgTool: ToolDefinition = {
  name: "tsg_list",
  description: "List all Troubleshooting Guides, optionally filtered by category.",
  inputSchema: z.toJSONSchema(inputSchema) as Record<string, unknown>,
  handler: async (params: unknown) => {
    const input = inputSchema.parse(params);
    const storage = await getTsgStorage();

    let tsgs;
    if (input.category) {
      tsgs = await storage.listByCategory(input.category);
    } else {
      tsgs = await storage.listAll();
    }

    if (tsgs.length === 0) {
      return {
        content: [
          {
            type: "text" as const,
            text: input.category
              ? `No TSGs found in category "${input.category}".`
              : "No TSGs found. Use tsg_create to add one.",
          },
        ],
      };
    }

    const summary = tsgs
      .map(
        (t) =>
          `${t.id} [${t.category}] ${t.title}` +
          (t.tags.length > 0 ? ` (${t.tags.join(", ")})` : "") +
          `\n  Symptoms: ${t.symptoms.length} | Diagnostics: ${t.diagnostics.length} | Resolutions: ${Object.keys(t.resolutions).length}`,
      )
      .join("\n\n");

    return {
      content: [
        {
          type: "text" as const,
          text: `Found ${tsgs.length} TSG(s):\n\n${summary}`,
        },
      ],
    };
  },
};
