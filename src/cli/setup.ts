import * as fs from "node:fs/promises";
import * as path from "node:path";
import { output, fatal, parseFlags } from "./helpers.js";
import { saveConfig, loadConfig, clearConfigCache, resolveStoragePath, ensureProjectGitignore } from "../storage/config.js";
import { getCredentials, clearTokenCache } from "../services/ado/auth.js";
import { AdoConfigSchema, type AdoConfigOutput } from "../schemas/config.schema.js";

export function parseAdoUrl(url: string): { organization: string; project?: string } {
  let parsed: URL;
  try {
    parsed = new URL(url);
  } catch {
    return fatal(`Invalid URL: ${url}`) as never;
  }

  const segments = parsed.pathname.split("/").filter(Boolean);

  // https://dev.azure.com/<org>[/<project>][/_git/...]
  if (parsed.hostname === "dev.azure.com") {
    if (segments.length === 0) return fatal(`No organization found in URL: ${url}`) as never;
    return {
      organization: `${parsed.origin}/${segments[0]}`,
      project: segments.length > 1 ? segments[1] : undefined,
    };
  }

  // https://<org>.visualstudio.com[/<project>][/_git/...]
  if (parsed.hostname.endsWith(".visualstudio.com")) {
    return {
      organization: parsed.origin,
      project: segments.length > 0 ? segments[0] : undefined,
    };
  }

  return fatal(
    `Unrecognized Azure DevOps URL format: ${url}. Expected dev.azure.com or *.visualstudio.com`,
  ) as never;
}

export async function handleSetup(args: string[]): Promise<void> {
  const action = args[0];
  if (!action || !["init", "validate", "show", "login", "logout"].includes(action)) {
    fatal("Usage: setup <init|validate|show|login|logout> [args]");
  }

  switch (action) {
    case "init":
      return handleInit(args.slice(1));
    case "validate":
      return handleValidate();
    case "show":
      return handleShow();
    case "login":
      return handleLogin();
    case "logout":
      return handleLogout();
  }
}

async function handleInit(args: string[]): Promise<void> {
  const flags = parseFlags(args);

  let input: Record<string, string | undefined>;
  if (flags.json) {
    input = JSON.parse(flags.json);
  } else {
    input = flags;
  }

  // --url takes precedence: parse organization and project from the URL
  if (input.url) {
    const urls = input.url.split(",").map(u => u.trim()).filter(Boolean);
    const { organization, project } = parseAdoUrl(urls[urls.length - 1]);
    input.organization = organization;
    if (project) input.project = project;
  }

  if (!input.organization || !input.project) {
    fatal(
      "Usage: setup init --url=<azure-devops-url>\n" +
      "   or: setup init --organization=<url> --project=<name>\n" +
      "Supported URL formats:\n" +
      "  https://dev.azure.com/<org>/<project>\n" +
      "  https://<org>.visualstudio.com/<project>",
    );
  }

  const config = AdoConfigSchema.parse({
    version: "1.0",
    azure_devops: {
      organization: input.organization,
      project: input.project,
      auth: {
        type: input.authType ?? "azure-ad",
        patEnvVar: input.patEnvVar ?? "ADO_PAT",
      },
    },
    storage: {
      basePath: input.storagePath ?? "./.github",
      workItemsPath: "workitems",
      instructionsPath: "instructions",
    },
    sync: {
      autoSync: false,
      pullOnStartup: true,
      defaultQuery: input.defaultQuery,
      conflictResolution: "ask",
    },
  });

  // Ensure data directories exist
  const basePath = resolveStoragePath(config.storage.basePath);
  const workItemsPath = path.resolve(basePath, config.storage.workItemsPath);
  const instructionsPath = path.resolve(basePath, config.storage.instructionsPath);

  await fs.mkdir(workItemsPath, { recursive: true });
  await fs.mkdir(instructionsPath, { recursive: true });

  for (const dir of ["epics", "features", "user-stories", "tasks", "bugs"]) {
    await fs.mkdir(path.join(workItemsPath, dir), { recursive: true });
  }

  await ensureProjectGitignore();

  clearConfigCache();
  await saveConfig(config);

  output({
    status: "ok",
    organization: config.azure_devops.organization,
    project: config.azure_devops.project,
    auth: config.azure_devops.auth.type,
    storagePath: config.storage.basePath,
  });
}

async function handleValidate(): Promise<void> {
  let config: AdoConfigOutput;
  try {
    config = await loadConfig();
  } catch {
    fatal("No configuration found. Run setup init first.");
  }

  const checks: Array<{ check: string; status: "ok" | "error" | "warning"; detail?: string }> = [];

  checks.push({
    check: "config",
    status: "ok",
    detail: `${config.azure_devops.organization}/${config.azure_devops.project}`,
  });

  // Check credentials
  try {
    const creds = await getCredentials(config);
    checks.push({ check: "credentials", status: "ok", detail: creds.type });
  } catch (err) {
    checks.push({
      check: "credentials",
      status: "error",
      detail: err instanceof Error ? err.message : String(err),
    });
    output({ checks, success: false });
    return;
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
      checks.push({ check: "connection", status: "ok", detail: `Project "${project.name}" found` });
    } else {
      checks.push({ check: "connection", status: "error", detail: `Project "${config.azure_devops.project}" not found` });
      output({ checks, success: false });
      return;
    }
  } catch (err) {
    checks.push({
      check: "connection",
      status: "error",
      detail: err instanceof Error ? err.message : String(err),
    });
    output({ checks, success: false });
    return;
  }

  // Check storage
  const basePath = resolveStoragePath(config.storage.basePath);
  try {
    await fs.access(basePath);
    checks.push({ check: "storage", status: "ok", detail: basePath });
  } catch {
    checks.push({ check: "storage", status: "warning", detail: `Missing: ${basePath} (will be created on first use)` });
  }

  output({ checks, success: true });
}

async function handleShow(): Promise<void> {
  let config: AdoConfigOutput;
  try {
    config = await loadConfig();
  } catch {
    fatal("No configuration found. Run setup init first.");
  }

  let credentialStatus: string;
  try {
    const creds = await getCredentials(config);
    credentialStatus = `${creds.type} token available`;
  } catch {
    credentialStatus = "not configured";
  }

  output({
    azure_devops: {
      organization: config.azure_devops.organization,
      project: config.azure_devops.project,
      auth: {
        type: config.azure_devops.auth.type,
        patEnvVar: config.azure_devops.auth.patEnvVar,
      },
    },
    storage: config.storage,
    sync: config.sync,
    credentials: credentialStatus,
  });
}

async function handleLogin(): Promise<void> {
  let config: AdoConfigOutput;
  try {
    config = await loadConfig();
  } catch {
    fatal("No configuration found. Run setup init first.");
  }

  if (config.azure_devops.auth.type === "pat") {
    fatal(
      "Auth type is 'pat'. To use browser login, reinitialize with: setup init --authType=azure-ad ...",
    );
  }

  // Clear any stale cached token
  await clearTokenCache();

  // Use az login for browser-based interactive login, then get ADO token
  try {
    const { execSync } = await import("node:child_process");

    process.stderr.write("\nRunning 'az login' to open browser for authentication...\n\n");
    execSync("az login", { stdio: "inherit", timeout: 120000 });

    // Now get an ADO token via AzureCliCredential and cache it
    const creds = await getCredentials(config);
    output({ status: "ok", authType: creds.type, message: "Login successful. Token cached for Azure DevOps." });
  } catch (err) {
    fatal(
      `Login failed: ${err instanceof Error ? err.message : String(err)}\n` +
      "Make sure Azure CLI is installed (https://aka.ms/install-azure-cli) and try again.",
    );
  }
}

async function handleLogout(): Promise<void> {
  await clearTokenCache();
  output({ status: "ok", message: "Token cache cleared." });
}
