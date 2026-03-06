import { output, fatal, parseFlags } from "./helpers.js";
import { getTsgStorage } from "../storage/index.js";
import { TsgService } from "../services/tsg/index.js";
import { TsgSchema } from "../schemas/tsg.schema.js";
import {
  prepareDiagnosticStep,
  prepareResolution,
  getMissingParameters,
  formatTsgOverview,
} from "../services/tsg/executor.js";
import { getTsgTemplate, getTemplateCategories } from "../services/tsg/templates.js";
import { handleTroubleshoot } from "./troubleshoot.js";

export async function handleTsg(args: string[]): Promise<void> {
  const action = args[0];
  if (!action) {
    fatal("Usage: tsg <create|get|update|list|search|execute|score|ts> [args]");
  }

  switch (action) {
    case "create":
      return handleCreate(args.slice(1));
    case "get":
      return handleGet(args.slice(1));
    case "update":
      return handleUpdate(args.slice(1));
    case "list":
      return handleList(args.slice(1));
    case "search":
      return handleSearch(args.slice(1));
    case "execute":
      return handleExecute(args.slice(1));
    case "score":
      return handleScore(args.slice(1));
    case "ts":
      return handleTroubleshoot(args.slice(1));
    default:
      fatal(`Unknown tsg action: ${action}. Use create|get|update|list|search|execute|score|ts`);
  }
}

async function handleCreate(args: string[]): Promise<void> {
  const flags = parseFlags(args);
  const storage = await getTsgStorage();

  let input: Record<string, unknown>;
  if (flags.json) {
    input = JSON.parse(flags.json);
  } else {
    if (!flags.title || !flags.category) {
      fatal("Usage: tsg create --title=<title> --category=<cat> [--template] [--tags='[...]'] [--symptoms='[...]'] or --json='{...}'");
    }
    input = {
      title: flags.title,
      category: flags.category,
      tags: flags.tags ? JSON.parse(flags.tags) : [],
      symptoms: flags.symptoms ? JSON.parse(flags.symptoms) : [],
      relatedErrors: flags.relatedErrors ? JSON.parse(flags.relatedErrors) : [],
      author: flags.author,
      diagnostics: flags.diagnostics ? JSON.parse(flags.diagnostics) : [],
      resolutions: flags.resolutions ? JSON.parse(flags.resolutions) : {},
      escalation: flags.escalation ? JSON.parse(flags.escalation) : undefined,
    };
  }

  // Apply category template if --template is set
  const useTemplate = flags.template === "true" || flags.template === "";
  if (useTemplate) {
    const category = (input.category as string) ?? flags.category;
    const template = getTsgTemplate(category);
    if (!template) {
      const available = getTemplateCategories().join(", ");
      fatal(`No template for category "${category}". Available templates: ${available}`);
    }
    // Deep merge: template provides defaults, user-provided fields win
    input = mergeTemplate(template, input);
  }

  // Generate ID
  const category = input.category as string;
  const existing = await storage.listByCategory(category);
  const nextNum = existing.length + 1;
  const id = `tsg-${category}-${String(nextNum).padStart(3, "0")}`;

  const tsg = TsgSchema.parse({
    id,
    title: input.title,
    category,
    lastUpdated: new Date().toISOString().split("T")[0],
    author: input.author,
    tags: input.tags ?? [],
    symptoms: input.symptoms ?? [],
    relatedErrors: input.relatedErrors ?? [],
    prerequisites: input.prerequisites,
    diagnostics: input.diagnostics ?? [],
    resolutions: input.resolutions ?? {},
    escalation: input.escalation,
  });

  const filePath = await storage.save(tsg);
  output({ id: tsg.id, title: tsg.title, path: filePath });
}

async function handleGet(args: string[]): Promise<void> {
  const id = args.find((a) => !a.startsWith("--"));
  if (!id) fatal("Usage: tsg get <id>");

  const storage = await getTsgStorage();
  const tsg = await storage.loadById(id);

  if (!tsg) {
    fatal(`TSG "${id}" not found.`);
  }

  output(tsg);
}

async function handleUpdate(args: string[]): Promise<void> {
  const flags = parseFlags(args);
  const id = args.find((a) => !a.startsWith("--")) ?? flags.id;
  if (!id) fatal("Usage: tsg update <id> [--title=...] [--tags='[...]'] or --json='{...}'");

  const storage = await getTsgStorage();
  const existing = await storage.loadById(id);
  if (!existing) fatal(`TSG "${id}" not found.`);

  let updates: Record<string, unknown>;
  if (flags.json) {
    updates = JSON.parse(flags.json);
  } else {
    updates = {};
    if (flags.title !== undefined) updates.title = flags.title;
    if (flags.tags !== undefined) updates.tags = JSON.parse(flags.tags);
    if (flags.symptoms !== undefined) updates.symptoms = JSON.parse(flags.symptoms);
    if (flags.relatedErrors !== undefined) updates.relatedErrors = JSON.parse(flags.relatedErrors);
    if (flags.diagnostics !== undefined) updates.diagnostics = JSON.parse(flags.diagnostics);
    if (flags.resolutions !== undefined) updates.resolutions = JSON.parse(flags.resolutions);
    if (flags.escalation !== undefined) updates.escalation = JSON.parse(flags.escalation);
  }

  const merged = {
    ...existing,
    ...updates,
    lastUpdated: new Date().toISOString().split("T")[0],
  };

  const validated = TsgSchema.parse(merged);
  const filePath = await storage.save(validated);
  output({ id: validated.id, title: validated.title, path: filePath });
}

async function handleList(args: string[]): Promise<void> {
  const flags = parseFlags(args);
  const storage = await getTsgStorage();

  const tsgs = flags.category
    ? await storage.listByCategory(flags.category)
    : await storage.listAll();

  if (tsgs.length === 0) {
    output({ count: 0, items: [], message: flags.category ? `No TSGs in category "${flags.category}".` : "No TSGs found." });
    return;
  }

  output({
    count: tsgs.length,
    items: tsgs.map((t) => ({
      id: t.id,
      title: t.title,
      category: t.category,
      tags: t.tags,
      diagnosticCount: t.diagnostics.length,
      resolutionCount: Object.keys(t.resolutions).length,
    })),
  });
}

async function handleSearch(args: string[]): Promise<void> {
  const flags = parseFlags(args);
  const storage = await getTsgStorage();
  const service = new TsgService(storage);

  const results = await service.search({
    text: flags.query,
    symptoms: flags.symptoms ? JSON.parse(flags.symptoms) : undefined,
    tags: flags.tags ? JSON.parse(flags.tags) : undefined,
    category: flags.category,
  });

  if (results.length === 0) {
    output({ count: 0, items: [], message: "No matching TSGs found." });
    return;
  }

  output({
    count: results.length,
    items: results.map((r) => ({
      id: r.tsg.id,
      title: r.tsg.title,
      score: r.score,
      matchedOn: r.matchedOn,
      category: r.tsg.category,
    })),
  });
}

async function handleExecute(args: string[]): Promise<void> {
  const flags = parseFlags(args);
  const id = args.find((a) => !a.startsWith("--")) ?? flags.id;
  if (!id) fatal("Usage: tsg execute <id> [--stepId=...] [--rootCause=...] [--parameters='{...}']");

  const storage = await getTsgStorage();
  const tsg = await storage.loadById(id);
  if (!tsg) fatal(`TSG "${id}" not found.`);

  const parameters = flags.parameters ? JSON.parse(flags.parameters) : {};
  const context = { parameters };

  // Execute specific diagnostic step
  if (flags.stepId) {
    const result = prepareDiagnosticStep(tsg, flags.stepId, context);
    output(result);
    return;
  }

  // Get resolution
  if (flags.rootCause) {
    const resolution = prepareResolution(tsg, flags.rootCause, context);
    output(resolution);
    return;
  }

  // List available steps and resolutions
  const missing = getMissingParameters(tsg, parameters);
  output({
    id: tsg.id,
    title: tsg.title,
    overview: formatTsgOverview(tsg),
    diagnosticSteps: tsg.diagnostics.map((d) => ({ id: d.id, name: d.name, manual: d.manual })),
    resolutions: Object.entries(tsg.resolutions).map(([key, res]) => ({ key, name: res.name, stepCount: res.steps.length })),
    missingParameters: missing,
  });
}

/**
 * Deep-merge a template with user input.
 * Arrays are concatenated (user first, template appended), objects are spread (user wins).
 */
function mergeTemplate(
  template: Record<string, unknown>,
  userInput: Record<string, unknown>,
): Record<string, unknown> {
  const merged: Record<string, unknown> = { ...template };

  for (const [key, userVal] of Object.entries(userInput)) {
    if (userVal === undefined || userVal === null) continue;

    const tmplVal = merged[key];

    // Arrays: concat user + template (deduplicated for strings)
    if (Array.isArray(userVal) && Array.isArray(tmplVal)) {
      if (userVal.length > 0) {
        // User provided values — put user first, append unique template entries
        const seen = new Set(userVal.filter((v): v is string => typeof v === "string").map((s) => s.toLowerCase()));
        const tmplUnique = tmplVal.filter((v) => typeof v !== "string" || !seen.has(v.toLowerCase()));
        merged[key] = [...userVal, ...tmplUnique];
      }
      // If user array is empty, keep template array
      continue;
    }

    // Objects: shallow merge (user wins)
    if (typeof userVal === "object" && !Array.isArray(userVal) && typeof tmplVal === "object" && !Array.isArray(tmplVal)) {
      merged[key] = { ...tmplVal as Record<string, unknown>, ...userVal as Record<string, unknown> };
      continue;
    }

    // Scalars: user wins
    merged[key] = userVal;
  }

  return merged;
}

async function handleScore(args: string[]): Promise<void> {
  const id = args.find((a) => !a.startsWith("--"));
  if (!id) fatal("Usage: tsg score <id>");

  const storage = await getTsgStorage();
  const tsg = await storage.loadById(id);
  if (!tsg) fatal(`TSG "${id}" not found.`);

  const breakdown: Record<string, { score: number; max: number }> = {};
  const suggestions: string[] = [];
  let total = 0;
  const maxScore = 125;

  // Symptoms (max 20)
  const symptomsScore = Math.min(tsg.symptoms.length * 5, 20);
  breakdown.symptoms = { score: symptomsScore, max: 20 };
  total += symptomsScore;
  if (tsg.symptoms.length === 0) suggestions.push("Add symptoms to help match this TSG during troubleshooting");

  // Related errors (max 10)
  const errorsScore = Math.min(tsg.relatedErrors.length * 5, 10);
  breakdown.relatedErrors = { score: errorsScore, max: 10 };
  total += errorsScore;
  if (tsg.relatedErrors.length === 0) suggestions.push("Add related error messages for better pattern matching");

  // Diagnostics with commands (max 40)
  const stepsWithCommands = tsg.diagnostics.filter((d) => d.command).length;
  const diagnosticsScore = Math.min(stepsWithCommands * 20, 40);
  breakdown.diagnostics = { score: diagnosticsScore, max: 40 };
  total += diagnosticsScore;
  if (tsg.diagnostics.length === 0) suggestions.push("Add diagnostic steps with commands");
  else if (stepsWithCommands === 0) suggestions.push("Add command templates to diagnostic steps");

  // Analysis patterns with root causes (max 15)
  const patternsWithCauses = tsg.diagnostics.flatMap((d) =>
    (d.analysis?.lookFor ?? []).filter((p) => p.indicatesRootCause),
  ).length;
  const analysisScore = Math.min(patternsWithCauses * 5, 15);
  breakdown.analysisPatterns = { score: analysisScore, max: 15 };
  total += analysisScore;
  if (patternsWithCauses === 0) suggestions.push("Add analysis patterns with indicatesRootCause to link diagnostics to resolutions");

  // Resolutions with steps (max 30)
  const resEntries = Object.values(tsg.resolutions);
  const resWithSteps = resEntries.filter((r) => r.steps.length > 0).length;
  const resolutionsScore = Math.min(resWithSteps * 15, 30);
  breakdown.resolutions = { score: resolutionsScore, max: 30 };
  total += resolutionsScore;
  if (resEntries.length === 0) suggestions.push("Add resolution entries for identified root causes");
  else if (resWithSteps === 0) suggestions.push("Add steps to your resolution entries");

  // Escalation (max 10)
  const hasEscalation = tsg.escalation?.contacts && tsg.escalation.contacts.length > 0;
  const escalationScore = hasEscalation ? 10 : 0;
  breakdown.escalation = { score: escalationScore, max: 10 };
  total += escalationScore;
  if (!hasEscalation) suggestions.push("Add escalation contacts for when the TSG doesn't resolve the issue");

  output({
    id: tsg.id,
    title: tsg.title,
    score: total,
    maxScore,
    percentage: Math.round((total / maxScore) * 100),
    breakdown,
    suggestions,
  });
}
