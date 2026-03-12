import { logger } from "./utils/logger.js";
import { formatError } from "./utils/errors.js";
import { handleWorkItems } from "./cli/work-items.js";
import { handleSync } from "./cli/sync.js";
import { handleTsg } from "./cli/tsg.js";
import { handleSetup } from "./cli/setup.js";
import { handleTroubleshoot } from "./cli/troubleshoot.js";
import { handleClear } from "./cli/clear.js";
import { setProjectDir } from "./storage/config.js";

declare const __VERSION__: string;

const USAGE = `Usage: ado-claude-code <domain> <action> [args]

Global flags:
  --project-dir=<path>   Project root directory (where .claude/ lives)

Domains:
  work-items   get|list|create|update|query|plan|workitem-plan|summary
  sync         pull|push|full
  clear        [--confirm]
  tsg          create|get|update|list|search|execute|score|ts
  setup        init|validate|show

Examples:
  ado-claude-code setup init --organization=https://dev.azure.com/myorg --project=MyProject
  ado-claude-code sync pull --query="SELECT [System.Id] FROM WorkItems WHERE [System.State] = 'Active'"
  ado-claude-code work-items get 1234
  ado-claude-code tsg list --category=deployment
  ado-claude-code tsg ts diagnose --symptoms='["pod restarting"]'
`;

async function main(): Promise<void> {
  const rawArgs = process.argv.slice(2);

  // Extract --project-dir before routing
  const args: string[] = [];
  for (const arg of rawArgs) {
    if (arg.startsWith("--project-dir=")) {
      setProjectDir(arg.slice("--project-dir=".length));
    } else {
      args.push(arg);
    }
  }

  if (args.length === 0 || args[0] === "--help" || args[0] === "-h") {
    process.stdout.write(USAGE);
    process.exit(0);
  }

  if (args[0] === "--version" || args[0] === "-v") {
    process.stdout.write(`ado-claude-code v${__VERSION__}\n`);
    process.exit(0);
  }

  const domain = args[0];
  const rest = args.slice(1);

  try {
    switch (domain) {
      case "work-items":
        await handleWorkItems(rest);
        break;
      case "sync":
        await handleSync(rest);
        break;
      case "clear":
        await handleClear(rest);
        break;
      case "tsg":
        await handleTsg(rest);
        break;
      case "setup":
        await handleSetup(rest);
        break;
      case "troubleshoot":
        await handleTroubleshoot(rest);
        break;
      default:
        process.stderr.write(`Unknown domain: ${domain}\n\n`);
        process.stdout.write(USAGE);
        process.exit(1);
    }
  } catch (error) {
    logger.error({ error }, "CLI command failed");
    process.stderr.write(`Error: ${formatError(error)}\n`);
    process.exit(1);
  }
}

main();
