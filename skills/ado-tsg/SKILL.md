---
name: ado-tsg
description: Troubleshooting Guide structure, categories, and diagnostic patterns
---

# Azure DevOps TSG (Troubleshooting Guides)

## TSG Structure

A TSG is a structured document with:

### Metadata
- **id** — Unique identifier (e.g., `tsg-deployment-001`)
- **title** — Descriptive title
- **category** — Classification (e.g., deployment, performance, security, networking)
- **tags** — Searchable keywords
- **version** — Document version
- **author** — Creator
- **lastUpdated** — Last modification date

### Symptoms
Observable indicators that this TSG applies:
- Error messages users might see
- Behavioral symptoms (e.g., "pod keeps restarting")
- Performance indicators (e.g., "response time > 5s")

### Related Errors
Specific error strings that match this TSG. Used for automated matching during diagnosis.

### Prerequisites
- **tools** — Required CLI tools with minimum versions
- **permissions** — Required access levels
- **context** — Information needed before starting (e.g., pod name, namespace)

### Diagnostic Steps
Ordered steps to investigate the issue:
- **id** — Step identifier
- **name** — Human-readable name
- **command** — Template with `{{parameter}}` placeholders
- **manual** — Whether this is a manual inspection step
- **guidance** — Instructions for manual steps
- **analysis.lookFor** — Patterns to match in command output, with root cause mappings and severity

### Resolutions
Resolution plans keyed by root cause:
- Each resolution has ordered steps
- Steps can have commands (with parameter templates) or manual guidance
- Steps can have success criteria patterns

### Escalation
- **timeout** — When to escalate
- **contacts** — Teams and channels to contact

## Local Storage

TSGs are stored as YAML files in `data/tsg/` named by their ID (e.g., `tsg-deployment-001.yaml`).

## Search & Matching

TSGs are matched by:
1. **Symptom matching** — Fuzzy matching against reported symptoms
2. **Tag matching** — Exact tag comparison
3. **Keyword search** — Free text search across title, symptoms, errors
4. **Category filter** — Exact category match (mandatory if specified)

Results are scored and ranked by relevance.
