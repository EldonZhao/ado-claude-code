---
name: plan
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
---

# ADO Work Item Planning

AI-assisted breakdown of work items following the ADO hierarchy: Epic -> Feature -> User Story -> Task.

## Usage

### Step 1: Get guidance for breaking down a work item

```bash
node dist/cli.js work-items plan 1234
```

This fetches the parent work item and returns guidance on how to break it down.

### Step 2: Preview a breakdown proposal

```bash
node dist/cli.js work-items plan 1234 --items='[{"type":"User Story","title":"As a user, I want...","description":"...","priority":2}]'
```

### Step 3: Create the items in ADO

```bash
node dist/cli.js work-items plan 1234 --items='[...]' --create
```

## Hierarchy

- **Epic** breaks down into **Features**
- **Feature** breaks down into **User Stories**
- **User Story** breaks down into **Tasks**
- **Bug** breaks down into **Tasks**

## Workflow

1. Call without `--items` to get guidance and the parent work item context
2. Use the guidance to propose child items
3. Call with `--items` to preview the proposal
4. Call with `--items --create` to create them in Azure DevOps
