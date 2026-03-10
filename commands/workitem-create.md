---
name: ado-claude-code:workitem-create
description: Create a work item in Azure DevOps and save it locally
arguments:
  - name: type
    description: "Work item type: Task, Bug, User Story, Feature, or Epic"
    required: true
  - name: title
    description: "Work item title"
    required: true
  - name: description
    description: "Work item description (optional)"
    required: false
  - name: assignedTo
    description: "Assigned user email or display name (optional)"
    required: false
  - name: priority
    description: "Priority 1-4 (optional)"
    required: false
  - name: parentId
    description: "Parent work item ID to link as child (optional)"
    required: false
  - name: json
    description: "Full JSON input for all fields (optional, alternative to individual flags)"
    required: false
---

# Create ADO Work Item

Create a new work item in Azure DevOps and automatically save it to local YAML storage.

**IMPORTANT:** The CLI is at `dist/cli.js` within the plugin's install directory. To find it, read `~/.claude/plugins/installed_plugins.json`, look up `ado-claude-code@ado-claude-code`, and use its `installPath` + `/dist/cli.js`.

**IMPORTANT:** Always pass `--project-dir=<user's project root>` so the item is saved in the project's `.claude/` directory, not the plugin's.

## Usage

```bash
node dist/cli.js work-items create --project-dir=/path/to/project --type=<type> --title=<title> [flags]
```

## Flags

- `--type` — Work item type: `Task`, `Bug`, `User Story`, `Feature`, `Epic`
- `--title` — Work item title (required)
- `--description` — Detailed description
- `--assignedTo` — Assigned user (email or display name)
- `--areaPath` — Area path
- `--iterationPath` — Iteration path
- `--priority` — Priority level (1–4)
- `--storyPoints` — Story points estimate
- `--parentId` — Parent work item ID (creates a child link)
- `--customFields` — JSON object of custom field key-value pairs
- `--json` — Full JSON input (bypasses individual flags)

## Examples

Create a Task:
```bash
node dist/cli.js work-items create --type=Task --title="Implement login API" --priority=2
```

Create a Bug with description:
```bash
node dist/cli.js work-items create --type=Bug --title="Login fails on empty password" --description="Submit with blank password returns 500" --priority=1
```

Create a Bug with a custom Product Impact value (overrides config default):
```bash
node dist/cli.js work-items create --type=Bug --title="Critical crash" --priority=1 --customFields='{"Custom.ProductImpact":"1 - Critical"}'
```

Create a User Story assigned to someone:
```bash
node dist/cli.js work-items create --type="User Story" --title="As a user, I want to reset my password" --assignedTo="user@example.com"
```

Create a Task under a parent User Story:
```bash
node dist/cli.js work-items create --type=Task --title="Add password reset endpoint" --parentId=1234
```

Create with full JSON input:
```bash
node dist/cli.js work-items create --json='{"type":"Feature","title":"Dark mode","description":"Add dark mode support","priority":3}'
```

The created work item is saved locally to `.claude/ado/work-items/` as a YAML file.

## Type Defaults

You can configure default custom fields per work item type in `.claude/.ado-config.yaml` under the `defaults` key. These are automatically applied when creating work items of that type. Explicit `--customFields` values override defaults.

```yaml
defaults:
  Bug:
    customFields:
      Custom.ProductImpact: "3 - Medium"
```

This ensures Bug creation succeeds in ADO projects that require the `Custom.ProductImpact` field.
