import { z } from "zod/v4";
import * as fs from "node:fs/promises";
import * as path from "node:path";
import type { ToolDefinition } from "../types/index.js";
import { saveConfig, loadConfig, clearConfigCache } from "../storage/config.js";
import { getCredentials } from "../services/ado/auth.js";
import type { AdoConfigOutput } from "../schemas/config.schema.js";
import { AdoConfigSchema } from "../schemas/config.schema.js";
import { logger } from "../utils/logger.js";

const inputSchema = z.object({
  action: z
    .enum(["init", "validate", "show"])
    .describe(
      "init: create/update .ado-config.yaml; validate: test connection; show: display current config",
    ),
  organization: z
    .string()
    .optional()
    .describe("Azure DevOps organization URL (e.g., https://dev.azure.com/myorg)"),
  project: z
    .string()
    .optional()
    .describe("Azure DevOps project name"),
  authType: z
    .enum(["pat", "azure-ad"])
    .optional()
    .describe("Authentication method"),
  patEnvVar: z
    .string()
    .optional()
    .describe("Environment variable name for PAT (default: ADO_PAT)"),
  storagePath: z
    .string()
    .optional()
    .describe("Base path for local data storage (default: ./data)"),
  defaultQuery: z
    .string()
    .optional()
    .describe("Default WIQL query for sync"),
});

export const setupTool: ToolDefinition = {
  name: "ado_setup",
  description:
    "Setup and configure the Azure DevOps integration. Use 'init' to create configuration, " +
    "'validate' to test the connection, or 'show' to display current settings.",
  inputSchema: z.toJSONSchema(inputSchema) as Record<string, unknown>,
  handler: async (params: unknown) => {
    const input = inputSchema.parse(params);

    switch (input.action) {
      case "init":
        return handleInit(input);
      case "validate":
        return handleValidate();
      case "show":
        return handleShow();
    }
  },
};

async function handleInit(input: z.infer<typeof inputSchema>) {
  if (!input.organization || !input.project) {
    return {
      content: [
        {
          type: "text" as const,
          text:
            "## Setup: Missing required fields\n\n" +
            "To initialize, provide:\n" +
            "- `organization`: Azure DevOps org URL (e.g., https://dev.azure.com/myorg)\n" +
            "- `project`: Project name\n" +
            "- `authType`: 'pat' (default) or 'azure-ad'\n\n" +
            "Example:\n```json\n{\n" +
            '  "action": "init",\n' +
            '  "organization": "https://dev.azure.com/myorg",\n' +
            '  "project": "MyProject",\n' +
            '  "authType": "pat"\n' +
            "}\n```",
        },
      ],
    };
  }

  const config = AdoConfigSchema.parse({
    version: "1.0",
    azure_devops: {
      organization: input.organization,
      project: input.project,
      auth: {
        type: input.authType ?? "pat",
        patEnvVar: input.patEnvVar ?? "ADO_PAT",
      },
    },
    storage: {
      basePath: input.storagePath ?? "./data",
      workItemsPath: "work-items",
      tsgPath: "tsg",
    },
    sync: {
      autoSync: false,
      pullOnStartup: true,
      defaultQuery: input.defaultQuery,
      conflictResolution: "ask",
    },
  });

  // Ensure data directories exist
  const basePath = path.resolve(config.storage.basePath);
  const workItemsPath = path.resolve(basePath, config.storage.workItemsPath);
  const tsgPath = path.resolve(basePath, config.storage.tsgPath);

  await fs.mkdir(workItemsPath, { recursive: true });
  await fs.mkdir(tsgPath, { recursive: true });

  // Create work item subdirectories
  for (const dir of ["epics", "features", "user-stories", "tasks", "bugs"]) {
    await fs.mkdir(path.join(workItemsPath, dir), { recursive: true });
  }

  clearConfigCache();
  await saveConfig(config);

  const lines: string[] = [
    "## Setup Complete",
    "",
    `Organization: ${config.azure_devops.organization}`,
    `Project: ${config.azure_devops.project}`,
    `Auth: ${config.azure_devops.auth.type} (env var: ${config.azure_devops.auth.patEnvVar})`,
    `Storage: ${config.storage.basePath}`,
    "",
    "Created directories:",
    `- ${workItemsPath}`,
    `- ${tsgPath}`,
    "",
    "Next steps:",
    `1. Set the \`${config.azure_devops.auth.patEnvVar}\` environment variable with your PAT`,
    "2. Run `ado_setup` with action 'validate' to test the connection",
    "3. Use `ado_work_items_sync` to pull work items",
  ];

  return {
    content: [{ type: "text" as const, text: lines.join("\n") }],
  };
}

async function handleValidate() {
  let config: AdoConfigOutput;
  try {
    config = await loadConfig();
  } catch {
    return {
      content: [
        {
          type: "text" as const,
          text: "No configuration found. Run `ado_setup` with action 'init' first.",
        },
      ],
      isError: true,
    };
  }

  const checks: string[] = ["## Connection Validation", ""];

  // Check config
  checks.push(`✅ Config loaded: ${config.azure_devops.organization}/${config.azure_devops.project}`);

  // Check credentials
  try {
    const creds = await getCredentials(config);
    checks.push(`✅ Credentials found: ${creds.type}`);
  } catch (err) {
    checks.push(`❌ Credentials: ${err instanceof Error ? err.message : String(err)}`);
    checks.push("", "Fix: Set the ADO_PAT environment variable or configure Azure AD.");
    return {
      content: [{ type: "text" as const, text: checks.join("\n") }],
      isError: true,
    };
  }

  // Test ADO connection
  try {
    const azdev = await import("azure-devops-node-api");
    const creds = await getCredentials(config);
    const authHandler =
      creds.type === "pat"
        ? azdev.getPersonalAccessTokenHandler(creds.token)
        : azdev.getBearerHandler(creds.token);

    const connection = new azdev.WebApi(
      config.azure_devops.organization,
      authHandler,
    );
    const coreApi = await connection.getCoreApi();
    const project = await coreApi.getProject(config.azure_devops.project);

    if (project?.name) {
      checks.push(`✅ ADO connection: Project "${project.name}" found`);
      if (project.description) {
        checks.push(`   Description: ${project.description.slice(0, 100)}`);
      }
    } else {
      checks.push(
        `❌ ADO connection: Project "${config.azure_devops.project}" not found`,
      );
      return {
        content: [{ type: "text" as const, text: checks.join("\n") }],
        isError: true,
      };
    }
  } catch (err) {
    checks.push(
      `❌ ADO connection failed: ${err instanceof Error ? err.message : String(err)}`,
    );
    return {
      content: [{ type: "text" as const, text: checks.join("\n") }],
      isError: true,
    };
  }

  // Check local storage
  const basePath = path.resolve(config.storage.basePath);
  try {
    await fs.access(basePath);
    checks.push(`✅ Storage directory exists: ${basePath}`);
  } catch {
    checks.push(`⚠️ Storage directory missing: ${basePath} (will be created on first use)`);
  }

  checks.push("", "All checks passed. The plugin is ready to use.");

  return {
    content: [{ type: "text" as const, text: checks.join("\n") }],
  };
}

async function handleShow() {
  let config: AdoConfigOutput;
  try {
    config = await loadConfig();
  } catch {
    return {
      content: [
        {
          type: "text" as const,
          text: "No configuration found. Run `ado_setup` with action 'init' first.",
        },
      ],
      isError: true,
    };
  }

  const lines = [
    "## Current Configuration",
    "",
    "### Azure DevOps",
    `- Organization: ${config.azure_devops.organization}`,
    `- Project: ${config.azure_devops.project}`,
    `- Auth type: ${config.azure_devops.auth.type}`,
    `- PAT env var: ${config.azure_devops.auth.patEnvVar}`,
    "",
    "### Storage",
    `- Base path: ${config.storage.basePath}`,
    `- Work items: ${config.storage.workItemsPath}`,
    `- TSGs: ${config.storage.tsgPath}`,
    "",
    "### Sync",
    `- Auto sync: ${config.sync.autoSync}`,
    `- Pull on startup: ${config.sync.pullOnStartup}`,
    `- Conflict resolution: ${config.sync.conflictResolution}`,
  ];

  if (config.sync.defaultQuery) {
    lines.push(`- Default query: ${config.sync.defaultQuery}`);
  }

  // Check credential availability (without showing token)
  try {
    const creds = await getCredentials(config);
    lines.push("", `Credentials: ✅ ${creds.type} token available`);
  } catch {
    lines.push("", "Credentials: ❌ Not configured");
  }

  return {
    content: [{ type: "text" as const, text: lines.join("\n") }],
  };
}
