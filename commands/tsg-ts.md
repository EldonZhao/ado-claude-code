---
name: ado-claude-code:tsg-ts
description: Diagnose issues, analyze output, suggest resolutions, or run a full troubleshooting workflow using TSGs
arguments:
  - name: action
    description: "Action: diagnose, analyze, suggest, or run"
    required: true
  - name: symptoms
    description: "JSON array of symptom strings (for diagnose/run)"
    required: false
  - name: output
    description: "Diagnostic command output to analyze (for analyze/run)"
    required: false
  - name: tsgId
    description: "TSG ID for context"
    required: false
  - name: rootCause
    description: "Identified root cause key (for suggest)"
    required: false
---

# Troubleshooting

AI-assisted troubleshooting workflow using Troubleshooting Guides (TSGs).

**IMPORTANT:** The CLI is at `dist/cli.js` within the plugin's install directory. To find it, read `~/.claude/plugins/installed_plugins.json`, look up `ado-claude-code@ado-claude-code`, and use its `installPath` + `/dist/cli.js`.

**IMPORTANT:** Always pass `--project-dir=<user's project root>` so the correct project's TSGs are used, not the plugin's.

## Workflow

### 1. Diagnose — Find matching TSGs

```bash
node dist/cli.js tsg ts diagnose --project-dir=/path/to/project --symptoms='["pod keeps restarting","OOMKilled"]' --category=deployment
```

Returns matched TSGs with recommended diagnostic steps.

### 2. Analyze — Analyze diagnostic output

```bash
node dist/cli.js tsg ts analyze --output="<paste diagnostic output>" --tsgId=tsg-deployment-001 --stepId=check-pod-status
```

Matches patterns from TSG analysis rules to identify root causes.

### 3. Suggest — Get resolution steps

```bash
node dist/cli.js tsg ts suggest --tsgId=tsg-deployment-001 --rootCause=oom --parameters='{"podName":"my-pod","namespace":"default"}'
```

Returns actionable resolution steps with resolved commands.

### 4. Run — Full troubleshooting workflow

Chains diagnose → diagnostics → analyze → suggest in a single command:

```bash
node dist/cli.js tsg ts run --symptoms='["pod keeps restarting"]' --category=deployment --parameters='{"podName":"my-pod"}'
```

With diagnostic output for analysis:

```bash
node dist/cli.js tsg ts run --symptoms='["pod keeps restarting"]' --output="OOMKilled" --parameters='{"podName":"my-pod"}'
```

Returns the best-matching TSG with prepared diagnostic steps. When `--output` is provided, also analyzes the output for root cause matches and suggests resolutions.

## Tips

- Use `run` for an end-to-end troubleshooting pass in one call
- Start with `diagnose` to find the right TSG
- Use `tsg execute` to run individual diagnostic steps
- Use `analyze` to process diagnostic output
- Use `suggest` when you've identified the root cause
