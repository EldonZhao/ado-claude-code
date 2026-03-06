---
name: ado-conventions
description: Always-active Azure DevOps conventions and workflow reminders
---

# ADO Conventions

## CLI Usage

All Azure DevOps operations go through the CLI at `dist/cli.js`. Output is JSON to stdout, logs go to stderr.

```bash
node dist/cli.js <domain> <action> --project-dir=<user's project root> [--flags] [args]
```

**CRITICAL:** Always pass `--project-dir=<path>` pointing to the user's current project working directory. Without it, data will be stored in the wrong location when the plugin is installed via marketplace. Use the user's project root (where `.claude/` lives or should live).

Domains: `work-items`, `sync`, `tsg` (includes `ts` subcommand for troubleshooting), `setup`

## Work Item YAML Format

Local work items are stored in `.claude/ado/work-items/<type>/<id>.yaml`:

```yaml
id: 1234
rev: 5
type: User Story
title: "As a user, I want to..."
state: Active
assignedTo: user@example.com
areaPath: Project/Team
iterationPath: Project/Sprint 1
priority: 2
storyPoints: 3
parent: 1000
description: "<html description>"
syncedAt: "2025-01-01T00:00:00.000Z"
```

## Sync Workflow

1. **Pull first** — Always pull latest from ADO before making changes
2. **Edit locally** — Modify YAML files as needed
3. **Push changes** — Push local modifications back to ADO
4. **Resolve conflicts** — If both local and remote changed, resolve manually

## Naming Conventions

- TSG IDs: `tsg-{category}-{number}` (e.g., `tsg-deployment-001`)
- Work item files: `{id}.yaml` in type-specific subdirectories
- Config file: `.claude/.ado-config.yaml` in project root

## Environment Variables

- `ADO_PAT` — Personal Access Token (only if authType=pat)
- `ADO_ORG` — Organization URL (overrides config)
- `ADO_PROJECT` — Project name (overrides config)
- `LOG_LEVEL` — debug | info | warn | error (default: warn)
