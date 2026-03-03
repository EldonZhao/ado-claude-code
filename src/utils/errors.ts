export class AdoClaudeCodeError extends Error {
  constructor(
    message: string,
    public readonly code: string,
    public readonly details?: unknown,
  ) {
    super(message);
    this.name = "AdoClaudeCodeError";
  }
}

export class AuthenticationError extends AdoClaudeCodeError {
  constructor(message: string, details?: unknown) {
    super(message, "AUTH_ERROR", details);
    this.name = "AuthenticationError";
  }
}

export class ConfigError extends AdoClaudeCodeError {
  constructor(message: string, details?: unknown) {
    super(message, "CONFIG_ERROR", details);
    this.name = "ConfigError";
  }
}

export class SyncError extends AdoClaudeCodeError {
  constructor(message: string, details?: unknown) {
    super(message, "SYNC_ERROR", details);
    this.name = "SyncError";
  }
}

export class WorkItemError extends AdoClaudeCodeError {
  constructor(message: string, details?: unknown) {
    super(message, "WORK_ITEM_ERROR", details);
    this.name = "WorkItemError";
  }
}

export class TsgError extends AdoClaudeCodeError {
  constructor(message: string, details?: unknown) {
    super(message, "TSG_ERROR", details);
    this.name = "TsgError";
  }
}

export function formatError(error: unknown): string {
  if (error instanceof AdoClaudeCodeError) {
    return `[${error.code}] ${error.message}`;
  }
  if (error instanceof Error) {
    return error.message;
  }
  return String(error);
}
