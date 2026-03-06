import { stringify as stringifyYaml, parse as parseYaml } from "yaml";
import { TsgSchema, type TsgOutput, type DiagnosticStep, type Resolution } from "../../schemas/tsg.schema.js";

// ─── Serializer ────────────────────────────────────────────────

export function tsgToMarkdown(tsg: TsgOutput): string {
  const parts: string[] = [];

  // Frontmatter
  parts.push("---");
  const fm: Record<string, unknown> = {
    id: tsg.id,
    title: tsg.title,
    version: tsg.version,
  };
  if (tsg.lastUpdated) fm.lastUpdated = tsg.lastUpdated;
  if (tsg.author) fm.author = tsg.author;
  fm.category = tsg.category;
  if (tsg.tags.length > 0) fm.tags = tsg.tags;
  if (tsg.symptoms.length > 0) fm.symptoms = tsg.symptoms;
  if (tsg.relatedErrors.length > 0) fm.relatedErrors = tsg.relatedErrors;
  if (tsg.applicability) fm.applicability = tsg.applicability;
  parts.push(stringifyYaml(fm, { lineWidth: 120 }).trim());
  parts.push("---");
  parts.push("");

  // Title
  parts.push(`# ${tsg.title}`);
  parts.push("");

  // Prerequisites
  if (tsg.prerequisites) {
    const pre = tsg.prerequisites;
    const hasContent =
      (pre.tools && pre.tools.length > 0) ||
      (pre.permissions && pre.permissions.length > 0) ||
      (pre.context && pre.context.length > 0);
    if (hasContent) {
      parts.push("## Prerequisites");
      parts.push("");
      if (pre.tools && pre.tools.length > 0) {
        parts.push("### Tools");
        for (const t of pre.tools) {
          parts.push(t.minVersion ? `- ${t.name} (>= ${t.minVersion})` : `- ${t.name}`);
        }
        parts.push("");
      }
      if (pre.permissions && pre.permissions.length > 0) {
        parts.push("### Permissions");
        for (const p of pre.permissions) {
          parts.push(`- ${p}`);
        }
        parts.push("");
      }
      if (pre.context && pre.context.length > 0) {
        parts.push("### Context Required");
        for (const c of pre.context) {
          parts.push(`- ${c}`);
        }
        parts.push("");
      }
    }
  }

  // Diagnostics
  if (tsg.diagnostics.length > 0) {
    parts.push("## Diagnostics");
    parts.push("");
    for (const step of tsg.diagnostics) {
      renderDiagnosticStep(step, parts);
    }
  }

  // Resolutions
  const resKeys = Object.keys(tsg.resolutions);
  if (resKeys.length > 0) {
    parts.push("## Resolutions");
    parts.push("");
    for (const key of resKeys) {
      renderResolution(key, tsg.resolutions[key], parts);
    }
  }

  // Escalation
  if (tsg.escalation) {
    const esc = tsg.escalation;
    const hasContent = esc.timeout || (esc.contacts && esc.contacts.length > 0);
    if (hasContent) {
      parts.push("## Escalation");
      parts.push("");
      if (esc.timeout) {
        parts.push(`- **Timeout:** ${esc.timeout}`);
      }
      if (esc.contacts) {
        for (const c of esc.contacts) {
          const label = c.channel ? `${c.team} (${c.channel})` : c.team;
          parts.push(`- **Contact:** ${label}`);
        }
      }
      parts.push("");
    }
  }

  // Related
  if (tsg.related) {
    const rel = tsg.related;
    const hasContent =
      (rel.tsgs && rel.tsgs.length > 0) ||
      (rel.docs && rel.docs.length > 0) ||
      (rel.runbooks && rel.runbooks.length > 0);
    if (hasContent) {
      parts.push("## Related");
      parts.push("");
      if (rel.tsgs && rel.tsgs.length > 0) {
        parts.push(`- TSGs: ${rel.tsgs.join(", ")}`);
      }
      if (rel.docs && rel.docs.length > 0) {
        for (const d of rel.docs) {
          parts.push(`- Docs: [${d.title}](${d.url})`);
        }
      }
      if (rel.runbooks && rel.runbooks.length > 0) {
        parts.push(`- Runbooks: ${rel.runbooks.join(", ")}`);
      }
      parts.push("");
    }
  }

  return parts.join("\n");
}

function renderDiagnosticStep(step: DiagnosticStep, parts: string[]): void {
  const manualTag = step.manual ? " [MANUAL]" : "";
  parts.push(`### Step: ${step.id} — ${step.name}${manualTag}`);
  parts.push("");

  if (step.description) {
    parts.push(step.description);
    parts.push("");
  }

  if (step.command) {
    parts.push(`Run \`${step.command.template}\``);
    parts.push("");

    if (step.command.parameters && step.command.parameters.length > 0) {
      parts.push("**Parameters:**");
      for (const p of step.command.parameters) {
        const reqStr = p.required ? "required" : "optional";
        const defStr = p.default !== undefined ? `, default: "${p.default}"` : "";
        const descStr = p.description ? ` — ${p.description}` : "";
        parts.push(`- \`${p.name}\` (${reqStr}${defStr})${descStr}`);
      }
      parts.push("");
    }
  }

  if (step.manual && step.guidance) {
    parts.push("**Guidance:**");
    parts.push(step.guidance);
    parts.push("");
  }

  if (step.analysis?.lookFor && step.analysis.lookFor.length > 0) {
    parts.push("**Analysis — look for:**");
    for (const a of step.analysis.lookFor) {
      const typeTag = a.type === "regex" ? " [regex]" : "";
      const cause = a.indicatesRootCause ? ` → root cause: **${a.indicatesRootCause}**` : "";
      const sev = a.severity ? ` (severity: ${a.severity})` : "";
      parts.push(`- \`${a.pattern}\`${typeTag}${cause}${sev}`);
    }
    parts.push("");
  }

  if (step.expectedOutput) {
    if (step.expectedOutput.success) {
      parts.push(`*Success: ${step.expectedOutput.success.pattern}*`);
      parts.push("");
    }
    if (step.expectedOutput.failure) {
      parts.push("*Failure patterns:*");
      for (const fp of step.expectedOutput.failure.patterns) {
        parts.push(`- \`${fp}\``);
      }
      parts.push("");
    }
  }
}

function renderResolution(key: string, res: Resolution, parts: string[]): void {
  const desc = res.description ? ` — ${res.description}` : "";
  parts.push(`### Root Cause: ${key} — ${res.name}${desc}`);
  parts.push("");

  for (let i = 0; i < res.steps.length; i++) {
    const s = res.steps[i];
    const manualTag = s.manual ? " [MANUAL]" : "";
    parts.push(`${i + 1}. **${s.id}** — ${s.action}${manualTag}`);

    if (s.description) {
      parts.push(`   ${s.description}`);
    }

    if (s.command) {
      parts.push(`   Run \`${s.command}\``);
    }

    if (s.guidance) {
      parts.push(`   **Guidance:** ${s.guidance}`);
    }

    if (s.successCriteria) {
      parts.push(`   *Success: ${s.successCriteria.pattern}*`);
    }
  }
  parts.push("");
}

// ─── Parser ────────────────────────────────────────────────────

export function markdownToTsg(content: string): TsgOutput {
  const { frontmatter, body } = parseFrontmatter(content);
  const sections = extractSections(body);

  const tsg: Record<string, unknown> = {
    ...frontmatter,
    prerequisites: sections.Prerequisites
      ? parsePrerequisites(sections.Prerequisites)
      : undefined,
    diagnostics: sections.Diagnostics
      ? parseDiagnosticSteps(sections.Diagnostics)
      : [],
    resolutions: sections.Resolutions
      ? parseResolutions(sections.Resolutions)
      : {},
    escalation: sections.Escalation
      ? parseEscalation(sections.Escalation)
      : undefined,
    related: sections.Related ? parseRelated(sections.Related) : undefined,
  };

  // Remove undefined values so schema defaults apply
  for (const k of Object.keys(tsg)) {
    if (tsg[k] === undefined) delete tsg[k];
  }

  return TsgSchema.parse(tsg);
}

// ─── Private helpers ───────────────────────────────────────────

function parseFrontmatter(content: string): {
  frontmatter: Record<string, unknown>;
  body: string;
} {
  const match = content.match(/^---\r?\n([\s\S]*?)\r?\n---\r?\n?([\s\S]*)$/);
  if (!match) {
    throw new Error("Invalid TSG markdown: missing YAML frontmatter (expected --- delimiters)");
  }
  const frontmatter = parseYaml(match[1]) as Record<string, unknown>;
  const body = match[2];
  return { frontmatter, body };
}

function extractSections(body: string): Record<string, string> {
  const sections: Record<string, string> = {};
  const parts = body.split(/^## /m);

  for (const part of parts) {
    if (!part.trim()) continue;
    const nlIdx = part.indexOf("\n");
    if (nlIdx === -1) continue;
    const heading = part.slice(0, nlIdx).trim();
    const content = part.slice(nlIdx + 1);
    sections[heading] = content;
  }

  return sections;
}

function parsePrerequisites(content: string): Record<string, unknown> {
  const result: Record<string, unknown> = {};
  const subSections = content.split(/^### /m);

  for (const sub of subSections) {
    if (!sub.trim()) continue;
    const nlIdx = sub.indexOf("\n");
    if (nlIdx === -1) continue;
    const heading = sub.slice(0, nlIdx).trim();
    const body = sub.slice(nlIdx + 1);

    if (heading === "Tools") {
      result.tools = parseToolsList(body);
    } else if (heading === "Permissions") {
      result.permissions = parseSimpleList(body);
    } else if (heading === "Context Required") {
      result.context = parseSimpleList(body);
    }
  }

  return result;
}

function parseToolsList(
  body: string,
): Array<{ name: string; minVersion?: string }> {
  const tools: Array<{ name: string; minVersion?: string }> = [];
  const lines = body.split(/\r?\n/);
  for (const line of lines) {
    const m = line.match(/^- (.+?)(?:\s*\(>=\s*(.+?)\))?$/);
    if (m) {
      const tool: { name: string; minVersion?: string } = { name: m[1].trim() };
      if (m[2]) tool.minVersion = m[2].trim();
      tools.push(tool);
    }
  }
  return tools;
}

function parseSimpleList(body: string): string[] {
  const items: string[] = [];
  const lines = body.split(/\r?\n/);
  for (const line of lines) {
    const m = line.match(/^- (.+)$/);
    if (m) items.push(m[1].trim());
  }
  return items;
}

function parseDiagnosticSteps(content: string): Array<Record<string, unknown>> {
  const steps: Array<Record<string, unknown>> = [];
  const stepBlocks = content.split(/^### Step: /m);

  for (const block of stepBlocks) {
    if (!block.trim()) continue;

    // Parse header: "id — name [MANUAL]"
    const headerMatch = block.match(
      /^(.+?)\s*—\s*(.+?)(\s*\[MANUAL\])?\s*\r?\n([\s\S]*)$/,
    );
    if (!headerMatch) continue;

    const step: Record<string, unknown> = {
      id: headerMatch[1].trim(),
      name: headerMatch[2].trim(),
      manual: !!headerMatch[3],
    };

    const body = headerMatch[4];
    parseStepBody(body, step);
    steps.push(step);
  }

  return steps;
}

function parseStepBody(body: string, step: Record<string, unknown>): void {
  const lines = body.split(/\r?\n/);
  let i = 0;

  // Description: text before any recognized block
  const descLines: string[] = [];

  while (i < lines.length) {
    const line = lines[i];

    // Command
    const cmdMatch = line.match(/^Run `(.+)`$/);
    if (cmdMatch) {
      // Flush description
      if (descLines.length > 0) {
        step.description = descLines.join("\n").trim();
        descLines.length = 0;
      }
      const cmd: Record<string, unknown> = { template: cmdMatch[1] };
      i++;

      // Parameters block
      if (i < lines.length && lines[i].trim() === "") i++;
      if (i < lines.length && lines[i].trim() === "**Parameters:**") {
        i++;
        const params: Array<Record<string, unknown>> = [];
        while (i < lines.length && lines[i].match(/^- `/)) {
          const paramMatch = lines[i].match(
            /^- `(.+?)`\s*\((\w+)(?:,\s*default:\s*"(.+?)")?\)(.*)$/,
          );
          if (paramMatch) {
            const param: Record<string, unknown> = {
              name: paramMatch[1],
              required: paramMatch[2] === "required",
            };
            if (paramMatch[3] !== undefined) param.default = paramMatch[3];
            const descPart = paramMatch[4];
            if (descPart) {
              const dm = descPart.match(/^\s*—\s*(.+)$/);
              if (dm) param.description = dm[1].trim();
            }
            params.push(param);
          }
          i++;
        }
        if (params.length > 0) cmd.parameters = params;
      }
      step.command = cmd;
      continue;
    }

    // Guidance
    if (line.trim() === "**Guidance:**") {
      // Flush description
      if (descLines.length > 0) {
        step.description = descLines.join("\n").trim();
        descLines.length = 0;
      }
      i++;
      const guidanceLines: string[] = [];
      while (i < lines.length && !lines[i].match(/^\*\*/) && !lines[i].match(/^### /)) {
        guidanceLines.push(lines[i]);
        i++;
      }
      step.guidance = guidanceLines.join("\n").trim();
      continue;
    }

    // Analysis
    if (line.trim() === "**Analysis — look for:**") {
      // Flush description
      if (descLines.length > 0) {
        step.description = descLines.join("\n").trim();
        descLines.length = 0;
      }
      i++;
      const lookFor: Array<Record<string, unknown>> = [];
      while (i < lines.length && lines[i].match(/^- `/)) {
        const am = lines[i].match(
          /^- `(.+?)`(\s*\[regex\])?(?: → root cause: \*\*(.+?)\*\*)?(?: \(severity: (\w+)\))?$/,
        );
        if (am) {
          const entry: Record<string, unknown> = {
            pattern: am[1],
            type: am[2] ? "regex" : "literal",
          };
          if (am[3]) entry.indicatesRootCause = am[3];
          if (am[4]) entry.severity = am[4];
          lookFor.push(entry);
        }
        i++;
      }
      if (lookFor.length > 0) {
        step.analysis = { lookFor };
      }
      continue;
    }

    // Success pattern
    const successMatch = line.match(/^\*Success: (.+)\*$/);
    if (successMatch) {
      if (descLines.length > 0) {
        step.description = descLines.join("\n").trim();
        descLines.length = 0;
      }
      if (!step.expectedOutput) step.expectedOutput = {};
      (step.expectedOutput as Record<string, unknown>).success = {
        pattern: successMatch[1],
      };
      i++;
      continue;
    }

    // Failure patterns
    if (line.trim() === "*Failure patterns:*") {
      if (descLines.length > 0) {
        step.description = descLines.join("\n").trim();
        descLines.length = 0;
      }
      i++;
      const patterns: string[] = [];
      while (i < lines.length && lines[i].match(/^- `/)) {
        const fm = lines[i].match(/^- `(.+)`$/);
        if (fm) patterns.push(fm[1]);
        i++;
      }
      if (patterns.length > 0) {
        if (!step.expectedOutput) step.expectedOutput = {};
        (step.expectedOutput as Record<string, unknown>).failure = { patterns };
      }
      continue;
    }

    // Empty line after description is NOT description
    if (line.trim() === "" && descLines.length > 0) {
      step.description = descLines.join("\n").trim();
      descLines.length = 0;
      i++;
      continue;
    }

    // Skip empty leading lines
    if (line.trim() === "") {
      i++;
      continue;
    }

    // Otherwise it's description text
    descLines.push(line);
    i++;
  }

  if (descLines.length > 0) {
    step.description = descLines.join("\n").trim();
  }
}

function parseResolutions(
  content: string,
): Record<string, Record<string, unknown>> {
  const result: Record<string, Record<string, unknown>> = {};
  const blocks = content.split(/^### Root Cause: /m);

  for (const block of blocks) {
    if (!block.trim()) continue;

    // Parse header: "key — name — description" or "key — name"
    const headerMatch = block.match(
      /^(.+?)\s*—\s*(.+?)(?:\s*—\s*(.+?))?\s*\r?\n([\s\S]*)$/,
    );
    if (!headerMatch) continue;

    const key = headerMatch[1].trim();
    const resolution: Record<string, unknown> = {
      name: headerMatch[2].trim(),
    };
    if (headerMatch[3]) resolution.description = headerMatch[3].trim();

    const body = headerMatch[4];
    resolution.steps = parseResolutionSteps(body);
    result[key] = resolution;
  }

  return result;
}

function parseResolutionSteps(body: string): Array<Record<string, unknown>> {
  const steps: Array<Record<string, unknown>> = [];
  const lines = body.split(/\r?\n/);
  let i = 0;

  while (i < lines.length) {
    const line = lines[i];

    // Numbered step: "1. **id** — action [MANUAL]"
    const stepMatch = line.match(
      /^\d+\.\s+\*\*(.+?)\*\*\s*—\s*(.+?)(\s*\[MANUAL\])?\s*$/,
    );
    if (stepMatch) {
      const step: Record<string, unknown> = {
        id: stepMatch[1].trim(),
        action: stepMatch[2].trim(),
        manual: !!stepMatch[3],
      };
      i++;

      // Continuation lines (indented with 3+ spaces)
      while (i < lines.length && lines[i].match(/^ {3}/)) {
        const contLine = lines[i].trim();

        const cmdMatch = contLine.match(/^Run `(.+)`$/);
        if (cmdMatch) {
          step.command = cmdMatch[1];
          i++;
          continue;
        }

        const successMatch = contLine.match(/^\*Success: (.+)\*$/);
        if (successMatch) {
          step.successCriteria = { pattern: successMatch[1] };
          i++;
          continue;
        }

        // Guidance: **Guidance:** text
        const guidanceMatch = contLine.match(/^\*\*Guidance:\*\*\s*(.+)$/);
        if (guidanceMatch) {
          step.guidance = guidanceMatch[1].trim();
          i++;
          continue;
        }

        // Description text
        if (!step.description) {
          step.description = contLine;
        }
        i++;
      }
      steps.push(step);
      continue;
    }

    i++;
  }

  return steps;
}

function parseEscalation(content: string): Record<string, unknown> {
  const result: Record<string, unknown> = {};
  const lines = content.split(/\r?\n/);

  const contacts: Array<Record<string, unknown>> = [];

  for (const line of lines) {
    const timeoutMatch = line.match(/^- \*\*Timeout:\*\*\s*(.+)$/);
    if (timeoutMatch) {
      result.timeout = timeoutMatch[1].trim();
      continue;
    }

    const contactMatch = line.match(/^- \*\*Contact:\*\*\s*(.+)$/);
    if (contactMatch) {
      const raw = contactMatch[1].trim();
      const channelMatch = raw.match(/^(.+?)\s*\((.+?)\)$/);
      if (channelMatch) {
        contacts.push({
          team: channelMatch[1].trim(),
          channel: channelMatch[2].trim(),
        });
      } else {
        contacts.push({ team: raw });
      }
    }
  }

  if (contacts.length > 0) result.contacts = contacts;
  return result;
}

function parseRelated(content: string): Record<string, unknown> {
  const result: Record<string, unknown> = {};
  const lines = content.split(/\r?\n/);

  const tsgs: string[] = [];
  const docs: Array<{ title: string; url: string }> = [];
  const runbooks: string[] = [];

  for (const line of lines) {
    const tsgMatch = line.match(/^- TSGs?:\s*(.+)$/);
    if (tsgMatch) {
      tsgs.push(
        ...tsgMatch[1].split(",").map((s) => s.trim()).filter(Boolean),
      );
      continue;
    }

    const docMatch = line.match(/^- Docs?:\s*\[(.+?)]\((.+?)\)$/);
    if (docMatch) {
      docs.push({ title: docMatch[1], url: docMatch[2] });
      continue;
    }

    const runbookMatch = line.match(/^- Runbooks?:\s*(.+)$/);
    if (runbookMatch) {
      runbooks.push(
        ...runbookMatch[1].split(",").map((s) => s.trim()).filter(Boolean),
      );
    }
  }

  if (tsgs.length > 0) result.tsgs = tsgs;
  if (docs.length > 0) result.docs = docs;
  if (runbooks.length > 0) result.runbooks = runbooks;

  return Object.keys(result).length > 0 ? result : {};
}
