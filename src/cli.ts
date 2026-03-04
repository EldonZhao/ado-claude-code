import { logger } from "./utils/logger.js";
import { formatError } from "./utils/errors.js";
import { handleWorkItems } from "./cli/work-items.js";
import { handleSync } from "./cli/sync.js";
import { handleTsg } from "./cli/tsg.js";
import { handleSetup } from "./cli/setup.js";
import { handleTroubleshoot } from "./cli/troubleshoot.js";
import { handleClear } from "./cli/clear.js";

const USAGE = `Usage: ado-claude-code <domain> <action> [args]

Domains:
  work-items   get|list|create|update|query|plan|workitem-plan
  sync         pull|push|full
  clear        [--confirm]
  tsg          create|get|update|list|search|execute
  setup        init|validate|show
  troubleshoot diagnose|analyze|suggest

Examples:
  ado-claude-code setup init --organization=https://dev.azure.com/myorg --project=MyProject
  ado-claude-code sync pull --query="SELECT [System.Id] FROM WorkItems WHERE [System.State] = 'Active'"
  ado-claude-code work-items get 1234
  ado-claude-code tsg list --category=deployment
  ado-claude-code troubleshoot diagnose --symptoms='["pod restarting"]'
`;

async function main(): Promise<void> {
  const args = process.argv.slice(2);

  if (args.length === 0 || args[0] === "--help" || args[0] === "-h") {
    process.stdout.write(USAGE);
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
