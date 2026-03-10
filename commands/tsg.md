---
name: ado-claude-code:tsg
description: Create, manage, and troubleshoot with Troubleshooting Guides (TSGs)
arguments:
  - name: action
    description: "Action: create, get, update, list, search, execute, score, diagnose, analyze, suggest, or run"
    required: true
  - name: id
    description: "TSG ID (for get, update, execute, score)"
    required: false
  - name: symptoms
    description: "JSON array of symptom strings (for diagnose/run)"
    required: false
  - name: output
    description: "Diagnostic command output to analyze (for analyze/run)"
    required: false
  - name: tsgId
    description: "TSG ID for context (for analyze/suggest)"
    required: false
  - name: rootCause
    description: "Identified root cause key (for suggest)"
    required: false
  - name: data
    description: "JSON data for create/update operations"
    required: false
---

# TSG Management & Troubleshooting

Create and manage structured Troubleshooting Guides, and run AI-assisted troubleshooting workflows.

**IMPORTANT:** The CLI is at `dist/cli.js` within the plugin's install directory. To find it, read `~/.claude/plugins/installed_plugins.json`, look up `ado-claude-code@ado-claude-code`, and use its `installPath` + `/dist/cli.js`.

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

## Troubleshooting Workflow

### Diagnose — Find matching TSGs

```bash
node dist/cli.js tsg diagnose --project-dir=/path/to/project --symptoms='["pod keeps restarting","OOMKilled"]' --category=deployment
```

Returns matched TSGs with recommended diagnostic steps.

### Analyze — Analyze diagnostic output

```bash
node dist/cli.js tsg analyze --output="<paste diagnostic output>" --tsgId=tsg-deployment-001 --stepId=check-pod-status
```

Matches patterns from TSG analysis rules to identify root causes.

### Suggest — Get resolution steps

```bash
node dist/cli.js tsg suggest --tsgId=tsg-deployment-001 --rootCause=oom --parameters='{"podName":"my-pod","namespace":"default"}'
```

Returns actionable resolution steps with resolved commands.

### Run — Full troubleshooting workflow

Chains diagnose → diagnostics → analyze → suggest in a single command:

```bash
node dist/cli.js tsg run --symptoms='["pod keeps restarting"]' --category=deployment --parameters='{"podName":"my-pod"}'
```

With diagnostic output for analysis:

```bash
node dist/cli.js tsg run --symptoms='["pod keeps restarting"]' --output="OOMKilled" --parameters='{"podName":"my-pod"}'
```

Returns the best-matching TSG with prepared diagnostic steps. When `--output` is provided, also analyzes the output for root cause matches and suggests resolutions.

## Tips

- Use `run` for an end-to-end troubleshooting pass in one call
- Start with `diagnose` to find the right TSG
- Use `execute` to run individual diagnostic steps
- Use `analyze` to process diagnostic output
- Use `suggest` when you've identified the root cause
