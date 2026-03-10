---
name: ado-claude-code:workitem-plan
description: Break down an Azure DevOps work item into child items using AI-assisted planning
arguments:
  - name: id
    description: "Parent work item ID to break down"
    required: true
  - name: items
    description: "JSON array of proposed child items (optional — omit to get guidance)"
    required: false
  - name: create
    description: "Whether to create items in ADO (true/false, default: false)"
    required: false
  - name: complete
    description: "Transition work item to terminal state (Done/Closed) after creating items (default: false)"
    required: false
  - name: no-update
    description: "Skip automatic state transition and comment (default: false)"
    required: false
---

# ADO Work Item Breakdown

AI-assisted breakdown of work items following the ADO hierarchy: Epic -> Feature -> User Story -> Task -> Task (sub-tasks).

**IMPORTANT:** The CLI is at `dist/cli.js` within the plugin's install directory. To find it, read `~/.claude/plugins/installed_plugins.json`, look up `ado-claude-code@ado-claude-code`, and use its `installPath` + `/dist/cli.js`.

**IMPORTANT:** Always pass `--project-dir=<user's project root>` so data is stored in the project's `.claude/` directory, not the plugin's.

## Usage

### Step 1: Get guidance for breaking down a work item

```bash
node dist/cli.js work-items workitem-plan --project-dir=/path/to/project 1234
```

This fetches the parent work item and returns guidance on how to break it down.

### Step 2: Preview a breakdown proposal

```bash
node dist/cli.js work-items workitem-plan 1234 --items='[{"type":"User Story","title":"As a user, I want...","description":"...","priority":2}]'
```

### Step 3: Create the items in ADO

```bash
node dist/cli.js work-items workitem-plan 1234 --items='[...]' --create
```

## Hierarchy

- **Epic** breaks down into **Features**
- **Feature** breaks down into **User Stories**
- **User Story** breaks down into **Tasks**
- **Task** breaks down into **Tasks** (sub-tasks)
- **Bug** breaks down into **Tasks**

## Flags

- `--complete` — Transition the work item to its terminal state (e.g., Done, Closed). Works standalone or with `--items --create`.
- `--no-update` — Skip automatic state transition and comment. Only generates the breakdown guidance.

## Side Effects

When invoked without `--no-update`, this command will:

1. **Set state to "In Progress"** — If the work item is in "New", "To Do", "Proposed", or "Approved" state.
2. **Add a comment** — Posts breakdown plan details to the work item.

When creating child items (with `--create`), a summary comment listing created items is also posted.

Both updates are non-blocking: if either fails, the breakdown guidance is still returned.

## Workflow

1. Call without `--items` to get guidance and the parent work item context
2. Use the guidance to propose child items
3. Call with `--items` to preview the proposal
4. Call with `--items --create` to create them in Azure DevOps

## See Also

Use `/code-plan` to generate a code implementation plan for any work item type.
