import { z } from "zod/v4";
import type { ToolDefinition } from "../../types/index.js";
import { getTsgStorage } from "../../storage/index.js";
import { formatTsgOverview } from "../../services/tsg/executor.js";

const inputSchema = z.object({
  id: z.string().describe("TSG ID (e.g., tsg-deployment-001)"),
});

export const getTsgTool: ToolDefinition = {
  name: "tsg_get",
  description: "Get the full content of a Troubleshooting Guide by its ID.",
  inputSchema: z.toJSONSchema(inputSchema) as Record<string, unknown>,
  handler: async (params: unknown) => {
    const input = inputSchema.parse(params);
    const storage = await getTsgStorage();
    const tsg = await storage.loadById(input.id);

    if (!tsg) {
      return {
        content: [
          {
            type: "text" as const,
            text: `TSG "${input.id}" not found.`,
          },
        ],
        isError: true,
      };
    }

    return {
      content: [
        {
          type: "text" as const,
          text: formatTsgOverview(tsg) +
            "\n\n---\nRaw data:\n" +
            JSON.stringify(tsg, null, 2),
        },
      ],
    };
  },
};
