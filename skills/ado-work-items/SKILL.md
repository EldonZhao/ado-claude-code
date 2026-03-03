---
name: ado-work-items
description: Azure DevOps work item types, hierarchy, states, and field mappings
---

# Azure DevOps Work Items

## Work Item Types

| Type | Description | Hierarchy Level |
|------|-------------|-----------------|
| Epic | Large business initiative | Top |
| Feature | Deliverable capability | Epic child |
| User Story | User-facing requirement | Feature child |
| Task | Concrete implementation work | Story/Bug child |
| Bug | Defect to fix | Same level as Story |

## Hierarchy

- **Epic** → Feature
- **Feature** → User Story
- **Bug** → Task
- **User Story** → Task
- **Task** → (leaf node, no children)

## Standard States

Common states across work item types:
- **New** — Just created
- **Active** — Work in progress
- **Resolved** — Work done, pending verification
- **Closed** — Verified and done
- **Removed** — Deleted/cancelled

## Key Fields

| Field | Path | Description |
|-------|------|-------------|
| Title | System.Title | Work item title |
| State | System.State | Current state |
| Assigned To | System.AssignedTo | Assignee |
| Area Path | System.AreaPath | Team/area |
| Iteration Path | System.IterationPath | Sprint/iteration |
| Priority | Microsoft.VSTS.Common.Priority | 1 (Critical) to 4 (Low) |
| Story Points | Microsoft.VSTS.Scheduling.StoryPoints | Effort estimate |
| Description | System.Description | HTML description |

## Local Storage

Work items are stored as YAML files in `data/work-items/` organized by type:
- `data/work-items/epics/`
- `data/work-items/features/`
- `data/work-items/user-stories/`
- `data/work-items/tasks/`
- `data/work-items/bugs/`

Each file is named `{id}.yaml` and contains the work item fields plus sync metadata (rev, syncedAt).

## WIQL (Work Item Query Language)

WIQL is SQL-like for querying ADO work items:
```sql
SELECT [System.Id], [System.Title], [System.State]
FROM WorkItems
WHERE [System.TeamProject] = @project
  AND [System.WorkItemType] = 'User Story'
  AND [System.State] = 'Active'
ORDER BY [Microsoft.VSTS.Common.Priority] ASC
```
