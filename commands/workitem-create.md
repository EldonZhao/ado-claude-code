---
name: ado-claude-code:workitem-create
description: Create a work item in Azure DevOps and save it locally
arguments:
  - name: type
    description: "Work item type: Task, Bug, User Story, Feature, or Epic"
    required: true
  - name: summary
    description: "Brief user description that Claude refines into a proper title and description"
    required: false
  - name: title
    description: "Explicit work item title (bypasses refinement)"
    required: false
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

## Input Resolution

Follow this decision flow to determine the title and description:

1. **`title` provided** → use it directly as the work item title. If `description` is missing, generate one using the type-specific template below.
2. **Only `summary` provided** → generate BOTH a refined title and a description per the type-specific rules below.
3. **Neither `summary` nor `title`** → ask the user what they want to create.
4. **Both `summary` and `title`** → use the explicit `title`; use `summary` as context to generate the description if `description` is not provided.

## Title and Description Refinement Rules

When generating a title or description from a `summary`, apply the type-specific rules below. Use `[To be determined]` for any details not inferable from the summary — never invent specifics.

### Bug

**Title format:** `[Area] Symptom statement`
- DO: `[Auth] Login returns 500 on empty password`
- DO: `[API] GET /users returns stale cached results after update`
- DON'T: `Fix login bug`
- DON'T: `Something is wrong with auth`

**Description template (HTML):**
```html
<h3>Repro Steps</h3>
<ol>
<li>[Step 1]</li>
<li>[Step 2]</li>
</ol>
<h3>Expected Behavior</h3>
<p>[What should happen]</p>
<h3>Actual Behavior</h3>
<p>[What actually happens]</p>
<h3>Impact</h3>
<p>[User/system impact]</p>
```

### User Story

**Title format:** `As a [role], I want [goal], so that [benefit]`
- DO: `As a user, I want to reset my password via email, so that I can regain access without contacting support`
- DO: `As an admin, I want to bulk-deactivate users, so that I can manage offboarding efficiently`
- DON'T: `Password reset feature`
- DON'T: `User wants to change password`

**Description template (HTML):**
```html
<h3>Acceptance Criteria</h3>
<ul>
<li><b>GIVEN</b> [context] <b>WHEN</b> [action] <b>THEN</b> [outcome]</li>
<li><b>GIVEN</b> [context] <b>WHEN</b> [action] <b>THEN</b> [outcome]</li>
</ul>
<h3>Out of Scope</h3>
<ul>
<li>[What is explicitly excluded]</li>
</ul>
```

### Task

**Title format:** Action verb phrase — `Implement X`, `Add Y`, `Configure Z`
- DO: `Implement rate limiting on /api/auth endpoints`
- DO: `Add retry logic to blob storage upload`
- DON'T: `Rate limiting`
- DON'T: `Auth endpoint work`

**Description template (HTML):**
```html
<h3>Completion Criteria</h3>
<ul>
<li>[Criterion 1]</li>
<li>[Criterion 2]</li>
</ul>
<h3>Technical Notes</h3>
<p>[Implementation context, constraints, or references]</p>
```

### Feature

**Title format:** Capability noun phrase
- DO: `Dark Mode Support for Web Dashboard`
- DO: `Multi-tenant Workspace Isolation`
- DON'T: `Add dark mode`
- DON'T: `Make it work for multiple tenants`

**Description template (HTML):**
```html
<h3>Overview</h3>
<p>[What this feature provides]</p>
<h3>Scope</h3>
<ul>
<li>[In-scope item 1]</li>
<li>[In-scope item 2]</li>
</ul>
<h3>Goals</h3>
<ul>
<li>[Goal 1]</li>
<li>[Goal 2]</li>
</ul>
<h3>Success Metrics</h3>
<ul>
<li>[Metric 1]</li>
</ul>
```

### Epic

**Title format:** Strategic initiative
- DO: `Platform Migration to Kubernetes`
- DO: `Customer Self-Service Portal`
- DON'T: `Move to k8s`
- DON'T: `Self-service stuff`

**Description template (HTML):**
```html
<h3>Strategic Context</h3>
<p>[Why this initiative matters]</p>
<h3>Deliverables</h3>
<ul>
<li>[Deliverable 1]</li>
<li>[Deliverable 2]</li>
</ul>
<h3>Dependencies &amp; Risks</h3>
<ul>
<li>[Dependency or risk 1]</li>
</ul>
```

## Workflow

1. Determine the work item type from the `type` argument.
2. Resolve the title and description using the **Input Resolution** rules above.
3. If refinement was performed (i.e., `summary` was used to generate title/description), **present the refined title and description to the user for confirmation before creating**. Ask if they want to proceed or adjust.
4. Once confirmed (or if using explicit `title`), call the CLI with `--title` and `--description`.

## Usage

```bash
node dist/cli.js workitems create --project-dir=/path/to/project --type=<type> --title=<title> [flags]
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

### Summary-based (Claude refines)

User invokes:
```
/workitem-create Bug "login crashes on empty password"
```

Claude refines and presents for confirmation:
> **Title:** [Auth] Login returns 500 when password field is empty
>
> **Description:**
> ### Repro Steps
> 1. Navigate to login page
> 2. Enter a valid username
> 3. Leave password field empty and click Submit
>
> ### Expected Behavior
> Validation error shown to the user
>
> ### Actual Behavior
> Server returns HTTP 500
>
> ### Impact
> [To be determined]
>
> Proceed with creation?

After user confirms, Claude runs:
```bash
node dist/cli.js workitems create --type=Bug --title="[Auth] Login returns 500 when password field is empty" --description="<h3>Repro Steps</h3><ol><li>Navigate to login page</li>..." --priority=1
```

### Explicit title (pass-through)

```bash
node dist/cli.js workitems create --type=Task --title="Add password reset endpoint" --priority=2
```

### Assigned User Story

```bash
node dist/cli.js workitems create --type="User Story" --title="As a user, I want to reset my password" --assignedTo="user@example.com"
```

### Child Task under parent

```bash
node dist/cli.js workitems create --type=Task --title="Add password reset endpoint" --parentId=1234
```

### Custom fields

```bash
node dist/cli.js workitems create --type=Bug --title="Critical crash" --priority=1 --customFields='{"Custom.ProductImpact":"1 - Critical"}'
```

### Full JSON input

```bash
node dist/cli.js workitems create --json='{"type":"Feature","title":"Dark mode","description":"Add dark mode support","priority":3}'
```

The created work item is saved locally to `.claude/ado/workitems/` as a YAML file.

## Type Defaults

You can configure default custom fields per work item type in `.claude/.ado-config.yaml` under the `defaults` key. These are automatically applied when creating work items of that type. Explicit `--customFields` values override defaults.

```yaml
defaults:
  Bug:
    customFields:
      Custom.ProductImpact: "3 - Medium"
```

This ensures Bug creation succeeds in ADO projects that require the `Custom.ProductImpact` field.
