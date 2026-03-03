---
name: ado-setup
description: Initialize, validate, or show Azure DevOps configuration
arguments:
  - name: action
    description: "Action: init, validate, or show"
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
node dist/cli.js setup init --organization="https://dev.azure.com/myorg" --project="MyProject" --authType=pat
```

This creates `.ado-config.yaml` and the data directories.

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

## Prerequisites

Set `ADO_PAT` environment variable with your Personal Access Token before running init/validate:

```bash
export ADO_PAT="your-pat-token"
```

## Config file

Configuration is stored in `.ado-config.yaml` in the project root. The setup command manages this file automatically.
