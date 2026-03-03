# Implementation Plan: Azure DevOps Claude Code Plugin

## Overview

A Claude Code MCP server plugin that integrates with Azure DevOps to:
1. Sync work items (Epics, Features, User Stories, Tasks, Bugs) to local YAML files
2. AI-assisted work item planning and breakdown
3. Manage AI-oriented Troubleshooting Guides (TSGs)
4. Leverage AI + TSG for automated issue diagnosis and resolution

---

## Task Type
- [x] Backend (MCP Server, ADO API integration)
- [x] Fullstack (CLI setup wizard + MCP tools)

---

## Technology Stack

| Category | Technology | Rationale |
|----------|------------|-----------|
| Runtime | Node.js 20 LTS | Stable, async I/O |
| Language | TypeScript 5.x | Type safety |
| Build | tsup | Fast ESM/CJS bundling |
| Package Manager | pnpm | Fast, strict deps |
| ADO Client | `azure-devops-node-api` | Official SDK |
| Schema Validation | Zod | Runtime + compile-time |
| Local Storage | YAML (gray-matter) | Human-readable, git-friendly |
| MCP SDK | `@modelcontextprotocol/sdk` | Official MCP implementation |
| Testing | Vitest | Fast, native TS |
| Logging | pino | Structured JSON logging |

---

## Implementation Steps

### Phase 1: Foundation (MVP)

**Step 1** — Project scaffolding
- Initialize `package.json` with pnpm
- Configure TypeScript (`tsconfig.json`)
- Configure build (`tsup.config.ts`)
- Configure tests (`vitest.config.ts`)
- Create `.gitignore`, `.env.example`, `CLAUDE.md`
- Install core dependencies: `@modelcontextprotocol/sdk`, `azure-devops-node-api`, `zod`, `gray-matter`, `yaml`, `pino`
- **Deliverable:** Project builds and runs empty MCP server

**Step 2** — MCP server scaffold
- `src/index.ts` — Entry point, stdio transport
- `src/server.ts` — Server creation, capability declaration, tool registration
- `src/tools/index.ts` — Tool registry pattern
- `src/types/index.ts` — Shared type definitions
- `src/utils/logger.ts` — Pino logger setup
- `src/utils/errors.ts` — Custom error classes
- **Deliverable:** MCP server starts, responds to `tools/list`

**Step 3** — ADO client service
- `src/services/ado/client.ts` — ADO API client wrapper with retry logic
- `src/services/ado/types.ts` — ADO-specific type definitions
- `src/services/ado/auth.ts` — Authentication (PAT from env var, fallback to Azure CLI)
- `src/schemas/config.schema.ts` — Config validation with Zod
- `src/storage/config.ts` — `.ado-config.yaml` reader/writer
- **Deliverable:** Can authenticate and call ADO API

**Step 4** — Local YAML storage layer
- `src/storage/index.ts` — Storage facade
- `src/storage/work-items.ts` — Work item file CRUD (read/write YAML)
- `src/schemas/work-item.schema.ts` — Work item Zod schema
- Create `data/work-items/{epics,features,user-stories,tasks,bugs}/` directory structure
- Create `templates/work-items/{epic,feature,user-story,task,bug}.yaml`
- **Deliverable:** Can read/write work items as local YAML files

**Step 5** — Basic work item MCP tools
- `src/tools/work-items/get.tool.ts` — `ado_work_items_get` (fetch single item from ADO)
- `src/tools/work-items/list.tool.ts` — `ado_work_items_list` (list local items)
- `src/tools/work-items/create.tool.ts` — `ado_work_items_create` (create in ADO + local)
- `src/tools/work-items/update.tool.ts` — `ado_work_items_update` (update in ADO + local)
- `src/tools/work-items/query.tool.ts` — `ado_work_items_query` (WIQL query)
- **Deliverable:** Claude can CRUD work items via MCP tools

### Phase 2: Sync Engine

**Step 6** — Sync state management
- `src/services/sync/state.ts` — Sync state tracking (`data/.ado-sync/state.json`)
- `src/schemas/sync-state.schema.ts` — Sync state Zod schema
- Track: ADO revision, local file hash, last sync timestamp, sync status
- **Deliverable:** Sync state persisted and queryable

**Step 7** — Pull from ADO
- `src/services/sync/engine.ts` — `pullFromAdo()` method
- `src/services/sync/mapper.ts` — ADO work item ↔ local YAML mapper
- Query ADO → compare with sync state → write new/updated items → update state
- `src/tools/work-items/sync.tool.ts` — `ado_work_items_sync` (direction: "pull")
- **Deliverable:** Can pull work items from ADO to local YAML

**Step 8** — Push to ADO
- `src/services/sync/engine.ts` — `pushToAdo()` method
- `src/services/sync/differ.ts` — Detect local file changes vs sync state
- Read modified local files → validate → PATCH ADO API → update state
- Extend `ado_work_items_sync` tool (direction: "push")
- **Deliverable:** Can push local changes back to ADO

**Step 9** — Full bidirectional sync
- `src/services/sync/engine.ts` — `fullSync()` method
- `src/services/sync/resolver.ts` — Conflict detection and resolution
- Pull → detect local changes → identify conflicts → prompt user → push
- Extend `ado_work_items_sync` tool (direction: "full")
- **Deliverable:** Full bidirectional sync with conflict handling

### Phase 3: TSG System

**Step 10** — TSG storage and schema
- `src/schemas/tsg.schema.ts` — TSG Zod schema (metadata, symptoms, diagnostics, resolutions)
- `src/storage/tsg.ts` — TSG file CRUD
- Create `data/tsg/_index.yaml` and `data/tsg/categories/` structure
- Create `templates/tsg/template.yaml` with full TSG structure
- **Deliverable:** TSG files can be created and read

**Step 11** — TSG CRUD tools
- `src/tools/tsg/create.tool.ts` — `tsg_create`
- `src/tools/tsg/get.tool.ts` — `tsg_get`
- `src/tools/tsg/update.tool.ts` — `tsg_update`
- `src/tools/tsg/list.tool.ts` — `tsg_list`
- **Deliverable:** Claude can manage TSGs via MCP tools

**Step 12** — TSG search
- `src/services/tsg/index.ts` — TSG service with keyword search
- `src/tools/tsg/search.tool.ts` — `tsg_search` (by symptoms, tags, keywords)
- Maintain `_index.yaml` with searchable metadata
- **Deliverable:** Can find relevant TSGs by symptoms/keywords

**Step 13** — TSG execution framework
- `src/services/tsg/executor.ts` — Step-by-step execution engine
- `src/services/tsg/parser.ts` — Parse commands with template parameters
- `src/tools/tsg/execute.tool.ts` — `tsg_execute` (run diagnostic step, analyze output)
- Track execution state (which steps completed, outputs collected)
- **Deliverable:** Claude can walk through TSG steps programmatically

### Phase 4: AI Enhancement

**Step 14** — Work item planning/breakdown
- `src/services/planning/breakdown.ts` — Hierarchy breakdown logic
- `src/services/planning/templates.ts` — Work item templates for generation
- `src/tools/work-items/plan.tool.ts` — `ado_work_items_plan`
  - Fetch parent work item
  - Generate child items (Epic→Features, Feature→Stories, Story→Tasks)
  - Return as structured proposal (dry-run)
  - Create in ADO on confirmation
- **Deliverable:** AI-assisted work item decomposition

**Step 15** — Troubleshooting tools
- `src/tools/troubleshoot/diagnose.tool.ts` — `troubleshoot_diagnose`
  - Accept symptoms → search TSGs → suggest diagnostic commands
- `src/tools/troubleshoot/analyze.tool.ts` — `troubleshoot_analyze`
  - Accept diagnostic output → match against TSG patterns → identify root cause
- `src/tools/troubleshoot/resolve.tool.ts` — `troubleshoot_suggest`
  - Accept diagnosis → suggest resolution steps from TSG
- **Deliverable:** AI-powered troubleshooting pipeline

### Phase 5: Polish

**Step 16** — Setup wizard and configuration
- `scripts/setup.ts` — Interactive setup (org URL, project, auth method, PAT)
- Store credentials securely (env var guidance, optional keytar)
- Validate connection on setup
- **Deliverable:** Smooth onboarding experience

**Step 17** — Caching and offline support
- `src/storage/cache.ts` — API response cache with TTL
- Cache work item queries, reduce API calls
- Full offline read support from local YAML files
- **Deliverable:** Fast reads, works offline

**Step 18** — Documentation and testing
- Write unit tests for all services (target 80%+ coverage)
- Write integration tests with ADO API mocks
- Complete `README.md` with usage guide
- Complete `CLAUDE.md` with development instructions
- **Deliverable:** Well-tested, well-documented plugin

---

## Key Files

| File | Operation | Description |
|------|-----------|-------------|
| `package.json` | Create | Project manifest, dependencies, scripts |
| `tsconfig.json` | Create | TypeScript compiler config |
| `tsup.config.ts` | Create | Build configuration |
| `src/index.ts` | Create | MCP server entry point (stdio transport) |
| `src/server.ts` | Create | Server setup, tool registration |
| `src/tools/index.ts` | Create | Tool registry |
| `src/tools/work-items/*.tool.ts` | Create | Work item MCP tools (7 tools) |
| `src/tools/tsg/*.tool.ts` | Create | TSG MCP tools (6 tools) |
| `src/tools/troubleshoot/*.tool.ts` | Create | Troubleshooting MCP tools (3 tools) |
| `src/services/ado/client.ts` | Create | ADO API client wrapper |
| `src/services/ado/auth.ts` | Create | Authentication logic |
| `src/services/sync/engine.ts` | Create | Bidirectional sync engine |
| `src/services/sync/mapper.ts` | Create | ADO ↔ YAML mapper |
| `src/services/tsg/index.ts` | Create | TSG service |
| `src/services/tsg/executor.ts` | Create | TSG step execution engine |
| `src/services/planning/breakdown.ts` | Create | Work item decomposition |
| `src/storage/work-items.ts` | Create | YAML file operations for work items |
| `src/storage/tsg.ts` | Create | YAML file operations for TSGs |
| `src/schemas/*.schema.ts` | Create | Zod validation schemas |
| `.ado-config.yaml` | Create | Project configuration |
| `CLAUDE.md` | Create | Claude Code instructions |

---

## MCP Tool Surface (16 tools)

### Work Item Tools (7)
| Tool | Description |
|------|-------------|
| `ado_work_items_sync` | Sync work items (pull/push/full) |
| `ado_work_items_list` | List local work items with filters |
| `ado_work_items_get` | Get single work item details |
| `ado_work_items_create` | Create new work item in ADO + local |
| `ado_work_items_update` | Update work item in ADO + local |
| `ado_work_items_query` | Run WIQL query against ADO |
| `ado_work_items_plan` | AI-assisted work item breakdown |

### TSG Tools (6)
| Tool | Description |
|------|-------------|
| `tsg_search` | Find TSGs by symptoms/keywords/tags |
| `tsg_get` | Get TSG content |
| `tsg_create` | Create new TSG |
| `tsg_update` | Update existing TSG |
| `tsg_execute` | Execute TSG diagnostic/resolution step |
| `tsg_list` | List all TSGs with category filter |

### Troubleshooting Tools (3)
| Tool | Description |
|------|-------------|
| `troubleshoot_diagnose` | Accept symptoms, find TSGs, suggest diagnostics |
| `troubleshoot_analyze` | Analyze diagnostic output, identify root cause |
| `troubleshoot_suggest` | Suggest resolution steps |

---

## Data Flow

### Work Item Sync
```
Claude Code → ado_work_items_sync(pull) → ADO REST API → Mapper → YAML files
Claude Code → ado_work_items_sync(push) → Differ → YAML files → Mapper → ADO REST API
```

### TSG Troubleshooting
```
User reports issue → troubleshoot_diagnose → tsg_search (match symptoms)
  → tsg_execute (run diagnostics) → troubleshoot_analyze (interpret output)
  → troubleshoot_suggest (resolution from TSG)
```

### Work Item Planning
```
User: "Break down Epic #1234" → ado_work_items_plan
  → Fetch epic from ADO → Generate child Features/Stories/Tasks
  → Return proposal → User approves → ado_work_items_create (batch)
```

---

## Local File Formats

### Work Item (YAML): `data/work-items/{type}/{id}.yaml`
```yaml
id: 12345
rev: 7
url: "https://dev.azure.com/org/project/_workitems/edit/12345"
syncedAt: "2026-03-03T10:30:00Z"
type: "User Story"
title: "As a user, I can reset my password"
state: "Active"
assignedTo: "john@example.com"
areaPath: "Project\\Team A"
iterationPath: "Project\\Sprint 42"
priority: 2
storyPoints: 5
parent: 12340
children: [12346, 12347]
description: |
  Markdown description here...
```

### TSG (YAML): `data/tsg/{category}/{slug}.yaml`
```yaml
id: "tsg-deployment-001"
title: "Kubernetes Pod CrashLoopBackOff"
category: "deployment"
tags: [kubernetes, pod, crashloop]
symptoms:
  - "pod status CrashLoopBackOff"
  - "container keeps restarting"
diagnostics:
  - id: "diag-1"
    name: "Get Pod Status"
    command:
      template: "kubectl get pod {{podName}} -n {{namespace}}"
    analysis:
      lookFor:
        - pattern: "OOMKilled"
          indicatesRootCause: "memory-limit"
resolutions:
  memory-limit:
    steps:
      - action: "Increase memory limit"
        command: "kubectl edit deployment {{name}}"
```

### Config: `.ado-config.yaml`
```yaml
version: "1.0"
azure_devops:
  organization: "https://dev.azure.com/myorg"
  project: "MyProject"
  auth:
    type: "pat"
    patEnvVar: "ADO_PAT"
storage:
  basePath: "./data"
sync:
  conflictResolution: "ask"
```

---

## Authentication Strategy

1. **Primary:** PAT via `ADO_PAT` environment variable (simplest setup)
2. **Fallback:** Azure CLI token (`az account get-access-token`)
3. **Advanced:** Azure AD service principal (for CI/CD)
4. Credentials never stored in project files

---

## Key Design Decisions

| Decision | Choice | Rationale |
|----------|--------|-----------|
| Storage format | YAML files | Human-readable, git-friendly, meaningful diffs |
| Sync model | Explicit pull/push | Predictable, works offline, matches Git model |
| TSG format | Structured YAML | AI-parseable, parameterized commands, pattern matching |
| Plugin type | MCP server | Native Claude Code integration, tool chaining |
| Auth default | PAT | Simplest setup for individual developers |
| File structure | One file per work item | Git history per item, parallel editing, easy to find |
| Sync scope | Query-based (lazy) | Avoids syncing thousands of items in large projects |

---

## Risks and Mitigation

| Risk | Mitigation |
|------|------------|
| ADO API rate limiting | Implement retry with exponential backoff, cache responses |
| Large work item descriptions | Truncate for index, full content in individual files |
| Sync conflicts | Track revisions, detect conflicts, prompt user for resolution |
| PAT expiration | Validate on startup, clear error message with renewal instructions |
| TSG format too rigid | Schema allows `customFields` for extensibility |
| Offline data staleness | Show last sync timestamp, warn if data is old |

---

## SESSION_ID (for /ccg:execute use)
- CODEX_SESSION: N/A (codeagent-wrapper not installed)
- GEMINI_SESSION: N/A (codeagent-wrapper not installed)
