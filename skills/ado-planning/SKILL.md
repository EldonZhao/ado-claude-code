---
name: ado-planning
description: Work item breakdown hierarchy, estimation guidance, and planning best practices
---

# Work Item Planning

## Breakdown Hierarchy

| Parent Type | Child Type | Guidelines |
|-------------|------------|------------|
| Epic | Feature | Independent, deliverable capabilities. Each provides distinct user value. |
| Feature | User Story | Follow INVEST: Independent, Negotiable, Valuable, Estimable, Small, Testable. Use "As a [role], I want [goal], so that [benefit]" format. |
| User Story | Task | Concrete, actionable. Completable by one person. Include implementation details and definition of done. |
| Bug | Task | Steps to investigate, reproduce, fix, and verify. |

## Planning Process

### Step 1: Fetch the parent work item
Get the full context of the item to break down — title, description, acceptance criteria.

### Step 2: Get guidance
Call the plan command without items to receive hierarchy-specific guidance and the parent's details.

### Step 3: Generate proposal
Create child items based on the guidance. Each item needs:
- **type** — Must match the expected child type
- **title** — Clear, specific title
- **description** — Implementation details or user story format
- **priority** — 1 (Critical) to 4 (Low)
- **storyPoints** — Effort estimate (optional)

### Step 4: Preview
Call the plan command with items but without --create to validate and preview.

### Step 5: Create in ADO
Call with --create to create the items in Azure DevOps with parent links.

## Estimation Guidelines

### Story Points (Fibonacci)
- **1** — Trivial, well-understood change
- **2** — Small, straightforward work
- **3** — Medium, some complexity
- **5** — Large, significant effort
- **8** — Very large, considerable complexity
- **13** — Too large, should be broken down further

### Priority
- **1 (Critical)** — Must be done immediately, blocks other work
- **2 (High)** — Important, should be done soon
- **3 (Medium)** — Normal priority
- **4 (Low)** — Nice to have, do when time permits

## Best Practices

1. Each child should be independently deliverable
2. Avoid creating more than 8-10 children per parent
3. Ensure descriptions include acceptance criteria
4. Set realistic story points — if >8, break it down further
5. Maintain consistent naming within a feature's children
6. Link related items across features when there are dependencies
