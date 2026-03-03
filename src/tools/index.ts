import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
} from "@modelcontextprotocol/sdk/types.js";
import type { ToolDefinition } from "../types/index.js";
import { formatError } from "../utils/errors.js";
import { logger } from "../utils/logger.js";

const tools: Map<string, ToolDefinition> = new Map();

export function registerTool(tool: ToolDefinition): void {
  if (tools.has(tool.name)) {
    throw new Error(`Tool "${tool.name}" is already registered`);
  }
  tools.set(tool.name, tool);
  logger.debug({ tool: tool.name }, "Registered tool");
}

export function setupToolHandlers(server: Server): void {
  server.setRequestHandler(ListToolsRequestSchema, async () => {
    return {
      tools: Array.from(tools.values()).map((t) => ({
        name: t.name,
        description: t.description,
        inputSchema: t.inputSchema,
      })),
    };
  });

  server.setRequestHandler(CallToolRequestSchema, async (request) => {
    const { name, arguments: args } = request.params;
    const tool = tools.get(name);

    if (!tool) {
      return {
        content: [{ type: "text" as const, text: `Unknown tool: ${name}` }],
        isError: true,
      } as const;
    }

    try {
      logger.info({ tool: name }, "Executing tool");
      const result = await tool.handler(args);
      logger.info({ tool: name, isError: result.isError }, "Tool completed");
      return result;
    } catch (error) {
      logger.error({ tool: name, error }, "Tool execution failed");
      return {
        content: [
          { type: "text" as const, text: `Error: ${formatError(error)}` },
        ],
        isError: true,
      } as const;
    }
  });
}

export function getRegisteredTools(): ToolDefinition[] {
  return Array.from(tools.values());
}
