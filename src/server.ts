import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { registerTool, setupToolHandlers } from "./tools/index.js";
import { getWorkItemTool } from "./tools/work-items/get.tool.js";
import { listWorkItemsTool } from "./tools/work-items/list.tool.js";
import { createWorkItemTool } from "./tools/work-items/create.tool.js";
import { updateWorkItemTool } from "./tools/work-items/update.tool.js";
import { queryWorkItemsTool } from "./tools/work-items/query.tool.js";
import { syncWorkItemsTool } from "./tools/work-items/sync.tool.js";
import { planWorkItemsTool } from "./tools/work-items/plan.tool.js";
import { createTsgTool } from "./tools/tsg/create.tool.js";
import { getTsgTool } from "./tools/tsg/get.tool.js";
import { updateTsgTool } from "./tools/tsg/update.tool.js";
import { listTsgTool } from "./tools/tsg/list.tool.js";
import { searchTsgTool } from "./tools/tsg/search.tool.js";
import { executeTsgTool } from "./tools/tsg/execute.tool.js";
import { diagnoseTool } from "./tools/troubleshoot/diagnose.tool.js";
import { analyzeTool } from "./tools/troubleshoot/analyze.tool.js";
import { suggestTool } from "./tools/troubleshoot/resolve.tool.js";
import { setupTool } from "./tools/setup.tool.js";
import { logger } from "./utils/logger.js";

function registerAllTools(): void {
  // Work item tools
  registerTool(getWorkItemTool);
  registerTool(listWorkItemsTool);
  registerTool(createWorkItemTool);
  registerTool(updateWorkItemTool);
  registerTool(queryWorkItemsTool);
  registerTool(syncWorkItemsTool);
  registerTool(planWorkItemsTool);

  // TSG tools
  registerTool(createTsgTool);
  registerTool(getTsgTool);
  registerTool(updateTsgTool);
  registerTool(listTsgTool);
  registerTool(searchTsgTool);
  registerTool(executeTsgTool);

  // Troubleshoot tools
  registerTool(diagnoseTool);
  registerTool(analyzeTool);
  registerTool(suggestTool);

  // Setup tool
  registerTool(setupTool);
}

export function createServer(): Server {
  const server = new Server(
    {
      name: "ado-claude-code",
      version: "0.1.0",
    },
    {
      capabilities: {
        tools: {},
      },
    },
  );

  registerAllTools();
  setupToolHandlers(server);

  server.onerror = (error) => {
    logger.error({ error }, "MCP server error");
  };

  logger.info("MCP server created");
  return server;
}
