import * as fs from "node:fs/promises";
import * as path from "node:path";
import { stringify as stringifyYaml, parse as parseYaml } from "yaml";
import {
  LocalWorkItemSchema,
  type LocalWorkItemOutput,
} from "../schemas/work-item.schema.js";
import type { WorkItemType } from "../types/index.js";
import { WorkItemError } from "../utils/errors.js";
import { logger } from "../utils/logger.js";

const TYPE_TO_DIR: Record<WorkItemType, string> = {
  Epic: "epics",
  Feature: "features",
  "User Story": "user-stories",
  Task: "tasks",
  Bug: "bugs",
};

export class WorkItemStorage {
  constructor(private basePath: string) {}

  private getDir(type: WorkItemType): string {
    return path.join(this.basePath, TYPE_TO_DIR[type]);
  }

  private getFilePath(type: WorkItemType, id: number): string {
    return path.join(this.getDir(type), `${id}.yaml`);
  }

  async ensureDirectories(): Promise<void> {
    for (const dir of Object.values(TYPE_TO_DIR)) {
      await fs.mkdir(path.join(this.basePath, dir), { recursive: true });
    }
  }

  async save(item: LocalWorkItemOutput): Promise<string> {
    const filePath = this.getFilePath(item.type, item.id);
    await fs.mkdir(path.dirname(filePath), { recursive: true });
    const yamlStr = stringifyYaml(item, { lineWidth: 120 });
    await fs.writeFile(filePath, yamlStr, "utf-8");
    logger.debug({ id: item.id, path: filePath }, "Saved work item");
    return filePath;
  }

  async load(type: WorkItemType, id: number): Promise<LocalWorkItemOutput> {
    const filePath = this.getFilePath(type, id);
    let raw: string;
    try {
      raw = await fs.readFile(filePath, "utf-8");
    } catch {
      throw new WorkItemError(`Work item file not found: ${filePath}`);
    }

    const parsed = parseYaml(raw);
    const result = LocalWorkItemSchema.safeParse(parsed);
    if (!result.success) {
      throw new WorkItemError(
        `Invalid work item file ${filePath}: ${JSON.stringify(result.error.issues)}`,
      );
    }
    return result.data;
  }

  async loadById(id: number): Promise<LocalWorkItemOutput | null> {
    for (const type of Object.keys(TYPE_TO_DIR) as WorkItemType[]) {
      const filePath = this.getFilePath(type, id);
      try {
        await fs.access(filePath);
        return await this.load(type, id);
      } catch {
        continue;
      }
    }
    return null;
  }

  async delete(type: WorkItemType, id: number): Promise<void> {
    const filePath = this.getFilePath(type, id);
    try {
      await fs.unlink(filePath);
      logger.debug({ id, path: filePath }, "Deleted work item file");
    } catch {
      // File doesn't exist, that's fine
    }
  }

  async listByType(type: WorkItemType): Promise<LocalWorkItemOutput[]> {
    const dir = this.getDir(type);
    let entries: string[];
    try {
      entries = await fs.readdir(dir);
    } catch {
      return [];
    }

    const items: LocalWorkItemOutput[] = [];
    for (const entry of entries) {
      if (!entry.endsWith(".yaml")) continue;
      const id = parseInt(path.basename(entry, ".yaml"), 10);
      if (isNaN(id)) continue;
      try {
        items.push(await this.load(type, id));
      } catch (err) {
        logger.warn({ file: entry, error: err }, "Skipping invalid work item file");
      }
    }
    return items;
  }

  async listAll(filters?: {
    type?: WorkItemType;
    state?: string;
    assignedTo?: string;
  }): Promise<LocalWorkItemOutput[]> {
    const types = filters?.type
      ? [filters.type]
      : (Object.keys(TYPE_TO_DIR) as WorkItemType[]);

    const allItems: LocalWorkItemOutput[] = [];
    for (const type of types) {
      const items = await this.listByType(type);
      allItems.push(...items);
    }

    return allItems.filter((item) => {
      if (filters?.state && item.state !== filters.state) return false;
      if (filters?.assignedTo && item.assignedTo !== filters.assignedTo)
        return false;
      return true;
    });
  }
}
