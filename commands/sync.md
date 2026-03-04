---
name: ado-claude-code:sync
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
  - name: mine
    description: "Sync active items assigned to the current user (optional)"
    required: false
---

# ADO Work Item Sync

Synchronize work items between Azure DevOps and local YAML storage.

## Usage

Run the sync CLI to pull, push, or perform a full bidirectional sync.

```bash
node dist/cli.js sync pull [--ids=1234,5678] [--query="SELECT ..."] [--mine]
node dist/cli.js sync push [--ids=1234,5678]
node dist/cli.js sync full [--query="SELECT ..."] [--mine]
```

## Directions

- **pull** — Download work items from Azure DevOps to local YAML files. Defaults to pulling active items assigned to the current user when no flags are provided. Can be narrowed with `--ids`, `--query`, or `--mine`. Automatically pushes locally modified items first to prevent overwriting local edits.
- **push** — Upload locally modified work items to Azure DevOps. Optionally filter with `--ids`.
- **full** — Bidirectional sync: push local changes then pull. Defaults to the current user's active items when no flags are provided. Can be narrowed with `--query` or `--mine`.

## Flags

- `--ids=1234,5678` — Comma-separated work item IDs to sync.
- `--query="SELECT ..."` — WIQL query to select items for pull/full.
- `--mine` — Shorthand for pulling all active (non-Closed, non-Removed, non-Completed) items assigned to the current user. Cannot be combined with `--query`. This is the default behavior for `pull` and `full` when no flags are provided.

## Examples

Pull specific items:
```bash
node dist/cli.js sync pull --ids=1234,5678
```

Pull all active items:
```bash
node dist/cli.js sync pull --query="SELECT [System.Id] FROM WorkItems WHERE [System.State] = 'Active'"
```

Pull my active items:
```bash
node dist/cli.js sync pull --mine
```

Push all local changes:
```bash
node dist/cli.js sync push
```

Full sync for my items:
```bash
node dist/cli.js sync full --mine
```

Full sync with custom query:
```bash
node dist/cli.js sync full --query="SELECT [System.Id] FROM WorkItems WHERE [System.TeamProject] = @project"
```

After syncing, work items are stored as YAML files in `.claude/ado/work-items/` organized by type (epics, features, user-stories, tasks, bugs).
