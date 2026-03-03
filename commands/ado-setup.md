---
name: ado-setup
description: Initialize, validate, login, logout, or show Azure DevOps configuration
arguments:
  - name: action
    description: "Action: init, validate, show, login, or logout"
    required: true
  - name: organization
    description: "Azure DevOps organization URL (for init)"
    required: false
  - name: project
    description: "Azure DevOps project name (for init)"
    required: false
---

# ADO Setup

Configure the Azure DevOps integration.

## Initialize

```bash
node dist/cli.js setup init --organization="https://dev.azure.com/myorg" --project="MyProject"
```

This creates `.claude/.ado-config.yaml` and the data directories under `.claude/data/`. Default auth type is `azure-ad` (browser login). Use `--authType=pat` to use a Personal Access Token instead.

## Login (Azure AD)

```bash
node dist/cli.js setup login
```

Starts an interactive device-code login flow. You'll receive a URL and code to enter in your browser. The token is cached locally so you won't need to re-authenticate for subsequent commands.

## Logout

```bash
node dist/cli.js setup logout
```

Clears the cached Azure AD token.

## Validate connection

```bash
node dist/cli.js setup validate
```

Tests the ADO connection using your configured credentials.

## Show current config

```bash
node dist/cli.js setup show
```

Displays current organization, project, auth method, and storage paths.

## Authentication methods

### Azure AD (default, recommended)

No setup required beyond `init`. On first use, a device-code login prompt will appear. The token is cached to `.claude/.ado-token-cache.json`.

If you have the Azure CLI installed, cached `az` tokens are used automatically.

### Personal Access Token (PAT)

```bash
node dist/cli.js setup init --organization="..." --project="..." --authType=pat
export ADO_PAT="your-pat-token"
```

## Config file

Configuration is stored in `.claude/.ado-config.yaml` in the project root. The setup command manages this file automatically.
