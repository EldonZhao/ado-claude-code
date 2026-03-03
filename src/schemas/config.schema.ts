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

export const StorageConfigSchema = z.object({
  basePath: z.string().default("./data"),
  workItemsPath: z.string().default("work-items"),
  tsgPath: z.string().default("tsg"),
});

export const SyncConfigSchema = z.object({
  autoSync: z.boolean().default(false),
  pullOnStartup: z.boolean().default(true),
  defaultQuery: z.string().optional(),
  conflictResolution: z.enum(["local-wins", "remote-wins", "ask"]).default("ask"),
});

export const AdoConfigSchema = z.object({
  version: z.string().default("1.0"),
  azure_devops: AzureDevOpsConfigSchema,
  storage: StorageConfigSchema.default({
    basePath: "./data",
    workItemsPath: "work-items",
    tsgPath: "tsg",
  }),
  sync: SyncConfigSchema.default({
    autoSync: false,
    pullOnStartup: true,
    conflictResolution: "ask",
  }),
});

export type AdoConfigInput = z.input<typeof AdoConfigSchema>;
export type AdoConfigOutput = z.output<typeof AdoConfigSchema>;
