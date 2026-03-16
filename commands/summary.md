---
name: ado-claude-code:summary
description: Summarize Azure DevOps progress over a time period (week/month)
arguments:
  - name: period
    description: "Time period: week (default) or month"
    required: false
  - name: assignedTo
    description: "Filter by assignee email"
    required: false
---

# ADO Progress Summary

Generate a human-readable summary of Azure DevOps work item activity over a time period.

**IMPORTANT:** The CLI is at `dist/cli.js` within the plugin's install directory. To find it, read `~/.claude/plugins/installed_plugins.json`, look up `ado-claude-code@ado-claude-code`, and use its `installPath` + `/dist/cli.js`.

**IMPORTANT:** Always pass `--project-dir=<user's project root>` so the correct project's `.claude/` config is used, not the plugin's.

## Usage

```bash
node dist/cli.js workitems summary --project-dir=/path/to/project [--period=week|month] [--assignedTo=user@example.com] [--query="WIQL override"]
```

## Flags

- `--period=week` (default) — Items changed in the last 7 days
- `--period=month` — Items changed in the last 30 days
- `--assignedTo=user@example.com` — Filter to a specific assignee
- `--query="SELECT ..."` — Override the WIQL query entirely

## Workflow

1. Run the CLI command above to get structured JSON output
2. Parse the JSON output which contains:
   - `summary.completed` — Items in Done/Closed/Completed/Resolved states
   - `summary.inProgress` — Items in Active/In Progress/Committed states
   - `summary.blocked` — Items in Blocked state or open Bugs
   - `summary.new` — Items in New/To Do/Proposed/Approved states
   - Each category has `groups` where items are grouped by their parent Feature/Epic
3. Generate a **human-readable summary** from the JSON with these sections:

### Output Format

Write the summary in this structure:

**Key Achievements** (from `summary.completed`)
- List completed items grouped by parent feature
- Highlight major state transitions and milestones

**In Progress** (from `summary.inProgress`)
- List active work grouped by parent feature
- Include latest comment context when available

**Blockers / Risks** (from `summary.blocked`)
- List blocked items and open bugs
- Flag items that appear stuck (no recent comments, long time in same state)

**New / Upcoming** (from `summary.new`)
- List newly created or proposed items

**Statistics**
- Total items: N
- Completed: N | In Progress: N | Blocked: N | New: N

Use bullet points, group items under their parent Feature when available, and keep the tone professional and concise.

## Example

```bash
node dist/cli.js workitems summary --project-dir=/home/user/myproject --period=week
```
