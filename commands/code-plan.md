---
name: ado-claude-code:code-plan
description: Generate a code implementation plan from an Azure DevOps work item
arguments:
  - name: id
    description: "Work item ID to generate a code plan for"
    required: true
---

# ADO Code Plan

Generate a code implementation plan from any Azure DevOps work item. Works for all work item types: Epic, Feature, User Story, Task, and Bug.

**IMPORTANT:** The CLI is at `dist/cli.js` within the plugin's install directory. To find it, read `~/.claude/plugins/installed_plugins.json`, look up `ado-claude-code@ado-claude-code`, and use its `installPath` + `/dist/cli.js`.

**IMPORTANT:** Always pass `--project-dir=<user's project root>` so the correct project's `.claude/` config is used, not the plugin's.

## Usage

```bash
node dist/cli.js work-items plan --project-dir=/path/to/project <id> [--no-update]
```

## Flags

- `--no-update` — Skip automatic state transition and comment. Only generates the code plan.

## Side Effects

When invoked without `--no-update`, this command will:

1. **Set state to "In Progress"** — If the work item is in "New", "To Do", "Proposed", or "Approved" state.
2. **Add a comment** — Posts the full code plan guidance text (including work item context, description, and implementation instructions) to the work item.

Both updates are non-blocking: if either fails, the code plan is still returned.

## Bidirectional Sync

When invoked, `code-plan` checks if the local work item YAML file has been modified since the last sync. If local changes are detected and there are no conflicting remote changes, the local edits (title, description, state, assignedTo, etc.) are **pushed to ADO first** before fetching. This ensures any local edits you make to the YAML file are reflected in ADO.

If the push fails (e.g., permissions, conflict), the plan still proceeds normally — the push is non-blocking.

## Progress Updates

During implementation, post progress updates to the work item using comments. This keeps the ADO work item as a single source of truth for stakeholders.

### When to Update

1. **Starting implementation** — Post which files will be modified and the approach
2. **After completing a major step** — Post what was done (files changed, features implemented)
3. **When encountering blockers** — Post blockers and workarounds attempted
4. **On completion** — Post final summary and mark the work item complete

### How to Update

Use `work-items update <id> --comment="<html>"` with structured HTML:

```bash
# Mid-session progress update
node dist/cli.js work-items update --project-dir=/path/to/project <id> --comment="<h4>Progress Update</h4><p><em>2026-03-11T10:00:00Z</em></p><ul><li>Modified <code>src/foo.ts</code> — added validation logic</li><li>Updated <code>tests/foo.test.ts</code> — 3 new test cases</li></ul><p><strong>Next:</strong> Integration testing</p>"

# Final completion with summary
node dist/cli.js work-items update --project-dir=/path/to/project <id> --complete --comment="<h4>Implementation Complete</h4><ul><li>Added bidirectional sync in <code>handlePlan</code></li><li>Fixed <code>--complete --comment</code> merge</li><li>All tests passing (12 new tests)</li></ul>"
```

### Example Lifecycle

```
1. /code-plan 12345              → Fetches item, pushes local edits, generates plan, posts initial comment
2. (Claude implements step 1)
3. work-items update 12345 --comment="<h4>Progress Update</h4>..."   → Posts mid-session update
4. (Claude implements step 2)
5. work-items update 12345 --comment="<h4>Progress Update</h4>..."   → Posts another update
6. work-items update 12345 --complete --comment="<h4>Implementation Complete</h4>..."  → Marks done with summary
```

This fetches the work item and returns structured guidance for Claude to analyze the codebase and produce an implementation plan including:

1. **Files to analyze** — Existing files relevant to the change
2. **Architectural approach** — How the change fits the codebase
3. **Files to modify or create** — Specific files with change summaries
4. **Step-by-step changes** — Ordered implementation steps
5. **Testing suggestions** — Unit, integration, or manual verification
6. **Edge cases and risks** — Potential issues and gotchas

## Example

```bash
node dist/cli.js work-items plan 415156
```

## See Also

Use `/workitem-plan` to break down a work item into child items following the ADO hierarchy (Epic → Feature → User Story → Task → Task).
