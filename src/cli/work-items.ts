import { getAdoClient, getSyncStateManager, mapAdoToLocal, formatWorkItemSummary, output, fatal, parseFlags, markdownToHtml } from "./helpers.js";
import { getWorkItemStorage } from "../storage/index.js";
import { SyncStateManager } from "../services/sync/state.js";
import { serializeForHash } from "../services/sync/mapper.js";
import { HIERARCHY } from "../services/planning/templates.js";
import {
  createBreakdownProposal,
  formatProposal,
  getBreakdownGuidance,
  type PlannedItem,
} from "../services/planning/breakdown.js";
import { getCodePlanGuidance } from "../services/planning/code-plan.js";
import type { WorkItemStorage } from "../storage/work-items.js";
import type { LocalWorkItemOutput } from "../schemas/work-item.schema.js";

/**
 * Save a work item to local storage AND register it in sync state,
 * so that `clear` can find and remove it later.
 */
async function saveAndTrack(
  storage: WorkItemStorage,
  item: LocalWorkItemOutput,
): Promise<string> {
  const filePath = await storage.save(item);
  try {
    const stateManager = await getSyncStateManager();
    const hash = SyncStateManager.computeHash(serializeForHash(item));
    await stateManager.setItemState(item.id, {
      localPath: filePath,
      adoRev: item.rev,
      localHash: hash,
      lastSyncedAt: new Date().toISOString(),
      syncStatus: "synced",
    });
    await stateManager.save();
  } catch {
    // Non-blocking: if sync state fails, the file is still saved
  }
  return filePath;
}

export async function handleWorkItems(args: string[]): Promise<void> {
  const action = args[0];
  if (!action) {
    fatal("Usage: work-items <get|list|create|update|query|plan|workitem-plan> [args]");
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
    case "workitem-plan":
    case "task-plan":
      return handleWorkitemPlan(args.slice(1));
    default:
      fatal(`Unknown work-items action: ${action}. Use get|list|create|update|query|plan|workitem-plan`);
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
    await saveAndTrack(storage, localItem);
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
    await saveAndTrack(storage, localItem);
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
  await saveAndTrack(storage, localItem);
  output(localItem);
}

async function handleUpdate(args: string[]): Promise<void> {
  const flags = parseFlags(args);
  const idStr = args.find((a) => !a.startsWith("--")) ?? flags.id;
  if (!idStr) fatal("Usage: work-items update <id> [--title=...] [--state=...] [--priority=N] [--comment=...] [--complete]");

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
    await saveAndTrack(storage, localItem);
    output(localItem);
    return;
  }

  const client = await getAdoClient();
  const storage = await getWorkItemStorage();

  // --complete: auto-detect terminal state and transition
  const isComplete = flags.complete === "true" || flags.complete === "";
  if (isComplete) {
    if (flags.state) {
      process.stderr.write("Warning: --complete takes precedence over --state\n");
    }

    const adoItem = await client.getWorkItem(id);
    const currentItem = mapAdoToLocal(adoItem);
    const previousState = currentItem.state;

    const terminalState = await client.getTerminalState(currentItem.type);
    const updatedAdo = await client.updateWorkItem({ id, state: terminalState, customFields: getBugCompletionFields(currentItem.type) });
    const localItem = mapAdoToLocal(updatedAdo);
    await saveAndTrack(storage, localItem);

    let commentAdded: { id: number; text: string } | undefined;
    try {
      const commentText = `<p>Work item marked as completed by Claude at <code>${new Date().toISOString()}</code></p>\n<p>State: <strong>${previousState}</strong> → <strong>${terminalState}</strong></p>`;
      commentAdded = await client.addComment(id, commentText);
    } catch (err) {
      process.stderr.write(`Warning: Failed to add completion comment: ${err}\n`);
    }

    const result: Record<string, unknown> = {
      ...localItem,
      completed: true,
      stateChange: { from: previousState, to: terminalState },
    };
    if (commentAdded) result.commentAdded = commentAdded;
    output(result);
    return;
  }

  const hasFieldUpdates = flags.title || flags.description !== undefined ||
    flags.state || flags.assignedTo !== undefined || flags.areaPath ||
    flags.iterationPath || flags.priority || flags.storyPoints || flags.customFields;

  let localItem;
  if (hasFieldUpdates) {
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
    localItem = mapAdoToLocal(adoItem);
    await saveAndTrack(storage, localItem);
  }

  // Add comment if provided
  if (flags.comment) {
    const commentResult = await client.addComment(id, flags.comment);
    if (!localItem) {
      // Comment-only update: fetch current item for output
      const adoItem = await client.getWorkItem(id, "relations");
      localItem = mapAdoToLocal(adoItem);
      await saveAndTrack(storage, localItem);
    }
    output({ ...localItem, commentAdded: { id: commentResult.id, text: commentResult.text } });
    return;
  }

  if (!localItem) {
    fatal("No fields to update and no comment provided.");
  }

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
      await saveAndTrack(storage, item);
    }
  }

  output({ count: localItems.length, items: localItems });
}

const PLAN_ELIGIBLE_STATES = new Set(["New", "To Do", "Proposed", "Approved"]);

/** Bug type requires ResolvedReason when transitioning to a terminal state. */
function getBugCompletionFields(type: string): Record<string, unknown> | undefined {
  if (type === "Bug") {
    return { "Microsoft.VSTS.Common.ResolvedReason": "Fixed" };
  }
  return undefined;
}

async function handlePlan(args: string[]): Promise<void> {
  const flags = parseFlags(args);
  const idStr = args.find((a) => !a.startsWith("--")) ?? flags.id;
  if (!idStr) fatal("Usage: work-items plan <id> [--no-update]");

  const id = parseInt(idStr, 10);
  if (isNaN(id)) fatal(`Invalid work item ID: ${idStr}`);

  const skipUpdate = flags["no-update"] === "true";

  const client = await getAdoClient();
  const storage = await getWorkItemStorage();

  const adoItem = await client.getWorkItem(id, "relations");
  let item = mapAdoToLocal(adoItem);
  await saveAndTrack(storage, item);

  const guidance = getCodePlanGuidance(item);

  // Side-effects (unless --no-update)
  let stateChanged = false;
  let previousState: string | undefined;
  let commentAdded: { id: number; text: string } | undefined;

  if (!skipUpdate) {
    // Transition to "In Progress" if eligible
    if (PLAN_ELIGIBLE_STATES.has(item.state)) {
      try {
        previousState = item.state;
        const updatedAdo = await client.updateWorkItem({ id, state: "In Progress" });
        item = mapAdoToLocal(updatedAdo);
        await saveAndTrack(storage, item);
        stateChanged = true;
      } catch (err) {
        process.stderr.write(`Warning: Failed to update state: ${err}\n`);
      }
    }

    // Add comment with full plan text
    try {
      const commentText = `<h3>Code plan generated by Claude</h3>\n<p><em>${new Date().toISOString()}</em></p>\n${markdownToHtml(guidance)}`;
      commentAdded = await client.addComment(id, commentText);
    } catch (err) {
      process.stderr.write(`Warning: Failed to add comment: ${err}\n`);
    }
  }

  // Build output
  const result: Record<string, unknown> = {
    parent: { id: item.id, type: item.type, title: item.title, state: item.state },
    codePlan: guidance,
  };
  if (stateChanged) result.stateChange = { from: previousState, to: "In Progress" };
  if (commentAdded) result.commentAdded = commentAdded;
  if (skipUpdate) result.updatesSkipped = true;

  output(result);
}

async function handleWorkitemPlan(args: string[]): Promise<void> {
  const flags = parseFlags(args);
  const idStr = args.find((a) => !a.startsWith("--")) ?? flags.id;
  if (!idStr) fatal("Usage: work-items workitem-plan <id> [--items=<json>] [--create] [--complete] [--no-update]");

  const id = parseInt(idStr, 10);
  if (isNaN(id)) fatal(`Invalid work item ID: ${idStr}`);

  const skipUpdate = flags["no-update"] === "true";

  const client = await getAdoClient();
  const storage = await getWorkItemStorage();

  // Fetch parent
  const adoParent = await client.getWorkItem(id, "relations");
  let parent = mapAdoToLocal(adoParent);
  await saveAndTrack(storage, parent);

  const childTypes = HIERARCHY[parent.type];
  if (childTypes.length === 0) {
    output({ error: `Work item #${parent.id} is a "${parent.type}" — cannot be broken down further.` });
    return;
  }

  // Side-effects (unless --no-update)
  let stateChanged = false;
  let previousState: string | undefined;
  let commentAdded: { id: number; text: string } | undefined;

  if (!skipUpdate) {
    // Transition to "In Progress" if eligible
    if (PLAN_ELIGIBLE_STATES.has(parent.state)) {
      try {
        previousState = parent.state;
        const updatedAdo = await client.updateWorkItem({ id, state: "In Progress" });
        parent = mapAdoToLocal(updatedAdo);
        await saveAndTrack(storage, parent);
        stateChanged = true;
      } catch (err) {
        process.stderr.write(`Warning: Failed to update state: ${err}\n`);
      }
    }

    // Add comment
    try {
      const commentText = `<h3>Work item breakdown plan generated by Claude</h3>\n<p><em>${new Date().toISOString()}</em></p>`;
      commentAdded = await client.addComment(id, commentText);
    } catch (err) {
      process.stderr.write(`Warning: Failed to add comment: ${err}\n`);
    }
  }

  // No items → return guidance (or just complete if --complete)
  if (!flags.items) {
    const isCompleteOnly = flags.complete === "true" || flags.complete === "";

    if (isCompleteOnly && !skipUpdate) {
      try {
        const terminalState = await client.getTerminalState(parent.type);
        const prevState = parent.state;
        const updatedAdo = await client.updateWorkItem({ id, state: terminalState, customFields: getBugCompletionFields(parent.type) });
        parent = mapAdoToLocal(updatedAdo);
        await saveAndTrack(storage, parent);

        let completionComment: { id: number; text: string } | undefined;
        try {
          const commentText = `<p>Work item marked as completed by Claude at <code>${new Date().toISOString()}</code></p>\n<p>State: <strong>${prevState}</strong> → <strong>${terminalState}</strong></p>`;
          completionComment = await client.addComment(id, commentText);
        } catch (err) {
          process.stderr.write(`Warning: Failed to add completion comment: ${err}\n`);
        }

        const result: Record<string, unknown> = {
          ...parent,
          completed: true,
          stateChange: { from: prevState, to: terminalState },
        };
        if (commentAdded) result.planCommentAdded = commentAdded;
        if (completionComment) result.completionCommentAdded = completionComment;
        output(result);
        return;
      } catch (err) {
        process.stderr.write(`Warning: Failed to complete work item: ${err}\n`);
      }
    }

    const guidance = getBreakdownGuidance(parent);
    const result: Record<string, unknown> = {
      parent: { id: parent.id, type: parent.type, title: parent.title },
      guidance,
    };
    if (stateChanged) result.stateChange = { from: previousState, to: "In Progress" };
    if (commentAdded) result.commentAdded = commentAdded;
    if (skipUpdate) result.updatesSkipped = true;
    output(result);
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
    await saveAndTrack(storage, local);
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
          await saveAndTrack(storage, childLocal);
          created.push({ id: childLocal.id, type: childLocal.type, title: childLocal.title, parentId: adoItem.id });
        } catch (err) {
          process.stderr.write(`Warning: Failed to create child "${child.title}": ${err}\n`);
        }
      }
    }
  }

  // Post summary comment listing created children
  let createCommentAdded: { id: number; text: string } | undefined;
  if (!skipUpdate && created.length > 0) {
    try {
      const listing = created.map((c) => `<li><strong>#${c.id}</strong> ${c.title} <em>(${c.type})</em></li>`).join("\n");
      const commentText = `<h3>Created ${created.length} child item(s)</h3>\n<ul>\n${listing}\n</ul>`;
      createCommentAdded = await client.addComment(id, commentText);
    } catch (err) {
      process.stderr.write(`Warning: Failed to add summary comment: ${err}\n`);
    }
  }

  // --complete: transition parent to terminal state
  const isComplete = flags.complete === "true" || flags.complete === "";
  let completionResult: { stateChange: { from: string; to: string }; commentAdded?: { id: number; text: string } } | undefined;
  if (isComplete && !skipUpdate) {
    try {
      const terminalState = await client.getTerminalState(parent.type);
      const prevState = parent.state;
      const updatedAdo = await client.updateWorkItem({ id, state: terminalState, customFields: getBugCompletionFields(parent.type) });
      parent = mapAdoToLocal(updatedAdo);
      await saveAndTrack(storage, parent);

      let completionComment: { id: number; text: string } | undefined;
      try {
        const commentText = `<p>Work item marked as completed by Claude at <code>${new Date().toISOString()}</code></p>\n<p>State: <strong>${prevState}</strong> → <strong>${terminalState}</strong></p>`;
        completionComment = await client.addComment(id, commentText);
      } catch (err) {
        process.stderr.write(`Warning: Failed to add completion comment: ${err}\n`);
      }

      completionResult = { stateChange: { from: prevState, to: terminalState } };
      if (completionComment) completionResult.commentAdded = completionComment;
    } catch (err) {
      process.stderr.write(`Warning: Failed to complete work item: ${err}\n`);
    }
  }

  const result: Record<string, unknown> = { created: created.length, items: created };
  if (stateChanged) result.stateChange = { from: previousState, to: "In Progress" };
  if (commentAdded) result.commentAdded = commentAdded;
  if (createCommentAdded) result.createCommentAdded = createCommentAdded;
  if (completionResult) {
    result.completed = true;
    result.completionStateChange = completionResult.stateChange;
    if (completionResult.commentAdded) result.completionCommentAdded = completionResult.commentAdded;
  }

  output(result);
}
