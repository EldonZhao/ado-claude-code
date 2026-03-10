# ado-claude-code

> **Azure DevOps meets AI — plan, track, and troubleshoot from your terminal.**

Claude Code plugin for [Azure DevOps](https://dev.azure.com) integration. Sync work items to local YAML files, plan work item breakdowns with AI, manage troubleshooting guides (TSGs), and leverage AI-assisted diagnostics.

## Features

- **Work Item Sync** — Bidirectional sync between Azure DevOps and local YAML files, with automatic sync state tracking across all CLI commands
- **AI-Assisted Planning** — Break down Epics into Features, Features into Stories, Stories into Tasks
- **Code Planning** — Generate implementation plans from work items, with automatic state transition and comment posting
- **Work Item Management** — Create, update, and query work items directly from the CLI
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

The CLI is pre-built and bundled with all dependencies — no `npm install` or build step needed after installation.

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
cp -r agents/ /path/to/your-project/.claude/agents/
cp -r rules/ /path/to/your-project/.claude/rules/
```

> **Note:** With manual copy, commands are unnamespaced (e.g., `/sync`).
> With marketplace install, they are namespaced (e.g., `/ado-claude-code:sync`).

## Setup

After installation, run the interactive setup in the Claude terminal:

```
/ado-claude-code:setup
```

This walks you through configuring your organization URL, project name, and authentication. Alternatively, run each step manually:

### 1. Initialize configuration

```
/ado-claude-code:setup init --organization="https://dev.azure.com/your-org" --project="YourProject"
```

### 2. Login

```
/ado-claude-code:setup login
```

This starts a device-code flow — you'll see a URL and code in the terminal. Open the URL in your browser, enter the code, and sign in with your Azure AD account. The token is cached locally so subsequent commands authenticate automatically.

### 3. Validate connection

```
/ado-claude-code:setup validate
```

### Alternative: PAT authentication

If you prefer a Personal Access Token instead of browser login:

```bash
export ADO_PAT="your-personal-access-token"
```

```
/ado-claude-code:setup init --organization="https://dev.azure.com/your-org" --project="YourProject" --authType=pat
```

## What's Included

### Slash Commands (9)

| Command | Description |
|---------|-------------|
| `/ado-claude-code:sync` | Pull/push/full sync work items with Azure DevOps |
| `/ado-claude-code:code-plan` | Generate a code implementation plan from a work item (auto-updates state and adds comment) |
| `/ado-claude-code:workitem-plan` | AI-assisted work item hierarchy breakdown |
| `/ado-claude-code:query` | Run WIQL queries or list local items |
| `/ado-claude-code:workitem-create` | Create a new work item in Azure DevOps |
| `/ado-claude-code:clear` | Clear all synced work items from local storage |
| `/ado-claude-code:tsg-ts` | Diagnose issues, analyze output, suggest resolutions |
| `/ado-claude-code:tsg-create` | Create and manage troubleshooting guides |
| `/ado-claude-code:setup` | Initialize, validate, login/logout, or show configuration |

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

All commands are invoked as slash commands in the Claude terminal. With marketplace install, commands are prefixed with `ado-claude-code:`.

### Setup

```
/ado-claude-code:setup                      # Interactive setup — walks you through init, login, and validate
/ado-claude-code:setup init                  # Initialize config with org URL and project name
/ado-claude-code:setup login                 # Authenticate via Azure AD browser flow
/ado-claude-code:setup logout                # Clear cached credentials
/ado-claude-code:setup validate              # Test the connection to Azure DevOps
/ado-claude-code:setup show                  # Display current configuration
```

Configuration is stored in `.claude/.ado-config.yaml`. For PAT auth, set `ADO_PAT` env var and pass `--authType=pat` to init.

### Sync

```
/ado-claude-code:sync pull                   # Pull active items assigned to you (default)
/ado-claude-code:sync pull --ids=1234,5678   # Pull specific work items
/ado-claude-code:sync pull --all             # Pull all your items including Closed/Done
/ado-claude-code:sync pull --query="SELECT [System.Id] FROM WorkItems WHERE ..."
/ado-claude-code:sync push                   # Push local changes to Azure DevOps
/ado-claude-code:sync push --ids=1234        # Push specific items
/ado-claude-code:sync full                   # Bidirectional sync (push then pull)
/ado-claude-code:sync full --mine            # Full sync for your active items
```

Synced items are stored as YAML in `.claude/ado/work-items/` organized by type. Use `/ado-claude-code:clear --confirm` to remove all synced items and reset sync state.

### Work Items

```
/ado-claude-code:query list                  # List locally synced items
/ado-claude-code:query list --type="User Story" --state=Active
/ado-claude-code:query query "SELECT [System.Id] FROM WorkItems WHERE ..."
/ado-claude-code:workitem-create --type=Task --title="Fix the bug" --priority=2
/ado-claude-code:workitem-create --type="User Story" --title="As a user, I want..." --parentId=1234
/ado-claude-code:workitem-plan <id>          # Get breakdown guidance for a work item
/ado-claude-code:workitem-plan <id> --items='[...]' --create   # Create child items in ADO
/ado-claude-code:workitem-plan <id> --complete                 # Mark work item as Done/Closed
```

**Hierarchy:** Epic → Feature → User Story → Task → Task (sub-tasks). Bug → Task.

Custom required fields can be configured as defaults in `.claude/.ado-config.yaml`:

```yaml
defaults:
  Task:
    customFields:
      Custom.StatusTweet: "Created by Claude"
```

### Code Plan

```
/ado-claude-code:code-plan <id>              # Generate implementation plan from a work item
/ado-claude-code:code-plan <id> --no-update  # Generate plan without updating work item state
```

Fetches the work item and returns structured guidance including files to analyze, architectural approach, step-by-step changes, testing suggestions, and edge cases. Automatically transitions the work item to "In Progress" and posts the plan as a comment.

### TSG

```
/ado-claude-code:tsg-create create --title="Pod OOM" --category=deployment
/ado-claude-code:tsg-create create --title="Pod OOM" --category=deployment --template
/ado-claude-code:tsg-create create --file=./existing-tsg.md
/ado-claude-code:tsg-create list [--category=deployment]
/ado-claude-code:tsg-create get <tsg-id>
/ado-claude-code:tsg-create update <tsg-id> --title="..." --tags='[...]'
/ado-claude-code:tsg-create search --query="pod restarting" --symptoms='["OOMKilled"]'
/ado-claude-code:tsg-create score <tsg-id>   # Evaluate TSG completeness (0–125)
```

**Troubleshooting workflow:**

```
/ado-claude-code:tsg-ts diagnose --symptoms='["pod restarting","OOMKilled"]'
/ado-claude-code:tsg-ts analyze --output="<diagnostic output>" --tsgId=<id>
/ado-claude-code:tsg-ts suggest --tsgId=<id> --rootCause=oom
/ado-claude-code:tsg-ts run --symptoms='["pod restarting"]' --category=deployment
```

The `run` action chains diagnose → diagnostics → analyze → suggest in a single command.

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
    tsg.ts              TSG handlers (includes ts subcommand for troubleshooting)
    setup.ts            Setup handlers
    troubleshoot.ts     Troubleshooting handlers (accessed via tsg ts)
    helpers.ts          Shared CLI utilities
  services/
    ado/                ADO client, auth
    sync/               Sync engine, mapper, state
    tsg/                TSG search, executor
    planning/           Work item breakdown, code plan
  storage/              Config, work-items, TSG, cache (YAML I/O)
  schemas/              Zod validation schemas
  utils/                Logger, error classes

.claude-plugin/         Plugin manifest + marketplace catalog
commands/               Slash commands (9)
agents/                 Specialist subagents (2)
rules/                  Always-active conventions

.claude/ado/
  work-items/           Synced work items (YAML), organized by type
  tsgs/                 Troubleshooting guides (YAML)
  .ado-sync/            Sync state tracking
```

## License

MIT
