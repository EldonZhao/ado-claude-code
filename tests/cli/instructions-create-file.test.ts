import { describe, it, expect, vi, beforeEach } from "vitest";
import * as fs from "node:fs/promises";
import * as path from "node:path";
import { tsgToMarkdown } from "../../src/services/tsg/markdown.js";
import { TsgSchema } from "../../src/schemas/tsg.schema.js";

// Mock storage
const mockStorage = {
  loadById: vi.fn(),
  save: vi.fn().mockResolvedValue("/mock/path.md"),
  listAll: vi.fn().mockResolvedValue([]),
  listByCategory: vi.fn().mockResolvedValue([]),
};

vi.mock("../../src/storage/index.js", () => ({
  getInstructionsStorage: async () => mockStorage,
  getTsgStorage: async () => mockStorage,
}));

// Capture output
let captured: unknown;
vi.mock("../../src/cli/helpers.js", () => ({
  output: (data: unknown) => {
    captured = data;
  },
  fatal: (msg: string) => {
    throw new Error(msg);
  },
  checkHelp: vi.fn(),
  parseFlags: (args: string[]) => {
    const flags: Record<string, string> = {};
    for (const arg of args) {
      if (arg.startsWith("--")) {
        const eq = arg.indexOf("=");
        if (eq !== -1) {
          flags[arg.slice(2, eq)] = arg.slice(eq + 1);
        } else {
          flags[arg.slice(2)] = "true";
        }
      }
    }
    return flags;
  },
}));

// Mock fs.readFile for file imports
vi.mock("node:fs/promises", async () => {
  const actual = await vi.importActual<typeof import("node:fs/promises")>(
    "node:fs/promises",
  );
  return {
    ...actual,
    readFile: vi.fn(),
  };
});

const { handleInstructions } = await import("../../src/cli/instructions.js");

describe("tsg create --file", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    captured = undefined;
    mockStorage.save.mockResolvedValue("/mock/path.md");
    mockStorage.listByCategory.mockResolvedValue([]);
  });

  it("imports TSG-format markdown file (with frontmatter)", async () => {
    const tsg = TsgSchema.parse({
      id: "tsg-deploy-001",
      title: "Pod OOM",
      category: "deployment",
      tags: ["oom"],
      symptoms: ["pod restarting"],
    });
    const mdContent = tsgToMarkdown(tsg);

    vi.mocked(fs.readFile).mockResolvedValue(mdContent);

    await handleInstructions(["create", "--file=./test.md"]);

    expect(mockStorage.save).toHaveBeenCalledTimes(1);
    const saved = mockStorage.save.mock.calls[0][0];
    expect(saved.title).toBe("Pod OOM");
    expect(saved.category).toBe("deployment");
    expect(saved.tags).toEqual(["oom"]);
    // ID is regenerated
    expect(saved.id).toBe("tsg-deployment-001");

    const result = captured as Record<string, unknown>;
    expect(result.id).toBe("tsg-deployment-001");
    expect(result.importedFrom).toBe("./test.md");
  });

  it("imports plain text file with --title and --category", async () => {
    const plainText = "Step 1: Check the pod status\nStep 2: Review logs";
    vi.mocked(fs.readFile).mockResolvedValue(plainText);

    await handleInstructions([
      "create",
      "--file=./runbook.txt",
      "--title=My Runbook",
      "--category=ops",
    ]);

    expect(mockStorage.save).toHaveBeenCalledTimes(1);
    const saved = mockStorage.save.mock.calls[0][0];
    expect(saved.title).toBe("My Runbook");
    expect(saved.category).toBe("ops");
    expect(saved.diagnostics).toHaveLength(1);
    expect(saved.diagnostics[0].manual).toBe(true);
    expect(saved.diagnostics[0].guidance).toBe(plainText.trim());
  });

  it("errors on plain text without --title", async () => {
    vi.mocked(fs.readFile).mockResolvedValue("some plain text");

    await expect(
      handleInstructions(["create", "--file=./runbook.txt", "--category=ops"]),
    ).rejects.toThrow("requires --title and --category");
  });

  it("errors on plain text without --category", async () => {
    vi.mocked(fs.readFile).mockResolvedValue("some plain text");

    await expect(
      handleInstructions(["create", "--file=./runbook.txt", "--title=My Runbook"]),
    ).rejects.toThrow("requires --title and --category");
  });

  it("allows flag overrides on imported markdown", async () => {
    const tsg = TsgSchema.parse({
      id: "tsg-orig-001",
      title: "Original Title",
      category: "deployment",
      author: "OrigAuthor",
      tags: ["orig"],
    });
    const mdContent = tsgToMarkdown(tsg);

    vi.mocked(fs.readFile).mockResolvedValue(mdContent);

    await handleInstructions([
      "create",
      "--file=./test.md",
      "--title=Overridden Title",
      "--category=networking",
      "--author=NewAuthor",
    ]);

    const saved = mockStorage.save.mock.calls[0][0];
    expect(saved.title).toBe("Overridden Title");
    expect(saved.category).toBe("networking");
    expect(saved.author).toBe("NewAuthor");
    // ID uses overridden category
    expect(saved.id).toBe("tsg-networking-001");
  });

  it("errors when file not found", async () => {
    vi.mocked(fs.readFile).mockRejectedValue(new Error("ENOENT"));

    await expect(
      handleInstructions(["create", "--file=./nonexistent.md"]),
    ).rejects.toThrow("File not found");
  });
});
