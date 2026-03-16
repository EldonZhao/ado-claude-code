import { z } from "zod/v4";

export const WorkItemTypeSchema = z.string().min(1);

export const LocalWorkItemSchema = z.object({
  id: z.number().int().positive(),
  rev: z.number().int().nonnegative(),
  url: z.string(),
  syncedAt: z.string(),
  type: WorkItemTypeSchema,
  title: z.string(),
  state: z.string(),
  assignedTo: z.string().optional(),
  areaPath: z.string().optional(),
  iterationPath: z.string().optional(),
  priority: z.number().int().optional(),
  storyPoints: z.number().optional(),
  parent: z.number().int().optional(),
  children: z.array(z.number().int()).optional(),
  description: z.string().optional(),
  latestComment: z.string().optional(),
  customFields: z.record(z.string(), z.unknown()).optional(),
});

export type LocalWorkItemInput = z.input<typeof LocalWorkItemSchema>;
export type LocalWorkItemOutput = z.output<typeof LocalWorkItemSchema>;
