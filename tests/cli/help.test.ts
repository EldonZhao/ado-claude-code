import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { showHelp, checkHelp } from "../../src/cli/helpers.js";
import { HELP, type HelpEntry } from "../../src/cli/help.js";

// Mock process.exit to prevent actual exit
const mockExit = vi.spyOn(process, "exit").mockImplementation(((code?: number) => {
  throw new Error(`EXIT_${code ?? 0}`);
}) as never);

// Capture stdout writes
let stdoutOutput = "";
const mockStdout = vi.spyOn(process.stdout, "write").mockImplementation(((chunk: string) => {
  stdoutOutput += chunk;
  return true;
}) as never);

// Suppress stderr (from fatal())
vi.spyOn(process.stderr, "write").mockImplementation((() => true) as never);

beforeEach(() => {
  stdoutOutput = "";
  mockExit.mockClear();
  mockStdout.mockClear();
});

describe("showHelp", () => {
  it("formats usage and description", () => {
    const entry: HelpEntry = {
      usage: "test <action>",
      description: "A test command",
    };

    expect(() => showHelp(entry)).toThrow("EXIT_0");
    expect(stdoutOutput).toContain("Usage: test <action>");
    expect(stdoutOutput).toContain("A test command");
  });

  it("formats flags when present", () => {
    const entry: HelpEntry = {
      usage: "test <action>",
      description: "A test command",
      flags: [
        { name: "--foo", description: "The foo flag" },
        { name: "--bar-long", description: "The bar flag" },
      ],
    };

    expect(() => showHelp(entry)).toThrow("EXIT_0");
    expect(stdoutOutput).toContain("Flags:");
    expect(stdoutOutput).toContain("--foo");
    expect(stdoutOutput).toContain("The foo flag");
    expect(stdoutOutput).toContain("--bar-long");
    expect(stdoutOutput).toContain("The bar flag");
  });

  it("omits flags section when undefined", () => {
    const entry: HelpEntry = {
      usage: "test <action>",
      description: "A test command",
    };

    expect(() => showHelp(entry)).toThrow("EXIT_0");
    expect(stdoutOutput).not.toContain("Flags:");
  });

  it("formats examples when present", () => {
    const entry: HelpEntry = {
      usage: "test <action>",
      description: "A test command",
      examples: ["test foo", "test bar --baz"],
    };

    expect(() => showHelp(entry)).toThrow("EXIT_0");
    expect(stdoutOutput).toContain("Examples:");
    expect(stdoutOutput).toContain("test foo");
    expect(stdoutOutput).toContain("test bar --baz");
  });

  it("exits with code 0", () => {
    const entry: HelpEntry = {
      usage: "test",
      description: "desc",
    };

    expect(() => showHelp(entry)).toThrow("EXIT_0");
    expect(mockExit).toHaveBeenCalledWith(0);
  });
});

describe("checkHelp", () => {
  it("calls showHelp when --help is in args", () => {
    expect(() => checkHelp(["--help"], "workitems")).toThrow("EXIT_0");
    expect(stdoutOutput).toContain("Usage:");
  });

  it("calls showHelp when -h is in args", () => {
    expect(() => checkHelp(["-h"], "workitems")).toThrow("EXIT_0");
    expect(stdoutOutput).toContain("Usage:");
  });

  it("is no-op when no help flag", () => {
    // Should not throw
    checkHelp(["--foo"], "workitems");
    expect(mockExit).not.toHaveBeenCalled();
  });

  it("falls through when no entry exists for unknown domain", () => {
    // Should not throw — unknown domain has no entry
    checkHelp(["--help"], "nonexistent-domain");
    expect(mockExit).not.toHaveBeenCalled();
  });

  it("shows domain help when action is not provided", () => {
    expect(() => checkHelp(["--help"], "workitems")).toThrow("EXIT_0");
    expect(stdoutOutput).toContain("workitems <action>");
  });

  it("shows action help when action is provided", () => {
    expect(() => checkHelp(["--help"], "workitems", "get")).toThrow("EXIT_0");
    expect(stdoutOutput).toContain("workitems get");
  });

  it("detects --help regardless of position in args", () => {
    expect(() => checkHelp(["--expand=all", "--help"], "workitems", "get")).toThrow("EXIT_0");
    expect(stdoutOutput).toContain("workitems get");
  });
});

describe("HELP map completeness", () => {
  it("has entries for all expected domains", () => {
    expect(Object.keys(HELP)).toEqual(
      expect.arrayContaining(["workitems", "setup", "sync", "clear", "instructions"]),
    );
  });

  it("each domain has a _domain entry", () => {
    for (const domain of Object.keys(HELP)) {
      expect(HELP[domain]._domain).toBeDefined();
      expect(HELP[domain]._domain.usage).toBeTruthy();
      expect(HELP[domain]._domain.description).toBeTruthy();
    }
  });

  it("workitems has all action entries", () => {
    const actions = ["get", "list", "create", "update", "query", "plan", "workitem-plan", "summary"];
    for (const action of actions) {
      expect(HELP.workitems[action]).toBeDefined();
    }
  });

  it("setup has all action entries", () => {
    const actions = ["init", "validate", "show", "login", "logout"];
    for (const action of actions) {
      expect(HELP.setup[action]).toBeDefined();
    }
  });

  it("sync has all action entries", () => {
    const actions = ["pull", "push", "full"];
    for (const action of actions) {
      expect(HELP.sync[action]).toBeDefined();
    }
  });

  it("instructions has all action entries", () => {
    const actions = ["create", "get", "update", "list", "search", "execute", "score", "diagnose", "analyze", "suggest", "run", "ts"];
    for (const action of actions) {
      expect(HELP.instructions[action]).toBeDefined();
    }
  });
});
