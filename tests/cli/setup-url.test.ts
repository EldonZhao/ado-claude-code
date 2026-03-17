import { describe, it, expect, vi, beforeEach } from "vitest";

// ---------- Mocks ----------

const mockOutput = vi.fn();
const mockFatal = vi.fn((msg: string) => { throw new Error(msg); });

vi.mock("../../src/cli/helpers.js", () => ({
  output: (...args: unknown[]) => mockOutput(...args),
  fatal: (msg: string) => mockFatal(msg),
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

vi.mock("../../src/storage/config.js", () => ({
  saveConfig: vi.fn(),
  loadConfig: vi.fn(),
  clearConfigCache: vi.fn(),
  resolveStoragePath: vi.fn((p: string) => p),
  ensureProjectGitignore: vi.fn(),
}));

vi.mock("../../src/services/ado/auth.js", () => ({
  getCredentials: vi.fn(),
  clearTokenCache: vi.fn(),
}));

vi.mock("../../src/schemas/config.schema.js", () => ({
  AdoConfigSchema: {
    parse: vi.fn((v: unknown) => v),
  },
}));

vi.mock("node:fs/promises", () => ({
  mkdir: vi.fn(),
}));

// ---------- Import after mocks ----------

const { parseAdoUrl, handleSetup } = await import("../../src/cli/setup.js");

// ---------- Tests ----------

describe("parseAdoUrl", () => {
  beforeEach(() => {
    mockFatal.mockClear();
  });

  describe("dev.azure.com URLs", () => {
    it("extracts organization and project", () => {
      const result = parseAdoUrl("https://dev.azure.com/myorg/MyProject");
      expect(result).toEqual({
        organization: "https://dev.azure.com/myorg",
        project: "MyProject",
      });
    });

    it("extracts org only when no project segment", () => {
      const result = parseAdoUrl("https://dev.azure.com/myorg");
      expect(result).toEqual({
        organization: "https://dev.azure.com/myorg",
        project: undefined,
      });
    });

    it("strips _git suffix and extra path segments", () => {
      const result = parseAdoUrl("https://dev.azure.com/myorg/MyProject/_git/repo");
      expect(result).toEqual({
        organization: "https://dev.azure.com/myorg",
        project: "MyProject",
      });
    });

    it("fatal on dev.azure.com with no org", () => {
      expect(() => parseAdoUrl("https://dev.azure.com")).toThrow("No organization found");
    });
  });

  describe("visualstudio.com URLs", () => {
    it("extracts organization and project", () => {
      const result = parseAdoUrl("https://myorg.visualstudio.com/MyProject");
      expect(result).toEqual({
        organization: "https://myorg.visualstudio.com",
        project: "MyProject",
      });
    });

    it("extracts org only when no project segment", () => {
      const result = parseAdoUrl("https://myorg.visualstudio.com");
      expect(result).toEqual({
        organization: "https://myorg.visualstudio.com",
        project: undefined,
      });
    });

    it("strips _git suffix and extra path segments", () => {
      const result = parseAdoUrl("https://myorg.visualstudio.com/MyProject/_git/repo");
      expect(result).toEqual({
        organization: "https://myorg.visualstudio.com",
        project: "MyProject",
      });
    });
  });

  describe("error cases", () => {
    it("fatal on invalid URL", () => {
      expect(() => parseAdoUrl("not-a-url")).toThrow("Invalid URL");
    });

    it("fatal on unrecognized hostname", () => {
      expect(() => parseAdoUrl("https://github.com/myorg/repo")).toThrow("Unrecognized Azure DevOps URL format");
    });
  });
});

describe("handleInit with --url", () => {
  beforeEach(() => {
    mockOutput.mockClear();
    mockFatal.mockClear();
  });

  it("parses --url and initializes config", async () => {
    await handleSetup(["init", "--url=https://dev.azure.com/myorg/MyProject"]);
    expect(mockOutput).toHaveBeenCalledWith(
      expect.objectContaining({
        status: "ok",
        organization: "https://dev.azure.com/myorg",
        project: "MyProject",
      }),
    );
  });

  it("last URL wins with comma-separated --url", async () => {
    await handleSetup([
      "init",
      "--url=https://dev.azure.com/first/ProjA,https://dev.azure.com/second/ProjB",
    ]);
    expect(mockOutput).toHaveBeenCalledWith(
      expect.objectContaining({
        status: "ok",
        organization: "https://dev.azure.com/second",
        project: "ProjB",
      }),
    );
  });

  it("--url overrides --organization and --project", async () => {
    await handleSetup([
      "init",
      "--organization=https://dev.azure.com/old",
      "--project=OldProject",
      "--url=https://dev.azure.com/new/NewProject",
    ]);
    expect(mockOutput).toHaveBeenCalledWith(
      expect.objectContaining({
        organization: "https://dev.azure.com/new",
        project: "NewProject",
      }),
    );
  });

  it("--url with no project falls back to --project flag", async () => {
    await handleSetup([
      "init",
      "--url=https://dev.azure.com/myorg",
      "--project=FallbackProject",
    ]);
    expect(mockOutput).toHaveBeenCalledWith(
      expect.objectContaining({
        organization: "https://dev.azure.com/myorg",
        project: "FallbackProject",
      }),
    );
  });

  it("fatal when --url has no project and no --project flag", async () => {
    await expect(
      handleSetup(["init", "--url=https://dev.azure.com/myorg"]),
    ).rejects.toThrow("Usage:");
  });

  it("--organization and --project still work without --url", async () => {
    await handleSetup([
      "init",
      "--organization=https://dev.azure.com/myorg",
      "--project=MyProject",
    ]);
    expect(mockOutput).toHaveBeenCalledWith(
      expect.objectContaining({
        status: "ok",
        organization: "https://dev.azure.com/myorg",
        project: "MyProject",
      }),
    );
  });
});
