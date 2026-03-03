import * as fs from "node:fs/promises";
import * as path from "node:path";
import { AuthenticationError } from "../../utils/errors.js";
import { logger } from "../../utils/logger.js";
import type { AdoConfigOutput } from "../../schemas/config.schema.js";

export interface Credentials {
  type: "pat" | "azure-ad";
  token: string;
}

// Azure DevOps resource ID used for token scopes
const ADO_SCOPE = "499b84ac-1321-427f-aa17-267ca6975798/.default";

// Token cache file location (next to .ado-config.yaml)
const TOKEN_CACHE_FILE = ".ado-token-cache.json";

interface CachedToken {
  accessToken: string;
  expiresOnTimestamp: number;
}

async function getTokenCachePath(): Promise<string> {
  return path.join(process.cwd(), TOKEN_CACHE_FILE);
}

async function loadCachedToken(): Promise<CachedToken | null> {
  try {
    const cachePath = await getTokenCachePath();
    const raw = await fs.readFile(cachePath, "utf-8");
    const cached = JSON.parse(raw) as CachedToken;
    // Consider token valid if it expires more than 5 minutes from now
    if (cached.expiresOnTimestamp > Date.now() + 5 * 60 * 1000) {
      return cached;
    }
    return null;
  } catch {
    return null;
  }
}

async function saveCachedToken(token: CachedToken): Promise<void> {
  try {
    const cachePath = await getTokenCachePath();
    await fs.writeFile(cachePath, JSON.stringify(token, null, 2), "utf-8");
  } catch (err) {
    logger.warn({ err }, "Failed to cache token");
  }
}

/**
 * Get an Azure AD token using AzureCliCredential.
 * Requires the user to have run 'az login' first.
 */
async function getAzureCliToken(): Promise<string | null> {
  try {
    const { AzureCliCredential } = await import("@azure/identity");
    const credential = new AzureCliCredential();
    const tokenResponse = await credential.getToken(ADO_SCOPE);
    if (tokenResponse) {
      // Cache the token for faster subsequent lookups
      await saveCachedToken({
        accessToken: tokenResponse.token,
        expiresOnTimestamp: tokenResponse.expiresOnTimestamp,
      });
      return tokenResponse.token;
    }
    return null;
  } catch {
    return null;
  }
}

/**
 * Get credentials for ADO access.
 *
 * Resolution order for azure-ad auth:
 *   1. Cached Azure AD token (from previous login)
 *   2. Azure CLI credential (requires 'az login')
 *
 * Resolution order for pat auth:
 *   1. PAT from configured env var (default: ADO_PAT)
 *   2. ADO_PAT env var fallback
 */
export async function getCredentials(
  config: AdoConfigOutput,
): Promise<Credentials> {
  const authConfig = config.azure_devops.auth;

  // PAT auth
  if (authConfig.type === "pat") {
    const envVar = authConfig.patEnvVar ?? "ADO_PAT";
    const pat = process.env[envVar];
    if (pat) {
      logger.debug({ envVar }, "Using PAT from environment");
      return { type: "pat", token: pat };
    }
    const fallbackPat = process.env.ADO_PAT;
    if (fallbackPat) {
      logger.debug("Using ADO_PAT fallback");
      return { type: "pat", token: fallbackPat };
    }
    throw new AuthenticationError(
      `No PAT found. Set the ${envVar} environment variable, or switch to azure-ad auth: setup init --authType=azure-ad`,
    );
  }

  // Azure AD auth
  // 1. Try cached token
  const cached = await loadCachedToken();
  if (cached) {
    logger.debug("Using cached Azure AD token");
    return { type: "azure-ad", token: cached.accessToken };
  }

  // 2. Try Azure CLI credential
  const cliToken = await getAzureCliToken();
  if (cliToken) {
    return { type: "azure-ad", token: cliToken };
  }

  throw new AuthenticationError(
    "No Azure AD credentials found. Run 'setup login' to authenticate via browser, or install Azure CLI and run 'az login'.",
  );
}

/**
 * Clear cached Azure AD token.
 */
export async function clearTokenCache(): Promise<void> {
  try {
    const cachePath = await getTokenCachePath();
    await fs.unlink(cachePath);
  } catch {
    // File might not exist — that's fine
  }
}
