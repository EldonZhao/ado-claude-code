---
name: ado-claude-code:tsg-create
description: Create or manage Troubleshooting Guides (TSGs)
arguments:
  - name: action
    description: "Action: create, get, update, list, search, or execute"
    required: true
  - name: id
    description: "TSG ID (for get, update, execute)"
    required: false
  - name: data
    description: "JSON data for create/update operations"
    required: false
---

# TSG Management

Create and manage structured Troubleshooting Guides.

## Create a TSG

```bash
node dist/cli.js tsg create --title="Pod OOM" --category=deployment --tags='["oom","kubernetes"]' --symptoms='["pod keeps restarting","OOMKilled in events"]'
```

For full TSG with diagnostics and resolutions, pass JSON:
```bash
node dist/cli.js tsg create --json='{"title":"...","category":"...","diagnostics":[...],"resolutions":{...}}'
```

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
