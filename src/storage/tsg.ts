import * as fs from "node:fs/promises";
import * as path from "node:path";
import { stringify as stringifyYaml, parse as parseYaml } from "yaml";
import { TsgSchema, type TsgOutput } from "../schemas/tsg.schema.js";
import { TsgError } from "../utils/errors.js";
import { logger } from "../utils/logger.js";

export class TsgStorage {
  constructor(private basePath: string) {}

  private getCategoryDir(category: string): string {
    return path.join(this.basePath, category);
  }

  private getFilePath(category: string, slug: string): string {
    return path.join(this.getCategoryDir(category), `${slug}.yaml`);
  }

  private slugify(title: string): string {
    return title
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "");
  }

  async ensureDirectories(categories: string[]): Promise<void> {
    for (const cat of categories) {
      await fs.mkdir(this.getCategoryDir(cat), { recursive: true });
    }
  }

  async save(tsg: TsgOutput): Promise<string> {
    const slug = this.slugify(tsg.title);
    const filePath = this.getFilePath(tsg.category, slug);
    await fs.mkdir(path.dirname(filePath), { recursive: true });
    const yamlStr = stringifyYaml(tsg, { lineWidth: 120 });
    await fs.writeFile(filePath, yamlStr, "utf-8");
    logger.debug({ id: tsg.id, path: filePath }, "Saved TSG");
    return filePath;
  }

  async loadByFile(filePath: string): Promise<TsgOutput> {
    let raw: string;
    try {
      raw = await fs.readFile(filePath, "utf-8");
    } catch {
      throw new TsgError(`TSG file not found: ${filePath}`);
    }

    const parsed = parseYaml(raw);
    const result = TsgSchema.safeParse(parsed);
    if (!result.success) {
      throw new TsgError(
        `Invalid TSG file ${filePath}: ${JSON.stringify(result.error.issues)}`,
      );
    }
    return result.data;
  }

  async loadById(id: string): Promise<TsgOutput | null> {
    const all = await this.listAll();
    return all.find((t) => t.id === id) ?? null;
  }

  async delete(category: string, slug: string): Promise<void> {
    const filePath = this.getFilePath(category, slug);
    try {
      await fs.unlink(filePath);
      logger.debug({ path: filePath }, "Deleted TSG file");
    } catch {
      // File doesn't exist
    }
  }

  async listByCategory(category: string): Promise<TsgOutput[]> {
    const dir = this.getCategoryDir(category);
    let entries: string[];
    try {
      entries = await fs.readdir(dir);
    } catch {
      return [];
    }

    const tsgs: TsgOutput[] = [];
    for (const entry of entries) {
      if (!entry.endsWith(".yaml")) continue;
      try {
        tsgs.push(await this.loadByFile(path.join(dir, entry)));
      } catch (err) {
        logger.warn({ file: entry, error: err }, "Skipping invalid TSG file");
      }
    }
    return tsgs;
  }

  async listAll(): Promise<TsgOutput[]> {
    let entries: string[];
    try {
      entries = await fs.readdir(this.basePath, { recursive: false } as never);
    } catch {
      return [];
    }

    const tsgs: TsgOutput[] = [];
    for (const entry of entries) {
      const fullPath = path.join(this.basePath, entry);
      let stat;
      try {
        stat = await fs.stat(fullPath);
      } catch {
        continue;
      }
      if (stat.isDirectory()) {
        const categoryTsgs = await this.listByCategory(entry);
        tsgs.push(...categoryTsgs);
      }
    }
    return tsgs;
  }

  async getCategories(): Promise<string[]> {
    let entries: string[];
    try {
      entries = await fs.readdir(this.basePath);
    } catch {
      return [];
    }

    const categories: string[] = [];
    for (const entry of entries) {
      const fullPath = path.join(this.basePath, entry);
      try {
        const stat = await fs.stat(fullPath);
        if (stat.isDirectory()) categories.push(entry);
      } catch {
        continue;
      }
    }
    return categories;
  }
}
