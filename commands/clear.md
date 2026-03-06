---
name: ado-claude-code:clear
description: Clear all synced work items from local storage
arguments:
  - name: confirm
    description: "Actually delete files; without this flag, only a dry-run summary is shown"
    required: false
---

# ADO Clear Synced Items

Remove all locally synced work items and reset sync state.

**IMPORTANT:** Always pass `--project-dir=<user's project root>` so the correct project's `.claude/` directory is cleared, not the plugin's.

## Usage

```bash
node dist/cli.js clear --project-dir=/path/to/project [--confirm]
```

## Behavior

1. Loads sync state and reports the status of all tracked items (synced, localModified, conflict, remoteModified counts).
2. Without `--confirm`, outputs the status summary and exits **without deleting anything** (dry-run).
3. With `--confirm`, deletes every synced YAML file and resets sync state.

## Flags

- `--confirm` — Required to actually delete files. Without it, only a summary is shown.

## Examples

Preview what would be cleared:
```bash
node dist/cli.js clear
```

Clear all synced items:
```bash
node dist/cli.js clear --confirm
```
