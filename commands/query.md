---
name: ado-claude-code:query
description: Query Azure DevOps work items via WIQL or list local items
arguments:
  - name: action
    description: "Action: query (WIQL) or list (local)"
    required: true
  - name: wiql
    description: "WIQL query string (for 'query' action)"
    required: false
  - name: type
    description: "Filter by work item type (for 'list' action)"
    required: false
  - name: state
    description: "Filter by state (for 'list' action)"
    required: false
  - name: assignedTo
    description: "Filter by assignee (for 'list' action)"
    required: false
---

# ADO Work Item Query

Query work items from Azure DevOps or list locally synced items.

**IMPORTANT:** The CLI is at `dist/cli.js` within the plugin's install directory. To find it, read `~/.claude/plugins/installed_plugins.json`, look up `ado-claude-code@ado-claude-code`, and use its `installPath` + `/dist/cli.js`.

**IMPORTANT:** Always pass `--project-dir=<user's project root>` so data is read from the project's `.claude/` directory, not the plugin's.

## Query from ADO (WIQL)

```bash
node dist/cli.js work-items query --project-dir=/path/to/project "SELECT [System.Id], [System.Title] FROM WorkItems WHERE [System.State] = 'Active'"
```

Save query results locally:
```bash
node dist/cli.js work-items query "SELECT ..." --save
```

## List local items

```bash
node dist/cli.js work-items list
node dist/cli.js work-items list --type="User Story" --state=Active
node dist/cli.js work-items list --assignedTo="user@example.com"
```

## Other work item commands

Get a specific work item:
```bash
node dist/cli.js work-items get 1234
```

Create a work item:
```bash
node dist/cli.js work-items create --type=Task --title="Fix the bug" --priority=1
```

Update a work item:
```bash
node dist/cli.js work-items update 1234 --state=Active --priority=2
```
