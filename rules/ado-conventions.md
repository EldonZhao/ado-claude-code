---
name: ado-conventions
description: Always-active Azure DevOps conventions and workflow reminders
---

# ADO Conventions

## CLI Usage

All Azure DevOps operations go through the CLI at `dist/cli.js`. Output is JSON to stdout, logs go to stderr.

```bash
node dist/cli.js <domain> <action> [--flags] [args]
```

Domains: `work-items`, `sync`, `tsg`, `setup`, `troubleshoot`

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
