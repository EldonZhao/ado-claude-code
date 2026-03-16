import { output, fatal, parseFlags } from "./helpers.js";
import { getInstructionsStorage } from "../storage/index.js";
import { TsgService } from "../services/tsg/index.js";
import {
  getMissingParameters,
  prepareDiagnosticStep,
  prepareResolution,
} from "../services/tsg/executor.js";
import type { TsgOutput } from "../schemas/tsg.schema.js";

export async function handleTroubleshoot(args: string[]): Promise<void> {
  const action = args[0];
  if (!action || !["diagnose", "analyze", "suggest", "run"].includes(action)) {
    fatal("Usage: instructions <diagnose|analyze|suggest|run> [args]");
  }

  switch (action) {
    case "diagnose":
      return handleDiagnose(args.slice(1));
    case "analyze":
      return handleAnalyze(args.slice(1));
    case "suggest":
      return handleSuggest(args.slice(1));
    case "run":
      return handleRun(args.slice(1));
  }
}

export async function handleDiagnose(args: string[]): Promise<void> {
  const flags = parseFlags(args);
  if (!flags.symptoms) {
    fatal("Usage: instructions diagnose --symptoms='[\"symptom1\",\"symptom2\"]' [--category=...]");
  }

  const symptoms: string[] = JSON.parse(flags.symptoms);
  const storage = await getInstructionsStorage();
  const service = new TsgService(storage);

  const results = await service.search({
    symptoms,
    category: flags.category,
  });

  if (results.length === 0) {
    output({ matched: 0, tsgs: [], message: "No matching TSGs found for the reported symptoms." });
    return;
  }

  const topResults = results.slice(0, 5);
  output({
    symptoms,
    matched: results.length,
    tsgs: topResults.map((r) => {
      const tsg = r.tsg;
      const missing = getMissingParameters(tsg, {});
      return {
        id: tsg.id,
        title: tsg.title,
        score: r.score,
        matchedOn: r.matchedOn,
        category: tsg.category,
        missingParameters: missing,
        diagnosticSteps: tsg.diagnostics.slice(0, 3).map((d) => ({
          id: d.id,
          name: d.name,
          command: d.command?.template,
          manual: d.manual,
        })),
        resolutions: Object.keys(tsg.resolutions),
      };
    }),
  });
}

export async function handleAnalyze(args: string[]): Promise<void> {
  const flags = parseFlags(args);
  if (!flags.output) {
    fatal("Usage: instructions analyze --output=<diagnostic output> [--tsgId=...] [--stepId=...]");
  }

  const diagnosticOutput = flags.output;
  const storage = await getInstructionsStorage();

  interface PatternMatch {
    pattern: string;
    tsgId: string;
    rootCause: string;
    severity?: string;
  }

  const matches: PatternMatch[] = [];

  // TSG-specific analysis
  if (flags.tsgId) {
    const tsg = await storage.loadById(flags.tsgId);
    if (tsg) {
      const tsgMatches = analyzeWithTsg(diagnosticOutput, tsg, flags.stepId);
      matches.push(...tsgMatches);
    }
  }

  // Cross-TSG analysis
  const allTsgs = await storage.listAll();
  const crossMatches = analyzeAgainstAllTsgs(diagnosticOutput, allTsgs);
  matches.push(...crossMatches);

  // Deduplicate
  const seen = new Set<string>();
  const unique = matches.filter((m) => {
    const key = `${m.tsgId}:${m.rootCause}:${m.pattern}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });

  const rootCauses = [...new Set(unique.map((m) => m.rootCause).filter(Boolean))];

  output({
    matchCount: unique.length,
    matches: unique,
    rootCauses,
  });
}

export async function handleSuggest(args: string[]): Promise<void> {
  const flags = parseFlags(args);
  if (!flags.tsgId || !flags.rootCause) {
    fatal("Usage: instructions suggest --tsgId=<id> --rootCause=<cause> [--parameters='{...}']");
  }

  const storage = await getInstructionsStorage();
  const tsg = await storage.loadById(flags.tsgId);
  if (!tsg) fatal(`TSG "${flags.tsgId}" not found.`);

  const parameters = flags.parameters ? JSON.parse(flags.parameters) : {};
  const context = { parameters };

  try {
    const resolution = prepareResolution(tsg, flags.rootCause, context);
    output({
      tsgId: tsg.id,
      rootCause: flags.rootCause,
      resolution: {
        name: resolution.name,
        description: resolution.description,
        steps: resolution.steps.map((step, i) => ({
          ...step,
          resolvedCommand: resolution.resolvedSteps[i].command,
        })),
      },
      escalation: tsg.escalation,
    });
  } catch (err) {
    fatal(err instanceof Error ? err.message : String(err));
  }
}

// --- Analysis helpers ---

interface PatternMatch {
  pattern: string;
  tsgId: string;
  rootCause: string;
  severity?: string;
}

function analyzeWithTsg(
  diagnosticOutput: string,
  tsg: TsgOutput,
  stepId?: string,
): PatternMatch[] {
  const matches: PatternMatch[] = [];
  const outputLower = diagnosticOutput.toLowerCase();

  const stepsToCheck = stepId
    ? tsg.diagnostics.filter((d) => d.id === stepId)
    : tsg.diagnostics;

  for (const step of stepsToCheck) {
    if (!step.analysis?.lookFor) continue;

    for (const pattern of step.analysis.lookFor) {
      let matched = false;
      if (pattern.type === "regex") {
        try {
          matched = new RegExp(pattern.pattern, "i").test(diagnosticOutput);
        } catch {
          matched = outputLower.includes(pattern.pattern.toLowerCase());
        }
      } else {
        matched = outputLower.includes(pattern.pattern.toLowerCase());
      }

      if (matched && pattern.indicatesRootCause) {
        matches.push({
          pattern: pattern.pattern,
          tsgId: tsg.id,
          rootCause: pattern.indicatesRootCause,
          severity: pattern.severity,
        });
      }
    }
  }

  return matches;
}

function analyzeAgainstAllTsgs(
  diagnosticOutput: string,
  tsgs: TsgOutput[],
): PatternMatch[] {
  const matches: PatternMatch[] = [];
  const outputLower = diagnosticOutput.toLowerCase();

  for (const tsg of tsgs) {
    for (const err of tsg.relatedErrors) {
      if (outputLower.includes(err.toLowerCase())) {
        matches.push({
          pattern: err,
          tsgId: tsg.id,
          rootCause: Object.keys(tsg.resolutions)[0] ?? "unknown",
        });
      }
    }

    for (const step of tsg.diagnostics) {
      if (!step.analysis?.lookFor) continue;
      for (const pattern of step.analysis.lookFor) {
        let matched = false;
        if (pattern.type === "regex") {
          try {
            matched = new RegExp(pattern.pattern, "i").test(diagnosticOutput);
          } catch {
            matched = outputLower.includes(pattern.pattern.toLowerCase());
          }
        } else {
          matched = outputLower.includes(pattern.pattern.toLowerCase());
        }

        if (matched && pattern.indicatesRootCause) {
          matches.push({
            pattern: pattern.pattern,
            tsgId: tsg.id,
            rootCause: pattern.indicatesRootCause,
            severity: pattern.severity,
          });
        }
      }
    }
  }

  return matches;
}

export async function handleRun(args: string[]): Promise<void> {
  const flags = parseFlags(args);
  if (!flags.symptoms) {
    fatal("Usage: instructions run --symptoms='[\"symptom1\"]' [--category=...] [--output=<diagnostic output>] [--parameters='{...}']");
  }

  const symptoms: string[] = JSON.parse(flags.symptoms);
  const storage = await getInstructionsStorage();
  const service = new TsgService(storage);
  const parameters = flags.parameters ? JSON.parse(flags.parameters) : {};

  // Stage 1: Diagnose — find matching TSGs
  const searchResults = await service.search({
    symptoms,
    category: flags.category,
  });

  const diagnoseResult = {
    symptoms,
    matched: searchResults.length,
    topTsgs: searchResults.slice(0, 3).map((r) => ({
      id: r.tsg.id,
      title: r.tsg.title,
      score: r.score,
      matchedOn: r.matchedOn,
    })),
  };

  if (searchResults.length === 0) {
    output({
      stage: "diagnose",
      diagnose: diagnoseResult,
      message: "No matching TSGs found. Create a new TSG for these symptoms.",
    });
    return;
  }

  const topTsg = searchResults[0].tsg;
  const context = { parameters };

  // Stage 2: Prepare diagnostics — list all steps with resolved commands
  const missing = getMissingParameters(topTsg, parameters);
  const diagnosticSteps = topTsg.diagnostics.map((step) => {
    const result = prepareDiagnosticStep(topTsg, step.id, context);
    return result;
  });

  // Stage 3: Analyze — if diagnostic output provided, match patterns
  let analyzeResult: { matchCount: number; matches: PatternMatch[]; rootCauses: string[] } | undefined;
  if (flags.output) {
    const tsgMatches = analyzeWithTsg(flags.output, topTsg);
    const allTsgs = await storage.listAll();
    const crossMatches = analyzeAgainstAllTsgs(flags.output, allTsgs);
    const allMatches = [...tsgMatches, ...crossMatches];

    // Deduplicate
    const seen = new Set<string>();
    const unique = allMatches.filter((m) => {
      const key = `${m.tsgId}:${m.rootCause}:${m.pattern}`;
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });

    const rootCauses = [...new Set(unique.map((m) => m.rootCause).filter(Boolean))];
    analyzeResult = { matchCount: unique.length, matches: unique, rootCauses };
  }

  // Stage 4: Suggest — if root causes found, get resolution for the first one
  let suggestResult: Record<string, unknown> | undefined;
  if (analyzeResult && analyzeResult.rootCauses.length > 0) {
    const rootCause = analyzeResult.rootCauses[0];
    try {
      const resolution = prepareResolution(topTsg, rootCause, context);
      suggestResult = {
        tsgId: topTsg.id,
        rootCause,
        resolution: {
          name: resolution.name,
          description: resolution.description,
          steps: resolution.steps.map((step, i) => ({
            ...step,
            resolvedCommand: resolution.resolvedSteps[i].command,
          })),
        },
      };
    } catch {
      // Resolution not found for this root cause — not fatal
    }
  }

  const result: Record<string, unknown> = {
    tsgId: topTsg.id,
    tsgTitle: topTsg.title,
    diagnose: diagnoseResult,
    diagnosticSteps,
    missingParameters: missing,
  };
  if (analyzeResult) result.analyze = analyzeResult;
  if (suggestResult) result.suggest = suggestResult;
  if (!flags.output && !suggestResult) {
    result.nextStep = "Run the diagnostic commands above, then re-run with --output=<result> to analyze";
  }

  output(result);
}
