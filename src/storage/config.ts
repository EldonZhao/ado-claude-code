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
  projectDir = null;
}
