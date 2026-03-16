import * as fs from "node:fs/promises";
import * as path from "node:path";
import { parse as parseYaml, stringify as stringifyYaml } from "yaml";
import { AdoConfigSchema, type AdoConfigOutput } from "../schemas/config.schema.js";
import { ConfigError } from "../utils/errors.js";
import { logger } from "../utils/logger.js";

const CONFIG_DIR = ".claude";
const CONFIG_FILENAME = ".ado-config.yaml";

let cachedConfig: AdoConfigOutput | null = null;
let configPath: string | null = null;
let projectDir: string | null = null;

/** Set the project directory explicitly (e.g. from --project-dir flag). */
export function setProjectDir(dir: string): void {
  projectDir = dir;
}

export function getConfigPath(basePath?: string): string {
  if (configPath) return configPath;
  const base = basePath ?? projectDir ?? process.cwd();
  return path.join(base, CONFIG_DIR, CONFIG_FILENAME);
}

/**
 * Derive the project root from the config file path.
 * Config lives at `<projectRoot>/.claude/.ado-config.yaml`, so root is two
 * levels up from the config file.
 */
export function getProjectRoot(basePath?: string): string {
  const cfgPath = getConfigPath(basePath);
  // cfgPath = <root>/.claude/.ado-config.yaml → dirname twice = <root>
  return path.dirname(path.dirname(cfgPath));
}

/**
 * Resolve a storage basePath (potentially relative) against the project root
 * so that paths are stable regardless of process.cwd().
 */
export function resolveStoragePath(storagePath: string, basePath?: string): string {
  if (path.isAbsolute(storagePath)) return storagePath;
  return path.resolve(getProjectRoot(basePath), storagePath);
}

export async function loadConfig(basePath?: string): Promise<AdoConfigOutput> {
  if (cachedConfig) return cachedConfig;

  const filePath = getConfigPath(basePath);
  logger.debug({ path: filePath }, "Loading config");

  let raw: string;
  try {
    raw = await fs.readFile(filePath, "utf-8");
  } catch (err) {
    throw new ConfigError(
      `Config file not found at ${filePath}. Run setup first.`,
      err,
    );
  }

  let parsed: unknown;
  try {
    parsed = parseYaml(raw);
  } catch (err) {
    throw new ConfigError(`Invalid YAML in config file: ${filePath}`, err);
  }

  const result = AdoConfigSchema.safeParse(parsed);
  if (!result.success) {
    throw new ConfigError(
      `Invalid config: ${JSON.stringify(result.error.issues)}`,
    );
  }

  cachedConfig = result.data;
  return cachedConfig;
}

export async function saveConfig(
  config: AdoConfigOutput,
  basePath?: string,
): Promise<void> {
  const filePath = getConfigPath(basePath);
  await fs.mkdir(path.dirname(filePath), { recursive: true });
  const yamlStr = stringifyYaml(config, { lineWidth: 120 });
  await fs.writeFile(filePath, yamlStr, "utf-8");
  cachedConfig = config;
  logger.info({ path: filePath }, "Config saved");
}

export function clearConfigCache(): void {
  cachedConfig = null;
  configPath = null;
}

const GITIGNORE_ENTRIES = [
  "# ADO plugin — local-only files (do not commit)",
  ".claude/.ado-config.yaml",
  ".claude/.ado-token-cache.json",
  ".github/workitems/",
  ".github/.ado-sync/",
];

/**
 * Ensure the instructions directory exists and the project .gitignore has entries
 * to exclude local-only ADO files (workitems, sync state, config, token cache).
 * Instructions are intentionally NOT excluded — they should be tracked in git.
 */
export async function ensureProjectGitignore(basePath?: string): Promise<void> {
  const root = getProjectRoot(basePath);

  // Ensure instructions directory exists
  const instructionsDir = path.join(root, ".github", "instructions");
  await fs.mkdir(instructionsDir, { recursive: true });

  // Update .gitignore
  const gitignorePath = path.join(root, ".gitignore");
  let content = "";
  try {
    content = await fs.readFile(gitignorePath, "utf-8");
  } catch {
    // No .gitignore yet — will create
  }

  const lines = content.split("\n");
  const missing = GITIGNORE_ENTRIES.filter(
    (entry) => !entry.startsWith("#") && !lines.some((line) => line.trim() === entry),
  );

  if (missing.length === 0) return;

  // Add comment line if none of our entries exist yet
  const hasComment = lines.some((l) => l.includes("ADO plugin"));
  const toAdd = hasComment
    ? missing
    : GITIGNORE_ENTRIES.filter((entry) => entry.startsWith("#") || missing.includes(entry));

  const suffix = content.endsWith("\n") || content === "" ? "" : "\n";
  const block = suffix + toAdd.join("\n") + "\n";
  await fs.writeFile(gitignorePath, content + block, "utf-8");
}
