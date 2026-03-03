import { z } from "zod/v4";

export const SyncItemStateSchema = z.object({
  localPath: z.string(),
  adoRev: z.number().int(),
  localHash: z.string(),
  lastSyncedAt: z.string(),
  syncStatus: z.enum(["synced", "localModified", "remoteModified", "conflict"]),
});

export const SyncStateSchema = z.object({
  version: z.string().default("1.0"),
  lastFullSync: z.string().nullable().default(null),
  project: z.string(),
  organization: z.string(),
  workItems: z.record(z.string(), SyncItemStateSchema).default({}),
});

export type SyncItemState = z.output<typeof SyncItemStateSchema>;
export type SyncStateOutput = z.output<typeof SyncStateSchema>;
