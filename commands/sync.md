---
name: sync
description: Sync work items between Azure DevOps and local storage
arguments:
  - name: direction
    description: "Sync direction: pull, push, or full"
    required: true
  - name: ids
    description: "Comma-separated work item IDs (optional)"
    required: false
  - name: query
    description: "WIQL query for pull/full (optional)"
    required: false
---

# ADO Work Item Sync

Synchronize work items between Azure DevOps and local YAML storage.

## Usage

Run the sync CLI to pull, push, or perform a full bidirectional sync.

```bash
node dist/cli.js sync pull [--ids=1234,5678] [--query="SELECT ..."]
node dist/cli.js sync push [--ids=1234,5678]
node dist/cli.js sync full [--query="SELECT ..."]
```

## Directions

- **pull** — Download work items from Azure DevOps to local YAML files. Requires `--ids` or `--query`.
- **push** — Upload locally modified work items to Azure DevOps. Optionally filter with `--ids`.
- **full** — Bidirectional sync: pull then push. Requires `--query`.

## Examples

Pull specific items:
```bash
node dist/cli.js sync pull --ids=1234,5678
```

Pull all active items:
```bash
node dist/cli.js sync pull --query="SELECT [System.Id] FROM WorkItems WHERE [System.State] = 'Active'"
```

Push all local changes:
```bash
node dist/cli.js sync push
```

Full sync:
```bash
node dist/cli.js sync full --query="SELECT [System.Id] FROM WorkItems WHERE [System.TeamProject] = @project"
```

After syncing, work items are stored as YAML files in `.claude/ado/work-items/` organized by type (epics, features, user-stories, tasks, bugs).
