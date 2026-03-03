# ado-claude-code

Claude Code plugin for [Azure DevOps](https://dev.azure.com) integration. Sync work items to local YAML files, plan work item breakdowns with AI, manage troubleshooting guides (TSGs), and leverage AI-assisted diagnostics.

## Features

- **Work Item Sync** — Bidirectional sync between Azure DevOps and local YAML files
- **AI-Assisted Planning** — Break down Epics into Features, Features into Stories, Stories into Tasks
- **TSG Management** — Create and manage structured troubleshooting guides
- **AI Troubleshooting** — Diagnose issues by matching symptoms to TSGs, run diagnostics, suggest resolutions

## Installation

### Option A: Plugin Marketplace (Recommended)

```bash
# 1. Add the marketplace
/plugin marketplace add EldonZhao/ado-claude-code

# 2. Install the plugin
/plugin install ado-claude-code@ado-claude-code
```

After installation, build the CLI:

```bash
cd ~/.claude/plugins/cache/ado-claude-code   # or wherever the plugin was installed
npm install && npm run build
```

### Option B: Local Plugin (Development / Testing)

```bash
git clone https://github.com/EldonZhao/ado-claude-code.git
cd ado-claude-code
npm install && npm run build

# Launch Claude Code with the plugin loaded
claude --plugin-dir ./ado-claude-code
```

### Option C: Manual Copy

```bash
git clone https://github.com/EldonZhao/ado-claude-code.git
cd ado-claude-code
npm install && npm run build

# Copy plugin components into your project's .claude/ directory
cp -r commands/ /path/to/your-project/.claude/commands/
cp -r skills/ /path/to/your-project/.claude/skills/
cp -r agents/ /path/to/your-project/.claude/agents/
cp -r rules/ /path/to/your-project/.claude/rules/
```

> **Note:** With manual copy, commands are unnamespaced (e.g., `/ado-sync`).
> With marketplace install, they are namespaced (e.g., `/ado-claude-code:ado-sync`).

## Setup

### 1. Set your Azure DevOps PAT

```bash
export ADO_PAT="your-personal-access-token"
```

### 2. Initialize configuration

```bash
node dist/cli.js setup init --organization="https://dev.azure.com/your-org" --project="YourProject"
```

### 3. Validate connection

```bash
node dist/cli.js setup validate
```

## What's Included

### Slash Commands (6)

| Command | Description |
|---------|-------------|
| `/ado-sync` | Pull/push/full sync work items with Azure DevOps |
| `/ado-plan` | AI-assisted work item breakdown |
| `/ado-query` | Run WIQL queries or list local items |
| `/troubleshoot` | Diagnose issues, analyze output, suggest resolutions |
| `/tsg-create` | Create and manage troubleshooting guides |
| `/ado-setup` | Initialize, validate, or show configuration |

### Skills (4)

| Skill | Description |
|-------|-------------|
| `ado-work-items` | ADO work item types, hierarchy, states, field mappings |
| `ado-tsg` | TSG structure, categories, diagnostic patterns |
| `ado-troubleshooting` | Troubleshooting methodology and workflow |
| `ado-planning` | Work item breakdown and estimation guidance |

### Agents (2)

| Agent | Description |
|-------|-------------|
| `ado-planner` | Specialist for breaking down work items into structured hierarchies |
| `ado-troubleshooter` | Specialist for diagnosing issues using TSG-based troubleshooting |

### Rules (1)

| Rule | Description |
|------|-------------|
| `ado-conventions` | Always-active ADO naming conventions, YAML structure, sync workflow |

## CLI Reference

All commands output JSON to stdout. The CLI is invoked by plugin commands via Bash.

```
node dist/cli.js <domain> <action> [--flags]
```

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
  storage/              Config, work-items, TSG, cache (YAML I/O)
  schemas/              Zod validation schemas
  utils/                Logger, error classes

.claude-plugin/         Plugin manifest + marketplace catalog
commands/               Slash commands (6)
skills/                 Domain knowledge (4)
agents/                 Specialist subagents (2)
rules/                  Always-active conventions
```

## License

MIT
