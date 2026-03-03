# ado-claude-code

Claude Code plugin for [Azure DevOps](https://dev.azure.com) integration. Sync work items to local YAML files, plan work item breakdowns with AI, manage troubleshooting guides (TSGs), and leverage AI-assisted diagnostics.

## Features

- **Work Item Sync** — Bidirectional sync between Azure DevOps and local YAML files
- **AI-Assisted Planning** — Break down Epics into Features, Features into Stories, Stories into Tasks
- **TSG Management** — Create and manage structured troubleshooting guides
- **AI Troubleshooting** — Diagnose issues by matching symptoms to TSGs, run diagnostics, suggest resolutions

## Installation

```bash
npm install
npm run build
```

## Configuration

### 1. Set up credentials

```bash
export ADO_PAT="your-personal-access-token"
```

### 2. Initialize the plugin

```bash
node dist/cli.js setup init --organization="https://dev.azure.com/your-org" --project="YourProject"
```

### 3. Validate connection

```bash
node dist/cli.js setup validate
```

## Plugin Setup (Claude Code)

Add this project as a Claude Code plugin. The plugin provides:

- **6 Slash Commands** — `/ado-sync`, `/ado-plan`, `/ado-query`, `/troubleshoot`, `/tsg-create`, `/ado-setup`
- **4 Skills** — Domain knowledge for work items, TSGs, troubleshooting, and planning
- **2 Agents** — Specialist subagents for planning and troubleshooting
- **1 Rule** — Always-active ADO conventions

## CLI Commands

All operations use the CLI at `dist/cli.js`. Output is JSON to stdout.

### Setup
```bash
node dist/cli.js setup init --organization=<url> --project=<name>
node dist/cli.js setup validate
node dist/cli.js setup show
```

### Work Items
```bash
node dist/cli.js work-items get <id>
node dist/cli.js work-items list [--type=...] [--state=...] [--assignedTo=...]
node dist/cli.js work-items create --type=Task --title="Fix bug" [--priority=1]
node dist/cli.js work-items update <id> [--state=Active] [--priority=2]
node dist/cli.js work-items query "SELECT [System.Id] FROM WorkItems WHERE ..."
node dist/cli.js work-items plan <id> [--items='[...]'] [--create]
```

### Sync
```bash
node dist/cli.js sync pull [--ids=1,2,3] [--query="SELECT ..."]
node dist/cli.js sync push [--ids=1,2,3]
node dist/cli.js sync full --query="SELECT ..."
```

### TSG
```bash
node dist/cli.js tsg create --title="..." --category=deployment
node dist/cli.js tsg get <id>
node dist/cli.js tsg update <id> [--title=...] [--tags='[...]']
node dist/cli.js tsg list [--category=...]
node dist/cli.js tsg search --query="..." [--symptoms='[...]']
node dist/cli.js tsg execute <id> [--stepId=...] [--rootCause=...] [--parameters='{...}']
```

### Troubleshooting
```bash
node dist/cli.js troubleshoot diagnose --symptoms='["symptom1","symptom2"]'
node dist/cli.js troubleshoot analyze --output="<diagnostic output>" [--tsgId=...]
node dist/cli.js troubleshoot suggest --tsgId=<id> --rootCause=<cause>
```

## Development

```bash
npm run dev      # Build in watch mode
npm test         # Run tests
npm run lint     # Type check
npm run build    # Production build
```

## Architecture

```
src/
  cli.ts                CLI entry point (arg parsing + routing)
  cli/
    work-items.ts       Work item handlers
    sync.ts             Sync handlers
    tsg.ts              TSG handlers
    setup.ts            Setup handlers
    troubleshoot.ts     Troubleshooting handlers
    helpers.ts          Shared CLI utilities
  services/
    ado/                ADO client, auth
    sync/               Sync engine, mapper, state
    tsg/                TSG search, executor
    planning/           Work item breakdown
  storage/
    config.ts           Config file management
    work-items.ts       Work item YAML storage
    tsg.ts              TSG YAML storage
    cache.ts            API response cache
  schemas/              Zod validation schemas
  utils/                Logger, error classes

.claude-plugin/         Plugin manifest
commands/               Slash commands (6)
skills/                 Domain knowledge (4)
agents/                 Specialist subagents (2)
rules/                  Always-active conventions
```

## License

MIT
