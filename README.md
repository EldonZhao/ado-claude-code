# ado-claude-code

> **Azure DevOps meets AI — plan, track, and troubleshoot from your terminal.**

Claude Code plugin for [Azure DevOps](https://dev.azure.com) integration. Sync workitems to local YAML files, plan workitem breakdowns with AI, manage troubleshooting instructions, and leverage AI-assisted diagnostics.

## Features

- **Workitem Sync** — Bidirectional sync between Azure DevOps and local YAML files, with automatic sync state tracking across all CLI commands
- **AI-Assisted Planning** — Break down Epics into Features, Features into Stories, Stories into Tasks
- **Code Planning** — Generate implementation plans from workitems, with automatic state transition and comment posting
- **Workitem Management** — Create, update, and query workitems directly from the CLI
- **Instructions Management** — Create and manage structured troubleshooting instructions
- **AI Troubleshooting** — Diagnose issues by matching symptoms to instructions, run diagnostics, suggest resolutions

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
/ado-claude-code:setup init --url="https://dev.azure.com/your-org/YourProject"
```

Or use the legacy flags:

```
/ado-claude-code:setup init --organization="https://dev.azure.com/your-org" --project="YourProject"
```

Supported URL formats:
- `https://dev.azure.com/<org>/<project>`
- `https://<org>.visualstudio.com/<project>`

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
/ado-claude-code:setup init --url="https://dev.azure.com/your-org/YourProject" --authType=pat
```

Or:

```
/ado-claude-code:setup init --organization="https://dev.azure.com/your-org" --project="YourProject" --authType=pat
```

## What's Included

### Slash Commands (9)

| Command | Description |
|---------|-------------|
| `/ado-claude-code:sync` | Pull/push/full sync workitems with Azure DevOps |
| `/ado-claude-code:code-plan` | Generate a code implementation plan from a workitem (auto-updates state and adds comment) |
| `/ado-claude-code:workitem-plan` | AI-assisted workitem hierarchy breakdown |
| `/ado-claude-code:workitem-query` | Run WIQL queries or list local items |
| `/ado-claude-code:workitem-create` | Create a new workitem in Azure DevOps |
| `/ado-claude-code:clear` | Clear all synced workitems from local storage |
| `/ado-claude-code:instructions` | Create, manage, and troubleshoot with instructions |
| `/ado-claude-code:setup` | Initialize, validate, login/logout, or show configuration |
| `/ado-claude-code:summary` | Summarize Azure DevOps progress over a time period (week/month/custom) |

### Agents (2)

| Agent | Description |
|-------|-------------|
| `ado-planner` | Specialist for breaking down workitems into structured hierarchies |
| `ado-troubleshooter` | Specialist for diagnosing issues using instructions-based troubleshooting |

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
/ado-claude-code:sync pull --ids=1234,5678   # Pull specific workitems
/ado-claude-code:sync pull --all             # Pull all your items including Closed/Done
/ado-claude-code:sync pull --query="SELECT [System.Id] FROM WorkItems WHERE ..."
/ado-claude-code:sync push                   # Push local changes to Azure DevOps
/ado-claude-code:sync push --ids=1234        # Push specific items
/ado-claude-code:sync full                   # Bidirectional sync (push then pull)
/ado-claude-code:sync full --mine            # Full sync for your active items
```

Synced items are stored as YAML in `.github/workitems/` organized by type. Use `/ado-claude-code:clear --confirm` to remove all synced workitems and reset sync state.

### Workitems

```
/ado-claude-code:workitem-query list                  # List locally synced items
/ado-claude-code:workitem-query list --type="User Story" --state=Active
/ado-claude-code:workitem-query query "SELECT [System.Id] FROM WorkItems WHERE ..."
/ado-claude-code:workitem-create Bug "login crashes on empty password"      # Summary → Claude refines title & description
/ado-claude-code:workitem-create --type=Task --title="Fix the bug"          # Explicit title → pass-through
/ado-claude-code:workitem-create --type="User Story" --title="As a user, I want..." --parentId=1234
/ado-claude-code:workitem-plan <id>          # Get breakdown guidance for a workitem
/ado-claude-code:workitem-plan <id> --items='[...]' --create   # Create child items in ADO
/ado-claude-code:workitem-plan <id> --complete                 # Mark workitem as Done/Closed
```

When you provide a **summary** instead of an explicit `--title`, Claude refines it into a well-structured title and HTML description using per-type formatting rules (Bug, User Story, Task, Feature, Epic) and presents the result for confirmation before creating.

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
/ado-claude-code:code-plan <id>              # Generate implementation plan from a workitem
/ado-claude-code:code-plan <id> --no-update  # Generate plan without updating workitem state
```

Fetches the workitem and returns structured guidance including files to analyze, architectural approach, step-by-step changes, testing suggestions, and edge cases. Automatically transitions the workitem to "In Progress" and posts the plan as a comment.

### Summary

```
/ado-claude-code:summary                                  # Summarize last week's activity
/ado-claude-code:summary --period=month                   # Summarize last 30 days
/ado-claude-code:summary --assignedTo=user@example.com    # Filter by assignee
/ado-claude-code:summary --query="SELECT ..."             # Custom WIQL query
```

Queries Azure DevOps for recently changed workitems, groups them by parent Feature, and classifies them into Completed, In Progress, Blocked/Bugs, and New. Returns structured JSON that Claude interprets into a human-readable progress summary.

### Instructions

```
/ado-claude-code:instructions create --title="Pod OOM" --category=deployment
/ado-claude-code:instructions create --title="Pod OOM" --category=deployment --template
/ado-claude-code:instructions create --file=./existing-instructions.md
/ado-claude-code:instructions list [--category=deployment]
/ado-claude-code:instructions get <tsg-id>
/ado-claude-code:instructions update <tsg-id> --title="..." --tags='[...]'
/ado-claude-code:instructions search --query="pod restarting" --symptoms='["OOMKilled"]'
/ado-claude-code:instructions score <tsg-id>   # Evaluate instruction completeness (0–125)
```

**Troubleshooting workflow:**

```
/ado-claude-code:instructions diagnose --symptoms='["pod restarting","OOMKilled"]'
/ado-claude-code:instructions analyze --output="<diagnostic output>" --tsgId=<id>
/ado-claude-code:instructions suggest --tsgId=<id> --rootCause=oom
/ado-claude-code:instructions run --symptoms='["pod restarting"]' --category=deployment
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
    workitems.ts        Workitem handlers
    sync.ts             Sync handlers
    instructions.ts     Instruction handlers (create, manage, and troubleshoot)
    setup.ts            Setup handlers
    troubleshoot.ts     Troubleshooting handlers (diagnose, analyze, suggest, run)
    helpers.ts          Shared CLI utilities
  services/
    ado/                ADO client, auth
    sync/               Sync engine, mapper, state
    tsg/                Instruction search, executor
    planning/           Workitem breakdown, code plan
  storage/              Config, workitems, instructions, cache (YAML I/O)
  schemas/              Zod validation schemas
  utils/                Logger, error classes

.claude-plugin/         Plugin manifest + marketplace catalog
commands/               Slash commands (9)
agents/                 Specialist subagents (2)
rules/                  Always-active conventions

.github/
  workitems/            Synced workitems (YAML), organized by type
  instructions/         Troubleshooting instructions (YAML)
  .ado-sync/            Sync state tracking
```

## License

MIT
