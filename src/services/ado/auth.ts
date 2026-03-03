import { AuthenticationError } from "../../utils/errors.js";
import { logger } from "../../utils/logger.js";
import type { AdoConfigOutput } from "../../schemas/config.schema.js";

export interface Credentials {
  type: "pat" | "azure-ad";
  token: string;
}

export async function getCredentials(
  config: AdoConfigOutput,
): Promise<Credentials> {
  const authConfig = config.azure_devops.auth;

  // 1. PAT from environment variable
  if (authConfig.type === "pat") {
    const envVar = authConfig.patEnvVar ?? "ADO_PAT";
    const pat = process.env[envVar];
    if (pat) {
      logger.debug({ envVar }, "Using PAT from environment");
      return { type: "pat", token: pat };
    }
  }

  // 2. ADO_PAT fallback (regardless of config auth type)
  const fallbackPat = process.env.ADO_PAT;
  if (fallbackPat) {
    logger.debug("Using ADO_PAT fallback");
    return { type: "pat", token: fallbackPat };
  }

  // 3. Azure AD — try az CLI
  if (authConfig.type === "azure-ad") {
    try {
      const token = await getAzureCliToken();
      if (token) {
        logger.debug("Using Azure CLI token");
        return { type: "azure-ad", token };
      }
    } catch {
      // Fall through to error
    }
  }

  throw new AuthenticationError(
    "No credentials found. Set the ADO_PAT environment variable or configure Azure AD authentication.",
  );
}

async function getAzureCliToken(): Promise<string | null> {
  try {
    const { execSync } = await import("node:child_process");
    // Azure DevOps resource ID
    const result = execSync(
      'az account get-access-token --resource "499b84ac-1321-427f-aa17-267ca6975798" --query accessToken -o tsv',
      { encoding: "utf-8", timeout: 10000 },
    ).trim();
    return result || null;
  } catch {
    return null;
  }
}
