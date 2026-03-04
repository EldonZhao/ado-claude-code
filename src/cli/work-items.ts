import { getAdoClient, mapAdoToLocal, formatWorkItemSummary, output, fatal, parseFlags } from "./helpers.js";
import { getWorkItemStorage } from "../storage/index.js";
import { HIERARCHY } from "../services/planning/templates.js";
import {
  createBreakdownProposal,
  formatProposal,
  getBreakdownGuidance,
  type PlannedItem,
} from "../services/planning/breakdown.js";
import { getCodePlanGuidance } from "../services/planning/code-plan.js";

export async function handleWorkItems(args: string[]): Promise<void> {
  const action = args[0];
  if (!action) {
    fatal("Usage: work-items <get|list|create|update|query|plan|task-plan> [args]");
  }

  switch (action) {
    case "get":
      return handleGet(args.slice(1));
    case "list":
      return handleList(args.slice(1));
    case "create":
      return handleCreate(args.slice(1));
    case "update":
      return handleUpdate(args.slice(1));
    case "query":
      return handleQuery(args.slice(1));
    case "plan":
      return handlePlan(args.slice(1));
    case "task-plan":
      return handleTaskPlan(args.slice(1));
    default:
      fatal(`Unknown work-items action: ${action}. Use get|list|create|update|query|plan|task-plan`);
  }
}

async function handleGet(args: string[]): Promise<void> {
  const flags = parseFlags(args);
  const idStr = args.find((a) => !a.startsWith("--")) ?? flags.id;
  if (!idStr) fatal("Usage: work-items get <id> [--expand=all|relations|fields] [--no-save]");

  const id = parseInt(idStr, 10);
  if (isNaN(id)) fatal(`Invalid work item ID: ${idStr}`);

  const client = await getAdoClient();
  const expand = (flags.expand as "all" | "relations" | "fields" | "links" | "none") ?? "relations";
  const adoItem = await client.getWorkItem(id, expand);
  const localItem = mapAdoToLocal(adoItem);

  if (flags.save !== "false" && flags["no-save"] !== "true") {
    const storage = await getWorkItemStorage();
    await storage.save(localItem);
  }

  output(localItem);
}

async function handleList(args: string[]): Promise<void> {
  const flags = parseFlags(args);
  const storage = await getWorkItemStorage();
  const items = await storage.listAll({
    type: flags.type as any,
    state: flags.state,
    assignedTo: flags.assignedTo,
  });

  if (items.length === 0) {
    output({ items: [], message: "No work items found. Run sync pull to fetch from Azure DevOps." });
    return;
  }

  output({ count: items.length, items });
}

async function handleCreate(args: string[]): Promise<void> {
  const flags = parseFlags(args);

  // Support --json for full JSON input
  if (flags.json) {
    const data = JSON.parse(flags.json);
    const client = await getAdoClient();
    const adoItem = await client.createWorkItem(data);
    const localItem = mapAdoToLocal(adoItem);
    const storage = await getWorkItemStorage();
    await storage.save(localItem);
    output(localItem);
    return;
  }

  if (!flags.type || !flags.title) {
    fatal("Usage: work-items create --type=<type> --title=<title> [--description=...] [--assignedTo=...] [--priority=N]");
  }

  const client = await getAdoClient();
  const adoItem = await client.createWorkItem({
    type: flags.type as any,
    title: flags.title,
    description: flags.description,
    assignedTo: flags.assignedTo,
    areaPath: flags.areaPath,
    iterationPath: flags.iterationPath,
    priority: flags.priority ? parseInt(flags.priority, 10) : undefined,
    storyPoints: flags.storyPoints ? parseFloat(flags.storyPoints) : undefined,
    parentId: flags.parentId ? parseInt(flags.parentId, 10) : undefined,
    customFields: flags.customFields ? JSON.parse(flags.customFields) : undefined,
  });

  const localItem = mapAdoToLocal(adoItem);
  const storage = await getWorkItemStorage();
  await storage.save(localItem);
  output(localItem);
}

async function handleUpdate(args: string[]): Promise<void> {
  const flags = parseFlags(args);
  const idStr = args.find((a) => !a.startsWith("--")) ?? flags.id;
  if (!idStr) fatal("Usage: work-items update <id> [--title=...] [--state=...] [--priority=N]");

  const id = parseInt(idStr, 10);
  if (isNaN(id)) fatal(`Invalid work item ID: ${idStr}`);

  // Support --json for full JSON input
  if (flags.json) {
    const data = JSON.parse(flags.json);
    data.id = id;
    const client = await getAdoClient();
    const adoItem = await client.updateWorkItem(data);
    const localItem = mapAdoToLocal(adoItem);
    const storage = await getWorkItemStorage();
    await storage.save(localItem);
    output(localItem);
    return;
  }

  const client = await getAdoClient();
  const adoItem = await client.updateWorkItem({
    id,
    title: flags.title,
    description: flags.description,
    state: flags.state,
    assignedTo: flags.assignedTo,
    areaPath: flags.areaPath,
    iterationPath: flags.iterationPath,
    priority: flags.priority ? parseInt(flags.priority, 10) : undefined,
    storyPoints: flags.storyPoints ? parseFloat(flags.storyPoints) : undefined,
    customFields: flags.customFields ? JSON.parse(flags.customFields) : undefined,
  });

  const localItem = mapAdoToLocal(adoItem);
  const storage = await getWorkItemStorage();
  await storage.save(localItem);
  output(localItem);
}

async function handleQuery(args: string[]): Promise<void> {
  const flags = parseFlags(args);
  // The WIQL can be a positional arg (quoted) or --wiql flag
  const wiql = args.find((a) => !a.startsWith("--")) ?? flags.wiql;
  if (!wiql) fatal("Usage: work-items query <wiql> [--save]");

  const client = await getAdoClient();
  const adoItems = await client.queryWorkItems(wiql);

  if (adoItems.length === 0) {
    output({ count: 0, items: [], message: "No work items matched the query." });
    return;
  }

  const localItems = adoItems.map(mapAdoToLocal);

  if (flags.save === "true" || flags.save === "") {
    const storage = await getWorkItemStorage();
    for (const item of localItems) {
      await storage.save(item);
    }
  }

  output({ count: localItems.length, items: localItems });
}

async function handlePlan(args: string[]): Promise<void> {
  const flags = parseFlags(args);
  const idStr = args.find((a) => !a.startsWith("--")) ?? flags.id;
  if (!idStr) fatal("Usage: work-items plan <id>");

  const id = parseInt(idStr, 10);
  if (isNaN(id)) fatal(`Invalid work item ID: ${idStr}`);

  const client = await getAdoClient();
  const storage = await getWorkItemStorage();

  const adoItem = await client.getWorkItem(id, "relations");
  const item = mapAdoToLocal(adoItem);
  await storage.save(item);

  const guidance = getCodePlanGuidance(item);
  output({ parent: { id: item.id, type: item.type, title: item.title }, codePlan: guidance });
}

async function handleTaskPlan(args: string[]): Promise<void> {
  const flags = parseFlags(args);
  const idStr = args.find((a) => !a.startsWith("--")) ?? flags.id;
  if (!idStr) fatal("Usage: work-items task-plan <id> [--items=<json>] [--create]");

  const id = parseInt(idStr, 10);
  if (isNaN(id)) fatal(`Invalid work item ID: ${idStr}`);

  const client = await getAdoClient();
  const storage = await getWorkItemStorage();

  // Fetch parent
  const adoParent = await client.getWorkItem(id, "relations");
  const parent = mapAdoToLocal(adoParent);
  await storage.save(parent);

  const childTypes = HIERARCHY[parent.type];
  if (childTypes.length === 0) {
    output({ error: `Work item #${parent.id} is a "${parent.type}" — cannot be broken down further.` });
    return;
  }

  // No items → return guidance
  if (!flags.items) {
    const guidance = getBreakdownGuidance(parent);
    output({ parent: { id: parent.id, type: parent.type, title: parent.title }, guidance });
    return;
  }

  const items: PlannedItem[] = JSON.parse(flags.items);
  const proposal = createBreakdownProposal(parent, items);

  // Preview only
  if (flags.create !== "true" && flags.create !== "") {
    output({ preview: true, proposal: formatProposal(proposal), items: proposal.items });
    return;
  }

  // Create in ADO
  const created: Array<{ id: number; type: string; title: string; parentId: number }> = [];
  for (const item of proposal.items) {
    const adoItem = await client.createWorkItem({
      type: item.type,
      title: item.title,
      description: item.description,
      priority: item.priority,
      storyPoints: item.storyPoints,
      parentId: parent.id,
    });
    const local = mapAdoToLocal(adoItem);
    await storage.save(local);
    created.push({ id: local.id, type: local.type, title: local.title, parentId: parent.id });

    if (item.children && item.children.length > 0) {
      for (const child of item.children) {
        try {
          const childAdo = await client.createWorkItem({
            type: child.type,
            title: child.title,
            description: child.description,
            priority: child.priority,
            storyPoints: child.storyPoints,
            parentId: adoItem.id,
          });
          const childLocal = mapAdoToLocal(childAdo);
          await storage.save(childLocal);
          created.push({ id: childLocal.id, type: childLocal.type, title: childLocal.title, parentId: adoItem.id });
        } catch (err) {
          process.stderr.write(`Warning: Failed to create child "${child.title}": ${err}\n`);
        }
      }
    }
  }

  output({ created: created.length, items: created });
}
