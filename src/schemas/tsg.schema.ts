import { z } from "zod/v4";

// --- Diagnostic step schema ---

export const CommandTemplateSchema = z.object({
  template: z.string().describe("Command template with {{param}} placeholders"),
  parameters: z
    .array(
      z.object({
        name: z.string(),
        required: z.boolean().default(true),
        default: z.string().optional(),
        description: z.string().optional(),
      }),
    )
    .optional(),
});

export const AnalysisPatternSchema = z.object({
  pattern: z.string().describe("Regex or literal string to match"),
  type: z.enum(["literal", "regex"]).default("literal"),
  indicatesRootCause: z.string().optional().describe("Root cause key if matched"),
  severity: z.enum(["low", "medium", "high", "critical"]).optional(),
  description: z.string().optional(),
});

export const DiagnosticStepSchema = z.object({
  id: z.string(),
  name: z.string(),
  description: z.string().optional(),
  command: CommandTemplateSchema.optional(),
  manual: z.boolean().default(false).describe("Whether this step requires manual action"),
  guidance: z.string().optional().describe("Instructions for manual steps"),
  analysis: z
    .object({
      lookFor: z.array(AnalysisPatternSchema).optional(),
    })
    .optional(),
  expectedOutput: z
    .object({
      success: z.object({ pattern: z.string() }).optional(),
      failure: z.object({ patterns: z.array(z.string()) }).optional(),
    })
    .optional(),
});

// --- Resolution step schema ---

export const ResolutionStepSchema = z.object({
  id: z.string(),
  action: z.string(),
  description: z.string().optional(),
  command: z.string().optional().describe("Command to run (with {{param}} placeholders)"),
  manual: z.boolean().default(false),
  guidance: z.string().optional(),
  successCriteria: z
    .object({ pattern: z.string() })
    .optional(),
});

export const ResolutionSchema = z.object({
  name: z.string(),
  description: z.string().optional(),
  steps: z.array(ResolutionStepSchema),
});

// --- Escalation schema ---

export const EscalationSchema = z.object({
  timeout: z.string().optional().describe("Time before escalation (e.g., 30m)"),
  contacts: z
    .array(
      z.object({
        team: z.string(),
        channel: z.string().optional(),
        lookup: z.string().optional(),
      }),
    )
    .optional(),
});

// --- Main TSG schema ---

export const TsgSchema = z.object({
  id: z.string(),
  title: z.string(),
  version: z.string().default("1.0"),
  lastUpdated: z.string().optional(),
  author: z.string().optional(),
  category: z.string(),
  tags: z.array(z.string()).default([]),

  // AI matching
  symptoms: z.array(z.string()).default([]),
  relatedErrors: z.array(z.string()).default([]),

  // Scope
  applicability: z
    .object({
      services: z.array(z.string()).default(["*"]),
      environments: z.array(z.string()).default(["*"]),
      platforms: z.array(z.string()).default(["*"]),
    })
    .optional(),

  // Prerequisites
  prerequisites: z
    .object({
      tools: z
        .array(z.object({ name: z.string(), minVersion: z.string().optional() }))
        .optional(),
      permissions: z.array(z.string()).optional(),
      context: z.array(z.string()).optional().describe("Info the user must provide"),
    })
    .optional(),

  // Steps
  diagnostics: z.array(DiagnosticStepSchema).default([]),
  resolutions: z.record(z.string(), ResolutionSchema).default({}),

  // Escalation
  escalation: EscalationSchema.optional(),

  // Links
  related: z
    .object({
      tsgs: z.array(z.string()).optional(),
      docs: z
        .array(z.object({ title: z.string(), url: z.string() }))
        .optional(),
      runbooks: z.array(z.string()).optional(),
    })
    .optional(),
});

export type TsgInput = z.input<typeof TsgSchema>;
export type TsgOutput = z.output<typeof TsgSchema>;
export type DiagnosticStep = z.output<typeof DiagnosticStepSchema>;
export type ResolutionStep = z.output<typeof ResolutionStepSchema>;
export type Resolution = z.output<typeof ResolutionSchema>;
