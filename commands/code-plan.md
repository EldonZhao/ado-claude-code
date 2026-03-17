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
node dist/cli.js workitems plan --project-dir=/path/to/project <id> [--no-update]
```

## Flags

- `--no-update` — Skip automatic state transition. Only generates the code plan.

## Side Effects

When invoked without `--no-update`, this command will:

1. **Set state to "In Progress"** — If the work item is in "New", "To Do", "Proposed", or "Approved" state.

The state update is non-blocking: if it fails, the code plan is still returned.

The CLI does not auto-post a comment. Instead, after you analyze the codebase and produce the implementation plan, you must post it to the work item yourself (see the Workflow section below).

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

Use `workitems update <id> --comment="<html>"` with structured HTML:

```bash
# Mid-session progress update
node dist/cli.js workitems update --project-dir=/path/to/project <id> --comment="<h4>Progress Update</h4><p><em>2026-03-11T10:00:00Z</em></p><ul><li>Modified <code>src/foo.ts</code> — added validation logic</li><li>Updated <code>tests/foo.test.ts</code> — 3 new test cases</li></ul><p><strong>Next:</strong> Integration testing</p>"

# Final completion with summary
node dist/cli.js workitems update --project-dir=/path/to/project <id> --complete --comment="<h4>Implementation Complete</h4><ul><li>Added bidirectional sync in <code>handlePlan</code></li><li>Fixed <code>--complete --comment</code> merge</li><li>All tests passing (12 new tests)</li></ul>"
```

### Example Lifecycle

```
1. /code-plan 12345              → Fetches item, pushes local edits, generates plan guidance, transitions to In Progress
2. (Claude analyzes codebase and produces implementation plan)
3. (Claude auto-posts plan to ADO via workitems update --comment)
4. (Claude presents plan to user, waits for confirmation)
5. (Claude implements step 1)
6. workitems update 12345 --comment="<h4>Progress Update</h4>..."   → Posts mid-session update
7. (Claude implements step 2)
8. workitems update 12345 --comment="<h4>Progress Update</h4>..."   → Posts another update
9. workitems update 12345 --complete --comment="<h4>Implementation Complete</h4>..."  → Marks done with summary
```

## Workflow

After calling the CLI, follow these steps **automatically** without waiting for user input:

1. **Read the `codePlan` guidance** from the CLI JSON output.
2. **Analyze the codebase** using the guidance — explore relevant files, understand the architecture, and identify what needs to change.
3. **Produce a concrete implementation plan** in markdown — the plan should include:
   - Files to analyze
   - Architectural approach
   - Files to modify or create
   - Step-by-step changes
   - Testing suggestions
   - Edge cases and risks
4. **Post the plan to the ADO work item** as a comment immediately after generating it:
   ```bash
   node dist/cli.js workitems update --project-dir=/path/to/project <id> --comment="<h3>Implementation Plan</h3><p><em>TIMESTAMP</em></p>PLAN_AS_HTML"
   ```
   Convert the markdown plan to HTML for the comment. This ensures the plan is visible to all stakeholders on the ADO work item.
5. **Present the plan to the user** and wait for confirmation before starting implementation.

## Example

```bash
node dist/cli.js workitems plan 415156
```

## See Also

Use `/workitem-plan` to break down a work item into child items following the ADO hierarchy (Epic → Feature → User Story → Task → Task).

## Multi-Repo Support

When `repos` is configured in `.claude/.ado-config.yaml`, the code plan automatically detects which configured repos are referenced in the work item's description or latest comment and generates per-repo guidance.

### Configuration

Add a `repos` section to `.claude/.ado-config.yaml`:

```yaml
repos:
  frontend:
    path: C:\Users\me\projects\frontend
  backend:
    path: C:\Users\me\projects\backend
  shared-lib:
    path: C:\Users\me\projects\shared-lib
```

### Detection

Repos are detected from the work item text using two patterns:

1. **Structured lists** — `- backend: Add auth middleware` or `- **backend**: Add auth middleware`
2. **Freeform mentions** — any occurrence of the repo name (word boundary match)

Structured lists extract per-repo feature descriptions. Freeform mentions flag the repo as involved but don't extract specific features.

### Current Repo Priority

The repo whose path matches your current working directory gets more detailed planning guidance (6-point plan), while other repos get abbreviated guidance (3-point summary). If you're not inside any configured repo, all repos get equal detail.
