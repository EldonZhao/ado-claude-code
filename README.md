# ado-claude-code

MCP server plugin for [Claude Code](https://claude.ai) that integrates with Azure DevOps. Sync work items to local YAML files, plan work item breakdowns with AI, manage troubleshooting guides (TSGs), and leverage AI-assisted diagnostics.

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

Use the `ado_setup` MCP tool with action `init`:

```json
{
  "action": "init",
  "organization": "https://dev.azure.com/your-org",
  "project": "YourProject",
  "authType": "pat"
}
```

### 3. Validate connection

```json
{ "action": "validate" }
```

## MCP Tools (17)

### Setup (1)
| Tool | Description |
|------|-------------|
| `ado_setup` | Initialize config, validate connection, show settings |

### Work Items (7)
| Tool | Description |
|------|-------------|
| `ado_work_items_get` | Fetch a single work item from ADO |
| `ado_work_items_list` | List local work items with filters |
| `ado_work_items_create` | Create work item in ADO + save locally |
| `ado_work_items_update` | Update work item in ADO + save locally |
| `ado_work_items_query` | Run WIQL query against ADO |
| `ado_work_items_sync` | Bidirectional sync (pull/push/full) |
| `ado_work_items_plan` | AI-assisted work item breakdown |

### TSG (6)
| Tool | Description |
|------|-------------|
| `tsg_create` | Create a new troubleshooting guide |
| `tsg_get` | Get TSG content by ID |
| `tsg_update` | Update an existing TSG |
| `tsg_list` | List TSGs, optionally by category |
| `tsg_search` | Search TSGs by symptoms, tags, keywords |
| `tsg_execute` | Execute a diagnostic step or get resolution |

### Troubleshooting (3)
| Tool | Description |
|------|-------------|
| `troubleshoot_diagnose` | Report symptoms, get matched TSGs and diagnostic steps |
| `troubleshoot_analyze` | Analyze diagnostic output, identify root causes |
| `troubleshoot_suggest` | Get resolution steps for an identified root cause |

## Usage with Claude Code

Add to your Claude Code MCP config:

```json
{
  "mcpServers": {
    "ado-claude-code": {
      "command": "node",
      "args": ["path/to/ado-claude-code/dist/index.js"],
      "env": {
        "ADO_PAT": "your-pat-token"
      }
    }
  }
}
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
  index.ts              Entry point (stdio transport)
  server.ts             MCP server, tool registration
  tools/
    setup.tool.ts       Setup/validation
    work-items/         7 work item tools
    tsg/                6 TSG tools
    troubleshoot/       3 troubleshooting tools
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
```

## License

MIT
