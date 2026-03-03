# CLAUDE.md

## Project Overview
Claude Code plugin for Azure DevOps integration.
Enables work item sync, AI-assisted planning, TSG management, and troubleshooting via CLI commands.

## Quick Start
```bash
npm install
npm run build
export ADO_PAT="your-pat-token"
node dist/cli.js setup init --organization=https://dev.azure.com/myorg --project=MyProject
```

## Commands
- `npm run build` — Build TypeScript
- `npm run dev` — Build in watch mode
- `npm start` — Run CLI (shows help)
- `npm test` — Run tests
- `npm run lint` — Type check

## CLI Usage
```
node dist/cli.js <domain> <action> [--flags]
```

### Domains
- `setup` — init, validate, show
- `work-items` — get, list, create, update, query, plan
- `sync` — pull, push, full
- `tsg` — create, get, update, list, search, execute
- `troubleshoot` — diagnose, analyze, suggest

## Architecture
- `src/cli.ts` — CLI entry point (arg parsing + routing)
- `src/cli/` — CLI handler modules
  - `work-items.ts` — Work item CRUD, query, plan
  - `sync.ts` — Bidirectional sync
  - `tsg.ts` — TSG CRUD, search, execute
  - `setup.ts` — Config init/validate/show
  - `troubleshoot.ts` — Diagnose, analyze, suggest
  - `helpers.ts` — Shared CLI helpers (ADO client, formatters, output)
- `src/services/` — Business logic
  - `ado/` — ADO client, auth, types
  - `sync/` — Bidirectional sync engine, mapper, state
  - `tsg/` — TSG search service, step executor
  - `planning/` — Work item breakdown, templates
- `src/storage/` — Local file operations (YAML read/write, cache)
- `src/schemas/` — Zod validation schemas
- `data/work-items/` — Synced work items (YAML)
- `data/tsg/` — Troubleshooting guides (YAML)

## Plugin Structure
- `.claude-plugin/plugin.json` — Plugin manifest
- `commands/*.md` — Slash commands (6)
- `skills/*/SKILL.md` — Domain knowledge (4)
- `agents/*.md` — Specialist subagents (2)
- `rules/*.md` — Always-active conventions

## Adding a New CLI Command
1. Add handler function in the appropriate `src/cli/<domain>.ts`
2. Add the action case to the switch in the handler
3. Update the command markdown in `commands/`

## Environment Variables
- `ADO_PAT` — Azure DevOps Personal Access Token
- `ADO_ORG` — Organization URL (overrides config)
- `ADO_PROJECT` — Project name (overrides config)
- `LOG_LEVEL` — debug | info | warn | error (default: warn)

## Testing
Tests live in `tests/` and use vitest. Run with `npm test`.
- `tests/utils/` — Error class tests
- `tests/services/` — TSG executor, TSG search, sync mapper, planning tests
- `tests/storage/` — Cache tests
