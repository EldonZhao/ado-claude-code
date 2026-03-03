import { describe, it, expect } from "vitest";
import {
  AdoClaudeCodeError,
  AuthenticationError,
  ConfigError,
  SyncError,
  WorkItemError,
  TsgError,
  formatError,
} from "../../src/utils/errors.js";

describe("Error classes", () => {
  it("AdoClaudeCodeError has correct properties", () => {
    const err = new AdoClaudeCodeError("test message", "TEST_CODE", {
      key: "val",
    });
    expect(err.message).toBe("test message");
    expect(err.code).toBe("TEST_CODE");
    expect(err.details).toEqual({ key: "val" });
    expect(err.name).toBe("AdoClaudeCodeError");
    expect(err).toBeInstanceOf(Error);
  });

  it("AuthenticationError has AUTH_ERROR code", () => {
    const err = new AuthenticationError("no creds");
    expect(err.code).toBe("AUTH_ERROR");
    expect(err.name).toBe("AuthenticationError");
    expect(err).toBeInstanceOf(AdoClaudeCodeError);
  });

  it("ConfigError has CONFIG_ERROR code", () => {
    const err = new ConfigError("bad config");
    expect(err.code).toBe("CONFIG_ERROR");
    expect(err.name).toBe("ConfigError");
  });

  it("SyncError has SYNC_ERROR code", () => {
    const err = new SyncError("sync failed");
    expect(err.code).toBe("SYNC_ERROR");
    expect(err.name).toBe("SyncError");
  });

  it("WorkItemError has WORK_ITEM_ERROR code", () => {
    const err = new WorkItemError("not found");
    expect(err.code).toBe("WORK_ITEM_ERROR");
    expect(err.name).toBe("WorkItemError");
  });

  it("TsgError has TSG_ERROR code", () => {
    const err = new TsgError("tsg missing");
    expect(err.code).toBe("TSG_ERROR");
    expect(err.name).toBe("TsgError");
  });
});

describe("formatError", () => {
  it("formats AdoClaudeCodeError with code", () => {
    const err = new WorkItemError("not found");
    expect(formatError(err)).toBe("[WORK_ITEM_ERROR] not found");
  });

  it("formats generic Error", () => {
    const err = new Error("generic");
    expect(formatError(err)).toBe("generic");
  });

  it("formats string", () => {
    expect(formatError("oops")).toBe("oops");
  });

  it("formats number", () => {
    expect(formatError(42)).toBe("42");
  });
});
