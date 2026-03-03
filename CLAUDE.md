# CLAUDE.md

## Project Overview
MCP server plugin for Claude Code that integrates with Azure DevOps.
Enables work item sync, AI-assisted planning, and TSG-based troubleshooting.

## Quick Start
```bash
npm install
npm run build
# Set ADO_PAT environment variable
npm start
```

## Commands
- `npm run build` — Build TypeScript
- `npm run dev` — Build in watch mode
- `npm start` — Run MCP server
- `npm test` — Run tests
- `npm run lint` — Type check

## Architecture
- `src/index.ts` — Entry point (stdio transport)
- `src/server.ts` — MCP server setup and tool registration (17 tools)
- `src/tools/` — MCP tool implementations
  - `work-items/` — CRUD, sync, query, plan (7 tools)
  - `tsg/` — TSG CRUD, search, execute (6 tools)
  - `troubleshoot/` — Diagnose, analyze, suggest (3 tools)
  - `setup.tool.ts` — Setup/validation tool (1 tool)
- `src/services/` — Business logic
  - `ado/` — ADO client, auth, types
  - `sync/` — Bidirectional sync engine, mapper, state
  - `tsg/` — TSG search service, step executor
  - `planning/` — Work item breakdown, templates
- `src/storage/` — Local file operations (YAML read/write, cache)
- `src/schemas/` — Zod validation schemas
- `data/work-items/` — Synced work items (YAML)
- `data/tsg/` — Troubleshooting guides (YAML)

## Adding a New Tool
1. Create `src/tools/{category}/{name}.tool.ts`
2. Export tool definition with `ToolDefinition` type and Zod input schema
3. Import and register in `src/server.ts` via `registerTool()`

## Environment Variables
- `ADO_PAT` — Azure DevOps Personal Access Token
- `ADO_ORG` — Organization URL (overrides config)
- `ADO_PROJECT` — Project name (overrides config)
- `LOG_LEVEL` — debug | info | warn | error

## Testing
Tests live in `tests/` and use vitest. Run with `npm test`.
- `tests/utils/` — Error class tests
- `tests/services/` — TSG executor, TSG search, sync mapper, planning tests
- `tests/storage/` — Cache tests
