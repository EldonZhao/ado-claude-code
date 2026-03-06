---
name: ado-claude-code:tsg-create
description: Create or manage Troubleshooting Guides (TSGs)
arguments:
  - name: action
    description: "Action: create, get, update, list, search, execute, or score"
    required: true
  - name: id
    description: "TSG ID (for get, update, execute, score)"
    required: false
  - name: data
    description: "JSON data for create/update operations"
    required: false
---

# TSG Management

Create and manage structured Troubleshooting Guides.

**IMPORTANT:** Always pass `--project-dir=<user's project root>` so TSGs are stored in the project's `.claude/` directory, not the plugin's.

## Create a TSG

```bash
node dist/cli.js tsg create --project-dir=/path/to/project --title="Pod OOM" --category=deployment --tags='["oom","kubernetes"]' --symptoms='["pod keeps restarting","OOMKilled in events"]'
```

### Create from template

Use `--template` to start from a category-specific skeleton with pre-filled symptoms, diagnostics, and escalation:

```bash
node dist/cli.js tsg create --title="Pod OOM" --category=deployment --template
```

Available templates: deployment, database, networking, authentication, performance. User-provided fields override template defaults.

### Create with full JSON

```bash
node dist/cli.js tsg create --json='{"title":"...","category":"...","diagnostics":[...],"resolutions":{...}}'
```

### Import from file

Import an existing TSG markdown file (with YAML frontmatter):

```bash
node dist/cli.js tsg create --file=./existing-tsg.md
```

Import a plain text file as a manual diagnostic step (requires `--title` and `--category`):

```bash
node dist/cli.js tsg create --file=./docs/runbook-oom.md --title="OOM Runbook" --category=deployment
```

Flags like `--title`, `--category`, `--author`, `--tags`, and `--symptoms` override values from the imported file.

## Get a TSG

```bash
node dist/cli.js tsg get tsg-deployment-001
```

## Update a TSG

```bash
node dist/cli.js tsg update tsg-deployment-001 --title="Updated Title" --tags='["new-tag"]'
```

## List TSGs

```bash
node dist/cli.js tsg list
node dist/cli.js tsg list --category=deployment
```

## Search TSGs

```bash
node dist/cli.js tsg search --query="pod restarting" --symptoms='["OOMKilled"]' --category=deployment
```

## Execute a TSG step

```bash
node dist/cli.js tsg execute tsg-deployment-001 --stepId=check-pod-status --parameters='{"podName":"my-pod"}'
node dist/cli.js tsg execute tsg-deployment-001 --rootCause=oom --parameters='{"podName":"my-pod"}'
```

## Score a TSG

Evaluate TSG completeness and get suggestions for improvement:

```bash
node dist/cli.js tsg score tsg-deployment-001
```

Returns a score (0–125) with breakdown by: symptoms, related errors, diagnostics, analysis patterns, resolutions, and escalation.
