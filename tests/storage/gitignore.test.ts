import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import * as fs from "node:fs/promises";
import * as path from "node:path";
import * as os from "node:os";
import { ensureProjectGitignore, clearConfigCache, setProjectDir } from "../../src/storage/config.js";

describe("ensureProjectGitignore", () => {
  let tmpDir: string;

  beforeEach(async () => {
    tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), "ado-gitignore-"));
    // ensureProjectGitignore derives root from config path, which uses projectDir
    setProjectDir(tmpDir);
    clearConfigCache();
  });

  afterEach(async () => {
    clearConfigCache();
    await fs.rm(tmpDir, { recursive: true, force: true });
  });

  it("creates .gitignore with correct entries when none exists", async () => {
    await ensureProjectGitignore();

    const content = await fs.readFile(path.join(tmpDir, ".gitignore"), "utf-8");
    expect(content).toContain("# ADO plugin");
    expect(content).toContain(".claude/.ado-config.yaml");
    expect(content).toContain(".claude/.ado-token-cache.json");
    expect(content).toContain(".claude/ado/workitems/");
    expect(content).toContain(".claude/ado/.ado-sync/");
  });

  it("does not add .claude/ado/tsgs/ to .gitignore", async () => {
    await ensureProjectGitignore();

    const content = await fs.readFile(path.join(tmpDir, ".gitignore"), "utf-8");
    expect(content).not.toContain("tsgs");
  });

  it("creates tsgs directory if missing", async () => {
    await ensureProjectGitignore();

    const tsgDir = path.join(tmpDir, ".claude", "ado", "tsgs");
    const stat = await fs.stat(tsgDir);
    expect(stat.isDirectory()).toBe(true);
  });

  it("appends missing entries to existing .gitignore without duplicating", async () => {
    const existing = "node_modules/\n.env\n";
    await fs.writeFile(path.join(tmpDir, ".gitignore"), existing, "utf-8");

    await ensureProjectGitignore();

    const content = await fs.readFile(path.join(tmpDir, ".gitignore"), "utf-8");
    expect(content).toContain("node_modules/");
    expect(content).toContain(".env");
    expect(content).toContain(".claude/ado/workitems/");
    expect(content).toContain("# ADO plugin");
  });

  it("is idempotent — running twice makes no additional changes", async () => {
    await ensureProjectGitignore();
    const first = await fs.readFile(path.join(tmpDir, ".gitignore"), "utf-8");

    await ensureProjectGitignore();
    const second = await fs.readFile(path.join(tmpDir, ".gitignore"), "utf-8");

    expect(second).toBe(first);
  });

  it("preserves existing .gitignore content", async () => {
    const existing = "# My project\nnode_modules/\ndist/\n";
    await fs.writeFile(path.join(tmpDir, ".gitignore"), existing, "utf-8");

    await ensureProjectGitignore();

    const content = await fs.readFile(path.join(tmpDir, ".gitignore"), "utf-8");
    expect(content.startsWith("# My project\nnode_modules/\ndist/\n")).toBe(true);
  });

  it("handles .gitignore without trailing newline", async () => {
    const existing = "node_modules/";
    await fs.writeFile(path.join(tmpDir, ".gitignore"), existing, "utf-8");

    await ensureProjectGitignore();

    const content = await fs.readFile(path.join(tmpDir, ".gitignore"), "utf-8");
    // Should add a newline before our entries
    expect(content).toMatch(/node_modules\/\n/);
    expect(content).toContain(".claude/ado/workitems/");
  });

  it("only adds missing entries when some already exist", async () => {
    const existing = "# ADO plugin — local-only files (do not commit)\n.claude/.ado-config.yaml\n";
    await fs.writeFile(path.join(tmpDir, ".gitignore"), existing, "utf-8");

    await ensureProjectGitignore();

    const content = await fs.readFile(path.join(tmpDir, ".gitignore"), "utf-8");
    // Should not duplicate the comment or .ado-config.yaml
    const configMatches = content.match(/\.claude\/\.ado-config\.yaml/g);
    expect(configMatches).toHaveLength(1);
    // Should add the missing ones
    expect(content).toContain(".claude/.ado-token-cache.json");
    expect(content).toContain(".claude/ado/workitems/");
    expect(content).toContain(".claude/ado/.ado-sync/");
  });
});
