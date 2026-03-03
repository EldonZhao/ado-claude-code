import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { createServer } from "./server.js";
import { logger } from "./utils/logger.js";

async function main(): Promise<void> {
  const server = createServer();
  const transport = new StdioServerTransport();

  await server.connect(transport);
  logger.info("ado-claude-code MCP server running on stdio");
}

main().catch((error) => {
  logger.fatal({ error }, "Failed to start MCP server");
  process.exit(1);
});
