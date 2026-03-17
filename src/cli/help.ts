export interface HelpEntry {
  usage: string;
  description: string;
  flags?: Array<{ name: string; description: string }>;
  examples?: string[];
}

export const HELP: Record<string, Record<string, HelpEntry>> = {
  workitems: {
    _domain: {
      usage: "workitems <action> [args]",
      description: "Work item CRUD, query, planning, and summary",
      flags: [
        { name: "action", description: "get | list | create | update | query | plan | workitem-plan | summary" },
      ],
      examples: [
        "workitems get 12345",
        "workitems list --type=Bug",
        "workitems plan 12345",
      ],
    },
    get: {
      usage: "workitems get <id> [--expand=...] [--no-save]",
      description: "Fetch a work item from Azure DevOps by ID",
      flags: [
        { name: "--expand=<mode>", description: "Expand mode: all | relations | fields | links | none (default: relations)" },
        { name: "--no-save", description: "Do not save the work item locally" },
      ],
      examples: [
        "workitems get 12345",
        "workitems get 12345 --expand=all",
        "workitems get 12345 --no-save",
      ],
    },
    list: {
      usage: "workitems list [--type=...] [--state=...] [--assignedTo=...]",
      description: "List locally synced work items",
      flags: [
        { name: "--type=<type>", description: "Filter by type (Bug, Task, User Story, etc.)" },
        { name: "--state=<state>", description: "Filter by state" },
        { name: "--assignedTo=<name>", description: "Filter by assigned user" },
      ],
      examples: [
        "workitems list",
        "workitems list --type=Bug --state=Active",
      ],
    },
    create: {
      usage: "workitems create --type=<type> --title=<title> [...]",
      description: "Create a new work item in Azure DevOps",
      flags: [
        { name: "--type=<type>", description: "Work item type (Bug, Task, User Story, etc.)" },
        { name: "--title=<title>", description: "Work item title" },
        { name: "--description=<text>", description: "Description text" },
        { name: "--assignedTo=<name>", description: "Assigned user" },
      ],
      examples: [
        "workitems create --type=Task --title=\"Fix login bug\"",
        "workitems create --type=Bug --title=\"Error on save\" --priority=1",
      ],
    },
    update: {
      usage: "workitems update <id> [--title=...] [--state=...] [--comment=...] [--complete]",
      description: "Update a work item in Azure DevOps",
      flags: [
        { name: "--title=<title>", description: "New title" },
        { name: "--state=<state>", description: "New state" },
        { name: "--comment=<text>", description: "Add a comment" },
        { name: "--complete", description: "Transition to terminal state" },
      ],
      examples: [
        "workitems update 12345 --state=Active",
        "workitems update 12345 --comment=\"Fixed in commit abc123\"",
        "workitems update 12345 --complete",
      ],
    },
    query: {
      usage: "workitems query <wiql> [--save]",
      description: "Run a WIQL query against Azure DevOps",
      flags: [
        { name: "--save", description: "Save matched items locally" },
      ],
      examples: [
        "workitems query \"SELECT [System.Id] FROM WorkItems WHERE [System.State] = 'Active'\"",
      ],
    },
    plan: {
      usage: "workitems plan <id> [--no-update]",
      description: "Generate a code implementation plan for a work item",
      flags: [
        { name: "--no-update", description: "Skip state transition and comment side-effects" },
      ],
      examples: [
        "workitems plan 12345",
        "workitems plan 12345 --no-update",
      ],
    },
    "workitem-plan": {
      usage: "workitems workitem-plan <id> [--items=<json>] [--create] [--complete] [--no-update]",
      description: "Break down a work item into child items",
      flags: [
        { name: "--items=<json>", description: "JSON array of planned child items" },
        { name: "--create", description: "Create child items in ADO" },
        { name: "--complete", description: "Mark parent as completed after breakdown" },
        { name: "--no-update", description: "Skip state transition and comment side-effects" },
      ],
      examples: [
        "workitems workitem-plan 12345",
        "workitems workitem-plan 12345 --items='[{\"type\":\"Task\",\"title\":\"Subtask 1\"}]' --create",
      ],
    },
    summary: {
      usage: "workitems summary [--period=...] [--days=N] [--top=N] [--query=...] [--assignedTo=...] [--all]",
      description: "Generate a work item summary report (defaults to items assigned to you)",
      flags: [
        { name: "--period=<period>", description: "Summary period: week | month (default: week)" },
        { name: "--days=<N>", description: "Custom number of look-back days (overrides --period)" },
        { name: "--top=<N>", description: "Limit results to the first N items" },
        { name: "--query=<wiql>", description: "Custom WIQL query override" },
        { name: "--assignedTo=<name>", description: "Filter by assigned user (default: @me)" },
        { name: "--all", description: "Include all users, not just items assigned to you" },
      ],
      examples: [
        "workitems summary",
        "workitems summary --period=month",
        "workitems summary --days=14",
        "workitems summary --top=20",
        "workitems summary --all",
        "workitems summary --assignedTo=\"John Doe\"",
      ],
    },
  },

  setup: {
    _domain: {
      usage: "setup <action> [args]",
      description: "Configuration init, validate, show, login, logout",
      flags: [
        { name: "action", description: "init | validate | show | login | logout" },
      ],
      examples: [
        "setup init --url=https://dev.azure.com/myorg/myproject",
        "setup validate",
        "setup show",
      ],
    },
    init: {
      usage: "setup init --url=<url>",
      description: "Initialize Azure DevOps configuration",
      flags: [
        { name: "--url=<url>", description: "Azure DevOps project URL (dev.azure.com or *.visualstudio.com)" },
        { name: "--organization=<url>", description: "Organization URL (alternative to --url)" },
        { name: "--project=<name>", description: "Project name (required with --organization)" },
        { name: "--authType=<type>", description: "Auth type: azure-ad | pat (default: azure-ad)" },
      ],
      examples: [
        "setup init --url=https://dev.azure.com/myorg/myproject",
        "setup init --organization=https://dev.azure.com/myorg --project=MyProject",
      ],
    },
    validate: {
      usage: "setup validate",
      description: "Validate current configuration, credentials, and ADO connection",
    },
    show: {
      usage: "setup show",
      description: "Show current configuration and credential status",
    },
    login: {
      usage: "setup login",
      description: "Launch browser login via Azure AD (requires Azure CLI)",
    },
    logout: {
      usage: "setup logout",
      description: "Clear cached Azure AD tokens",
    },
  },

  sync: {
    _domain: {
      usage: "sync <action> [flags]",
      description: "Bidirectional work item sync between ADO and local storage",
      flags: [
        { name: "action", description: "pull | push | full" },
      ],
      examples: [
        "sync pull",
        "sync push",
        "sync full",
      ],
    },
    pull: {
      usage: "sync pull [--ids=...] [--query=...] [--mine] [--all]",
      description: "Pull work items from Azure DevOps to local storage",
      flags: [
        { name: "--ids=<ids>", description: "Comma-separated work item IDs to pull" },
        { name: "--query=<wiql>", description: "WIQL query to select items" },
        { name: "--mine", description: "Pull items assigned to me (default if no other filter)" },
        { name: "--all", description: "Pull all my items including closed" },
      ],
      examples: [
        "sync pull",
        "sync pull --ids=123,456",
        "sync pull --all",
      ],
    },
    push: {
      usage: "sync push [--ids=...]",
      description: "Push local changes to Azure DevOps",
      flags: [
        { name: "--ids=<ids>", description: "Comma-separated work item IDs to push" },
      ],
      examples: [
        "sync push",
        "sync push --ids=123,456",
      ],
    },
    full: {
      usage: "sync full [--ids=...] [--query=...] [--mine] [--all]",
      description: "Full bidirectional sync (push local changes then pull remote)",
      flags: [
        { name: "--ids=<ids>", description: "Comma-separated work item IDs" },
        { name: "--query=<wiql>", description: "WIQL query to select items" },
        { name: "--mine", description: "Sync items assigned to me" },
        { name: "--all", description: "Sync all my items including closed" },
      ],
      examples: [
        "sync full",
        "sync full --query=\"SELECT [System.Id] FROM WorkItems WHERE [System.State] = 'Active'\"",
      ],
    },
  },

  clear: {
    _domain: {
      usage: "clear [--confirm]",
      description: "Remove all locally synced work items and sync state",
      flags: [
        { name: "--confirm", description: "Skip confirmation and proceed with clearing" },
      ],
      examples: [
        "clear --confirm",
      ],
    },
  },

  instructions: {
    _domain: {
      usage: "instructions <action> [args]",
      description: "TSG/instruction CRUD, search, execute, and troubleshoot",
      flags: [
        { name: "action", description: "create | get | update | list | search | execute | score | diagnose | analyze | suggest | run | ts" },
      ],
      examples: [
        "instructions list",
        "instructions search --query=timeout",
        "instructions diagnose --symptoms='[\"high latency\"]'",
      ],
    },
    create: {
      usage: "instructions create --title=<t> --category=<c> [...]",
      description: "Create an instruction/TSG",
      flags: [
        { name: "--title=<title>", description: "Instruction title" },
        { name: "--category=<cat>", description: "Category name" },
        { name: "--template", description: "Apply category template defaults" },
        { name: "--file=<path>", description: "Import from file (markdown or plain text)" },
      ],
      examples: [
        "instructions create --title=\"Fix OOM\" --category=performance",
        "instructions create --file=my-tsg.md",
      ],
    },
    get: {
      usage: "instructions get <id>",
      description: "Get an instruction by ID",
      examples: [
        "instructions get tsg-performance-001",
      ],
    },
    update: {
      usage: "instructions update <id> [--title=...] [--tags=...]",
      description: "Update an instruction",
      flags: [
        { name: "--title=<title>", description: "New title" },
        { name: "--tags=<json>", description: "JSON array of tags" },
        { name: "--json=<json>", description: "Full JSON update payload" },
      ],
      examples: [
        "instructions update tsg-performance-001 --title=\"Fix OOM v2\"",
      ],
    },
    list: {
      usage: "instructions list [--category=...]",
      description: "List instructions, optionally filtered by category",
      flags: [
        { name: "--category=<cat>", description: "Filter by category" },
      ],
      examples: [
        "instructions list",
        "instructions list --category=performance",
      ],
    },
    search: {
      usage: "instructions search [--query=...] [--category=...] [--symptoms=...]",
      description: "Search instructions by text, symptoms, or tags",
      flags: [
        { name: "--query=<text>", description: "Free-text search query" },
        { name: "--category=<cat>", description: "Filter by category" },
        { name: "--symptoms=<json>", description: "JSON array of symptoms to match" },
      ],
      examples: [
        "instructions search --query=timeout",
        "instructions search --symptoms='[\"high CPU\"]'",
      ],
    },
    execute: {
      usage: "instructions execute <id> [--stepId=...] [--rootCause=...] [--parameters=...]",
      description: "Execute a TSG diagnostic step or get a resolution",
      flags: [
        { name: "--stepId=<id>", description: "Execute a specific diagnostic step" },
        { name: "--rootCause=<cause>", description: "Get resolution for a root cause" },
        { name: "--parameters=<json>", description: "JSON object of parameters" },
      ],
      examples: [
        "instructions execute tsg-performance-001",
        "instructions execute tsg-performance-001 --stepId=check-memory",
      ],
    },
    score: {
      usage: "instructions score <id>",
      description: "Score/evaluate a TSG's completeness",
      examples: [
        "instructions score tsg-performance-001",
      ],
    },
    diagnose: {
      usage: "instructions diagnose --symptoms='[...]' [--category=...]",
      description: "Find matching TSGs for reported symptoms",
      flags: [
        { name: "--symptoms=<json>", description: "JSON array of symptom strings" },
        { name: "--category=<cat>", description: "Filter by category" },
      ],
      examples: [
        "instructions diagnose --symptoms='[\"high latency\",\"timeout errors\"]'",
      ],
    },
    analyze: {
      usage: "instructions analyze --output=<text> [--tsgId=...] [--stepId=...]",
      description: "Analyze diagnostic output against TSG patterns",
      flags: [
        { name: "--output=<text>", description: "Diagnostic output text to analyze" },
        { name: "--tsgId=<id>", description: "Limit analysis to a specific TSG" },
        { name: "--stepId=<id>", description: "Limit analysis to a specific step" },
      ],
      examples: [
        "instructions analyze --output=\"ERROR: connection refused\" --tsgId=tsg-network-001",
      ],
    },
    suggest: {
      usage: "instructions suggest --tsgId=<id> --rootCause=<cause> [--parameters=...]",
      description: "Suggest resolution steps for a root cause",
      flags: [
        { name: "--tsgId=<id>", description: "TSG to get resolution from" },
        { name: "--rootCause=<cause>", description: "Identified root cause" },
        { name: "--parameters=<json>", description: "JSON object of parameters" },
      ],
      examples: [
        "instructions suggest --tsgId=tsg-network-001 --rootCause=dns-failure",
      ],
    },
    run: {
      usage: "instructions run --symptoms='[...]' [--category=...] [--output=...] [--parameters=...]",
      description: "Full troubleshooting workflow: diagnose, analyze, and suggest",
      flags: [
        { name: "--symptoms=<json>", description: "JSON array of symptom strings" },
        { name: "--category=<cat>", description: "Filter by category" },
        { name: "--output=<text>", description: "Diagnostic output to analyze" },
        { name: "--parameters=<json>", description: "JSON object of parameters" },
      ],
      examples: [
        "instructions run --symptoms='[\"high latency\"]'",
        "instructions run --symptoms='[\"OOM\"]' --output=\"java.lang.OutOfMemoryError\"",
      ],
    },
    ts: {
      usage: "instructions ts <diagnose|analyze|suggest|run> [args]",
      description: "Troubleshoot shorthand (alias for diagnose/analyze/suggest/run)",
      examples: [
        "instructions ts diagnose --symptoms='[\"timeout\"]'",
        "instructions ts run --symptoms='[\"error 500\"]'",
      ],
    },
  },
};
