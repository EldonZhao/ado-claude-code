import pino from "pino";

const level = process.env.LOG_LEVEL ?? "info";

// Log to stderr so stdout is reserved for MCP JSON-RPC
export const logger = pino({
  level,
  transport:
    process.env.NODE_ENV === "development"
      ? { target: "pino/file", options: { destination: 2 } }
      : undefined,
}, pino.destination(2));
