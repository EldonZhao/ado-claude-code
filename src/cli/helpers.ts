import { AdoClient } from "../services/ado/client.js";
import type { AdoWorkItem } from "../services/ado/types.js";
import type { AdoConfigOutput } from "../schemas/config.schema.js";
import type { LocalWorkItemOutput } from "../schemas/work-item.schema.js";
import { adoToLocal } from "../services/sync/mapper.js";
import { SyncStateManager } from "../services/sync/state.js";
import { loadConfig } from "../storage/config.js";

let clientInstance: AdoClient | null = null;
let syncStateInstance: SyncStateManager | null = null;

export async function getAdoClient(
  configOverride?: AdoConfigOutput,
): Promise<AdoClient> {
  if (clientInstance) return clientInstance;
  const config = configOverride ?? (await loadConfig());
  clientInstance = new AdoClient(config);
  return clientInstance;
}

export async function getSyncStateManager(
  configOverride?: AdoConfigOutput,
): Promise<SyncStateManager> {
  if (syncStateInstance) return syncStateInstance;
  const config = configOverride ?? (await loadConfig());
  syncStateInstance = new SyncStateManager(
    config.storage.basePath,
    config.azure_devops.organization,
    config.azure_devops.project,
  );
  return syncStateInstance;
}

export function mapAdoToLocal(item: AdoWorkItem): LocalWorkItemOutput {
  return adoToLocal(item);
}

export function formatWorkItemSummary(item: LocalWorkItemOutput): string {
  const parts = [
    `#${item.id} [${item.type}] ${item.title}`,
    `  State: ${item.state}`,
  ];
  if (item.assignedTo) parts.push(`  Assigned: ${item.assignedTo}`);
  if (item.priority) parts.push(`  Priority: ${item.priority}`);
  if (item.storyPoints) parts.push(`  Points: ${item.storyPoints}`);
  if (item.iterationPath) parts.push(`  Iteration: ${item.iterationPath}`);
  return parts.join("\n");
}

/** Write JSON to stdout */
export function output(data: unknown): void {
  process.stdout.write(JSON.stringify(data, null, 2) + "\n");
}

/** Write error to stderr and exit */
export function fatal(message: string, exitCode = 1): never {
  process.stderr.write(`Error: ${message}\n`);
  process.exit(exitCode);
}

/** Convert basic markdown to HTML for ADO work item comments */
export function markdownToHtml(md: string): string {
  const lines = md.split("\n");
  const html: string[] = [];
  let inList = false;

  for (const line of lines) {
    const trimmed = line.trimEnd();

    // Headings
    const headingMatch = trimmed.match(/^(#{1,6})\s+(.+)$/);
    if (headingMatch) {
      if (inList) { html.push("</ul>"); inList = false; }
      const level = headingMatch[1].length;
      html.push(`<h${level}>${escapeHtml(headingMatch[2])}</h${level}>`);
      continue;
    }

    // Unordered list items (- or *)
    const ulMatch = trimmed.match(/^[-*]\s+(.+)$/);
    if (ulMatch) {
      if (!inList) { html.push("<ul>"); inList = true; }
      html.push(`<li>${inlineMarkdown(ulMatch[1])}</li>`);
      continue;
    }

    // Ordered list items
    const olMatch = trimmed.match(/^\d+\.\s+(.+)$/);
    if (olMatch) {
      if (!inList) { html.push("<ul>"); inList = true; }
      html.push(`<li>${inlineMarkdown(olMatch[1])}</li>`);
      continue;
    }

    // End list on non-list line
    if (inList) { html.push("</ul>"); inList = false; }

    // Empty line
    if (trimmed === "") {
      html.push("<br>");
      continue;
    }

    // Regular paragraph
    html.push(`<p>${inlineMarkdown(trimmed)}</p>`);
  }

  if (inList) html.push("</ul>");
  return html.join("\n");
}

function escapeHtml(text: string): string {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

function inlineMarkdown(text: string): string {
  let result = escapeHtml(text);
  // Bold: **text** or __text__
  result = result.replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>");
  result = result.replace(/__(.+?)__/g, "<strong>$1</strong>");
  // Italic: *text* or _text_
  result = result.replace(/\*(.+?)\*/g, "<em>$1</em>");
  result = result.replace(/_(.+?)_/g, "<em>$1</em>");
  // Inline code: `text`
  result = result.replace(/`(.+?)`/g, "<code>$1</code>");
  return result;
}

/** Parse --flag=value args into a record */
export function parseFlags(args: string[]): Record<string, string> {
  const flags: Record<string, string> = {};
  for (const arg of args) {
    if (arg.startsWith("--")) {
      const eq = arg.indexOf("=");
      if (eq !== -1) {
        flags[arg.slice(2, eq)] = arg.slice(eq + 1);
      } else {
        // Boolean flag
        flags[arg.slice(2)] = "true";
      }
    }
  }
  return flags;
}
