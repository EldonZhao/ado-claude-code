---
name: ado-troubleshooting
description: Troubleshooting methodology, symptom matching, and diagnostic workflow
---

# Troubleshooting Methodology

## Workflow

The troubleshooting workflow follows a structured approach:

### 1. Diagnose
- Collect symptoms and error messages from the user
- Search TSGs for matching patterns
- Present matched TSGs ranked by relevance score
- Recommend initial diagnostic steps

### 2. Execute Diagnostics
- Run diagnostic commands from the matched TSG
- Commands use templates with `{{parameter}}` placeholders
- Parameters must be provided (e.g., pod name, namespace)
- Manual steps require human observation

### 3. Analyze Output
- Compare diagnostic output against known patterns
- Patterns can be literal strings or regex
- Each pattern can indicate a specific root cause
- Patterns have severity levels: low, medium, high, critical
- Check both TSG-specific and cross-TSG patterns

### 4. Identify Root Cause
- Root causes are identified by pattern matching
- Multiple patterns may point to the same root cause
- Cross-reference findings across multiple diagnostic steps

### 5. Resolve
- Retrieve resolution plan for the identified root cause
- Resolution plans have ordered steps with commands
- Some steps are manual (require human action)
- Steps may have success criteria to verify

### 6. Escalate (if needed)
- If resolution doesn't work within the TSG's timeout
- Contact the specified team via the listed channel
- Provide all diagnostic context gathered

## Pattern Matching

### Literal Matching
Case-insensitive substring matching of diagnostic output against known patterns.

### Regex Matching
Full regex support for complex patterns. Falls back to literal matching if regex is invalid.

### Cross-TSG Analysis
When analyzing output, all TSGs are checked for:
- Related error strings
- Diagnostic analysis patterns
Results are deduplicated and ranked.

## Tips for Effective Troubleshooting

1. Start broad — report all symptoms, not just the primary one
2. Provide context — service name, environment, recent changes
3. Run diagnostics in order — TSG steps are sequenced for a reason
4. Don't skip manual steps — they often provide crucial context
5. Check success criteria — verify each resolution step worked
6. Create TSGs for new patterns — if no TSG matches, create one after resolving
