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

## Usage

```bash
node dist/cli.js work-items plan <id>
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

Use `/task-plan` to break down a work item into child items following the ADO hierarchy (Epic → Feature → User Story → Task).
