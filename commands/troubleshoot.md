---
name: ado-claude-code:troubleshoot
description: Diagnose issues, analyze output, and suggest resolutions using TSGs
arguments:
  - name: action
    description: "Action: diagnose, analyze, or suggest"
    required: true
  - name: symptoms
    description: "JSON array of symptom strings (for diagnose)"
    required: false
  - name: output
    description: "Diagnostic command output to analyze (for analyze)"
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

## Workflow

### 1. Diagnose — Find matching TSGs

```bash
node dist/cli.js troubleshoot diagnose --symptoms='["pod keeps restarting","OOMKilled"]' --category=deployment
```

Returns matched TSGs with recommended diagnostic steps.

### 2. Analyze — Analyze diagnostic output

```bash
node dist/cli.js troubleshoot analyze --output="<paste diagnostic output>" --tsgId=tsg-deployment-001 --stepId=check-pod-status
```

Matches patterns from TSG analysis rules to identify root causes.

### 3. Suggest — Get resolution steps

```bash
node dist/cli.js troubleshoot suggest --tsgId=tsg-deployment-001 --rootCause=oom --parameters='{"podName":"my-pod","namespace":"default"}'
```

Returns actionable resolution steps with resolved commands.

## Tips

- Start with `diagnose` to find the right TSG
- Use `tsg execute` to run individual diagnostic steps
- Use `analyze` to process diagnostic output
- Use `suggest` when you've identified the root cause
