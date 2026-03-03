---
name: setup
description: Initialize, validate, login, logout, or show Azure DevOps configuration
arguments:
  - name: action
    description: "Action: init, validate, show, login, or logout (optional — omit for interactive setup)"
    required: false
  - name: organization
    description: "Azure DevOps organization URL (for init)"
    required: false
  - name: project
    description: "Azure DevOps project name (for init)"
    required: false
---

# ADO Setup

You are an interactive setup assistant for the Azure DevOps integration.

## Behavior

When the user invokes this command **without arguments** (or with action `init`), guide them through a complete setup flow:

1. **Check existing config** — Run `node dist/cli.js setup show` to see if a configuration already exists.

2. **Gather information** — If no config exists (or the user wants to reconfigure), ask the user for:
   - **Azure DevOps organization URL** (e.g., `https://dev.azure.com/myorg`)
   - **Project name** (e.g., `MyProject`)
   - **Auth type** — default is `azure-ad` (recommended). Only use `pat` if the user specifically requests it.

3. **Initialize configuration** — Run:
   ```bash
   node dist/cli.js setup init --organization="<org_url>" --project="<project_name>"
   ```

4. **Authenticate** — Run the login command to complete browser-based Azure AD authentication:
   ```bash
   node dist/cli.js setup login
   ```
   This will launch `az login` in the browser. Wait for the user to complete the browser flow.

5. **Validate** — After authentication succeeds, verify the connection:
   ```bash
   node dist/cli.js setup validate
   ```

6. **Report results** — Tell the user whether setup succeeded. If validation fails, suggest troubleshooting steps.

## Specific Actions

If the user provides a specific action argument, run just that action:

- **`show`** — `node dist/cli.js setup show`
- **`validate`** — `node dist/cli.js setup validate`
- **`login`** — `node dist/cli.js setup login`
- **`logout`** — `node dist/cli.js setup logout`
- **`init`** — Follow the full interactive flow above.

## Notes

- Configuration is stored in `.claude/.ado-config.yaml`
- Token cache is stored in `.claude/.ado-token-cache.json`
- Data directory is `.claude/data/`
- The user needs Azure CLI installed for Azure AD authentication (`az login`)
- For PAT auth, the user must set the `ADO_PAT` environment variable
