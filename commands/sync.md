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
  - name: all
    description: "Sync all items assigned to the current user regardless of state (optional)"
    required: false
---

# ADO Work Item Sync

Synchronize work items between Azure DevOps and local YAML storage.

**IMPORTANT:** The CLI is at `dist/cli.js` within the plugin's install directory. To find it, read `~/.claude/plugins/installed_plugins.json`, look up `ado-claude-code@ado-claude-code`, and use its `installPath` + `/dist/cli.js`.

**IMPORTANT:** Always pass `--project-dir=<user's project root>` so data is stored in the project's `.claude/` directory, not the plugin's.

## Usage

Run the sync CLI to pull, push, or perform a full bidirectional sync.

```bash
node dist/cli.js sync pull --project-dir=/path/to/project [--ids=1234,5678] [--query="SELECT ..."] [--mine] [--all]
node dist/cli.js sync push --project-dir=/path/to/project [--ids=1234,5678]
node dist/cli.js sync full --project-dir=/path/to/project [--query="SELECT ..."] [--mine] [--all]
```

## Directions

- **pull** — Download work items from Azure DevOps to local YAML files. Defaults to pulling active items assigned to the current user when no flags are provided. Can be narrowed with `--ids`, `--query`, or `--mine`. Use `--all` to include items in any state (Closed, Completed, Removed, etc.). Automatically pushes locally modified items first to prevent overwriting local edits.
- **push** — Upload locally modified work items to Azure DevOps. Optionally filter with `--ids`.
- **full** — Bidirectional sync: push local changes then pull. Defaults to the current user's active items when no flags are provided. Can be narrowed with `--query` or `--mine`. Use `--all` to include items in any state.

## Flags

- `--ids=1234,5678` — Comma-separated work item IDs to sync.
- `--query="SELECT ..."` — WIQL query to select items for pull/full.
- `--mine` — Shorthand for pulling all active (non-Closed, non-Removed, non-Completed, non-Done) items assigned to the current user. Cannot be combined with `--query` or `--all`. This is the default behavior for `pull` and `full` when no flags are provided.
- `--all` — Pull all items assigned to the current user regardless of state (includes Closed, Completed, Done, Removed). Cannot be combined with `--mine` or `--query`.

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

Pull all my items (including Closed/Completed):
```bash
node dist/cli.js sync pull --all
```

Full sync all my items (including Closed/Completed):
```bash
node dist/cli.js sync full --all
```

Full sync with custom query:
```bash
node dist/cli.js sync full --query="SELECT [System.Id] FROM WorkItems WHERE [System.TeamProject] = @project"
```

After syncing, work items are stored as YAML files in `.claude/ado/work-items/` organized by type (epics, features, user-stories, tasks, bugs).
