import { z } from "zod/v4";
import type { ToolDefinition } from "../../types/index.js";
import { getTsgStorage } from "../../storage/index.js";
import { TsgService } from "../../services/tsg/index.js";

const inputSchema = z.object({
  query: z.string().optional().describe("Free text search query"),
  symptoms: z
    .array(z.string())
    .optional()
    .describe("Symptoms to match (e.g., ['pod keeps restarting', 'OOMKilled'])"),
  tags: z.array(z.string()).optional().describe("Tags to filter by"),
  category: z.string().optional().describe("Category to filter by"),
});

export const searchTsgTool: ToolDefinition = {
  name: "tsg_search",
  description:
    "Search for relevant TSGs by symptoms, keywords, tags, or free text. " +
    "Results are ranked by relevance score.",
  inputSchema: z.toJSONSchema(inputSchema) as Record<string, unknown>,
  handler: async (params: unknown) => {
    const input = inputSchema.parse(params);
    const storage = await getTsgStorage();
    const service = new TsgService(storage);

    const results = await service.search({
      text: input.query,
      symptoms: input.symptoms,
      tags: input.tags,
      category: input.category,
    });

    if (results.length === 0) {
      return {
        content: [
          {
            type: "text" as const,
            text: "No matching TSGs found. Try broadening your search or check available TSGs with tsg_list.",
          },
        ],
      };
    }

    const summary = results
      .map(
        (r) =>
          `[Score: ${r.score}] ${r.tsg.id} — ${r.tsg.title}` +
          `\n  Category: ${r.tsg.category}` +
          `\n  Matched: ${r.matchedOn.join(", ")}` +
          `\n  Diagnostics: ${r.tsg.diagnostics.length} steps | Resolutions: ${Object.keys(r.tsg.resolutions).length}`,
      )
      .join("\n\n");

    return {
      content: [
        {
          type: "text" as const,
          text: `Found ${results.length} matching TSG(s):\n\n${summary}`,
        },
      ],
    };
  },
};
