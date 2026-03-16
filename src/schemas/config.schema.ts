import { z } from "zod/v4";

export const AuthConfigSchema = z.object({
  type: z.enum(["pat", "azure-ad"]),
  patEnvVar: z.string().optional().default("ADO_PAT"),
});

export const AzureDevOpsConfigSchema = z.object({
  organization: z.string().url(),
  project: z.string().min(1),
  auth: AuthConfigSchema,
});

const StorageConfigInner = z.object({
  basePath: z.string().default("./.github"),
  workItemsPath: z.string().default("workitems"),
  instructionsPath: z.string().default("instructions"),
});

/** Backward compat: remap old `tsgPath` field to `instructionsPath` before parsing. */
export const StorageConfigSchema = z.preprocess((input) => {
  if (input && typeof input === "object" && !Array.isArray(input)) {
    const obj = input as Record<string, unknown>;
    if ("tsgPath" in obj && !("instructionsPath" in obj)) {
      const { tsgPath, ...rest } = obj;
      return { ...rest, instructionsPath: tsgPath };
    }
  }
  return input;
}, StorageConfigInner);

export const SyncConfigSchema = z.object({
  autoSync: z.boolean().default(false),
  pullOnStartup: z.boolean().default(true),
  defaultQuery: z.string().optional(),
  conflictResolution: z.enum(["local-wins", "remote-wins", "ask"]).default("ask"),
});

export const WorkItemTypeDefaultsSchema = z.object({
  customFields: z.record(z.string(), z.unknown()).optional(),
});

export const AdoConfigSchema = z.object({
  version: z.string().default("1.0"),
  azure_devops: AzureDevOpsConfigSchema,
  storage: StorageConfigSchema.default({
    basePath: "./.github",
    workItemsPath: "workitems",
    instructionsPath: "instructions",
  }),
  sync: SyncConfigSchema.default({
    autoSync: false,
    pullOnStartup: true,
    conflictResolution: "ask",
  }),
  defaults: z.record(z.string(), WorkItemTypeDefaultsSchema).optional(),
});

export type AdoConfigInput = z.input<typeof AdoConfigSchema>;
export type AdoConfigOutput = z.output<typeof AdoConfigSchema>;
