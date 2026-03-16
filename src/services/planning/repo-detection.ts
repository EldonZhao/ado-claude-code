import * as path from "node:path";

export interface RepoConfig {
  path: string;
}

export interface RepoFeatures {
  repoName: string;
  repoPath: string;
  features: string[];
  isCurrentRepo: boolean;
}

/**
 * Strip HTML tags, convert block-level elements to newlines, decode common entities.
 */
export function stripHtml(text: string): string {
  return text
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<\/(p|div|li|tr)>/gi, "\n")
    .replace(/<[^>]+>/g, "")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&nbsp;/g, " ");
}

/**
 * Detect which configured repos are referenced in a work item's text fields
 * and extract per-repo feature lists.
 */
export function detectRepos(
  repos: Record<string, RepoConfig>,
  description: string | undefined,
  latestComment: string | undefined,
  cwd: string,
): RepoFeatures[] {
  const repoNames = Object.keys(repos);
  if (repoNames.length === 0) return [];

  const rawText = [description ?? "", latestComment ?? ""].join("\n");
  const text = stripHtml(rawText);

  const results: RepoFeatures[] = [];
  const resolvedCwd = path.resolve(cwd);

  for (const name of repoNames) {
    const repoPath = repos[name].path;
    const resolvedRepoPath = path.resolve(repoPath);
    const isCurrentRepo = resolvedCwd.startsWith(resolvedRepoPath);

    const features = extractFeatures(text, name);
    const mentioned = features.length > 0 || isMentioned(text, name);

    if (mentioned) {
      results.push({
        repoName: name,
        repoPath: resolvedRepoPath,
        features,
        isCurrentRepo,
      });
    }
  }

  // Sort: current repo first
  results.sort((a, b) => {
    if (a.isCurrentRepo && !b.isCurrentRepo) return -1;
    if (!a.isCurrentRepo && b.isCurrentRepo) return 1;
    return 0;
  });

  return results;
}

/**
 * Extract features from structured list patterns:
 *   - repoName: feature text
 *   - **repoName**: feature text
 *   - *repoName*: feature text
 */
function extractFeatures(text: string, repoName: string): string[] {
  const features: string[] = [];
  const escaped = escapeRegExp(repoName);

  // Match: - repoName: feature text
  // Match: - **repoName**: feature text
  // Match: - *repoName*: feature text
  const pattern = new RegExp(
    `^\\s*[-*]\\s+(?:\\*{1,2})?${escaped}(?:\\*{1,2})?\\s*:\\s*(.+)$`,
    "gmi",
  );

  let match: RegExpExecArray | null;
  while ((match = pattern.exec(text)) !== null) {
    const feature = match[1].trim();
    if (feature) features.push(feature);
  }

  return features;
}

/**
 * Check if a repo name is mentioned anywhere in text (word boundary match).
 */
function isMentioned(text: string, repoName: string): boolean {
  const escaped = escapeRegExp(repoName);
  const pattern = new RegExp(`\\b${escaped}\\b`, "i");
  return pattern.test(text);
}

function escapeRegExp(str: string): string {
  return str.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}
