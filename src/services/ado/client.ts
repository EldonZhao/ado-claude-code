import * as azdev from "azure-devops-node-api";
import type {
  IWorkItemTrackingApi,
} from "azure-devops-node-api/WorkItemTrackingApi.js";
import type { JsonPatchDocument } from "azure-devops-node-api/interfaces/common/VSSInterfaces.js";
import type { Wiql } from "azure-devops-node-api/interfaces/WorkItemTrackingInterfaces.js";
import type { AdoConfigOutput } from "../../schemas/config.schema.js";
import { WorkItemError } from "../../utils/errors.js";
import { logger } from "../../utils/logger.js";
import { getCredentials } from "./auth.js";
import { getApiCache, CacheKeys } from "../../storage/cache.js";
import type {
  AdoWorkItem,
  JsonPatchOperation,
  WorkItemCreateParams,
  WorkItemUpdateParams,
} from "./types.js";

export class AdoClient {
  private connection: azdev.WebApi | null = null;
  private witApi: IWorkItemTrackingApi | null = null;

  constructor(private config: AdoConfigOutput) {}

  private async getConnection(): Promise<azdev.WebApi> {
    if (this.connection) return this.connection;

    const creds = await getCredentials(this.config);
    const orgUrl = this.config.azure_devops.organization;

    const authHandler =
      creds.type === "pat"
        ? azdev.getPersonalAccessTokenHandler(creds.token)
        : azdev.getBearerHandler(creds.token);

    this.connection = new azdev.WebApi(orgUrl, authHandler);
    logger.info({ org: orgUrl }, "Connected to Azure DevOps");
    return this.connection;
  }

  private async getWitApi(): Promise<IWorkItemTrackingApi> {
    if (this.witApi) return this.witApi;
    const conn = await this.getConnection();
    this.witApi = await conn.getWorkItemTrackingApi();
    return this.witApi;
  }

  get project(): string {
    return this.config.azure_devops.project;
  }

  async getWorkItem(
    id: number,
    expand?: "all" | "relations" | "fields" | "links" | "none",
  ): Promise<AdoWorkItem> {
    const cacheKey = CacheKeys.workItem(id);
    // Only cache simple gets (no expand or expand=none)
    if (!expand || expand === "none") {
      const cached = getApiCache().get<AdoWorkItem>(cacheKey);
      if (cached) return cached;
    }

    const api = await this.getWitApi();
    const expandMap = {
      all: 4, // WorkItemExpand.All
      relations: 1, // WorkItemExpand.Relations
      fields: 2, // WorkItemExpand.Fields
      links: 3, // WorkItemExpand.Links
      none: 0, // WorkItemExpand.None
    };

    const item = await api.getWorkItem(
      id,
      undefined,
      undefined,
      expand ? expandMap[expand] : undefined,
    );

    if (!item || !item.id || !item.fields) {
      throw new WorkItemError(`Work item ${id} not found`);
    }

    const result: AdoWorkItem = {
      id: item.id,
      rev: item.rev ?? 0,
      url: item.url ?? "",
      fields: item.fields as AdoWorkItem["fields"],
      relations: item.relations as AdoWorkItem["relations"],
    };

    // Cache the result
    getApiCache().set(cacheKey, result);

    return result;
  }

  async createWorkItem(params: WorkItemCreateParams): Promise<AdoWorkItem> {
    const api = await this.getWitApi();

    const operations: JsonPatchOperation[] = [
      { op: "add", path: "/fields/System.Title", value: params.title },
    ];

    if (params.description) {
      operations.push({
        op: "add",
        path: "/fields/System.Description",
        value: params.description,
      });
    }
    if (params.assignedTo) {
      operations.push({
        op: "add",
        path: "/fields/System.AssignedTo",
        value: params.assignedTo,
      });
    }
    if (params.areaPath) {
      operations.push({
        op: "add",
        path: "/fields/System.AreaPath",
        value: params.areaPath,
      });
    }
    if (params.iterationPath) {
      operations.push({
        op: "add",
        path: "/fields/System.IterationPath",
        value: params.iterationPath,
      });
    }
    if (params.priority != null) {
      operations.push({
        op: "add",
        path: "/fields/Microsoft.VSTS.Common.Priority",
        value: params.priority,
      });
    }
    if (params.storyPoints != null) {
      operations.push({
        op: "add",
        path: "/fields/Microsoft.VSTS.Scheduling.StoryPoints",
        value: params.storyPoints,
      });
    }
    if (params.parentId != null) {
      operations.push({
        op: "add",
        path: "/relations/-",
        value: {
          rel: "System.LinkTypes.Hierarchy-Reverse",
          url: `${this.config.azure_devops.organization}/${this.project}/_apis/wit/workItems/${params.parentId}`,
        },
      });
    }
    if (params.customFields) {
      for (const [key, value] of Object.entries(params.customFields)) {
        operations.push({ op: "add", path: `/fields/${key}`, value });
      }
    }

    const item = await api.createWorkItem(
      undefined as unknown as JsonPatchDocument,
      operations as unknown as JsonPatchDocument,
      this.project,
      params.type,
    );

    if (!item || !item.id) {
      throw new WorkItemError("Failed to create work item");
    }

    const result: AdoWorkItem = {
      id: item.id,
      rev: item.rev ?? 0,
      url: item.url ?? "",
      fields: item.fields as AdoWorkItem["fields"],
    };

    // Cache newly created item
    getApiCache().set(CacheKeys.workItem(result.id), result);
    // Invalidate query cache since a new item exists
    getApiCache().invalidateByPrefix("wiq:");

    return result;
  }

  async updateWorkItem(params: WorkItemUpdateParams): Promise<AdoWorkItem> {
    const api = await this.getWitApi();

    const operations: JsonPatchOperation[] = [];

    if (params.title) {
      operations.push({
        op: "replace",
        path: "/fields/System.Title",
        value: params.title,
      });
    }
    if (params.description !== undefined) {
      operations.push({
        op: "replace",
        path: "/fields/System.Description",
        value: params.description,
      });
    }
    if (params.state) {
      operations.push({
        op: "replace",
        path: "/fields/System.State",
        value: params.state,
      });
    }
    if (params.assignedTo !== undefined) {
      operations.push({
        op: "replace",
        path: "/fields/System.AssignedTo",
        value: params.assignedTo,
      });
    }
    if (params.areaPath) {
      operations.push({
        op: "replace",
        path: "/fields/System.AreaPath",
        value: params.areaPath,
      });
    }
    if (params.iterationPath) {
      operations.push({
        op: "replace",
        path: "/fields/System.IterationPath",
        value: params.iterationPath,
      });
    }
    if (params.priority != null) {
      operations.push({
        op: "replace",
        path: "/fields/Microsoft.VSTS.Common.Priority",
        value: params.priority,
      });
    }
    if (params.storyPoints != null) {
      operations.push({
        op: "replace",
        path: "/fields/Microsoft.VSTS.Scheduling.StoryPoints",
        value: params.storyPoints,
      });
    }
    if (params.customFields) {
      for (const [key, value] of Object.entries(params.customFields)) {
        operations.push({ op: "replace", path: `/fields/${key}`, value });
      }
    }

    if (operations.length === 0) {
      throw new WorkItemError("No fields to update");
    }

    const item = await api.updateWorkItem(
      undefined as unknown as JsonPatchDocument,
      operations as unknown as JsonPatchDocument,
      params.id,
    );

    if (!item || !item.id) {
      throw new WorkItemError(`Failed to update work item ${params.id}`);
    }

    const result: AdoWorkItem = {
      id: item.id,
      rev: item.rev ?? 0,
      url: item.url ?? "",
      fields: item.fields as AdoWorkItem["fields"],
    };

    // Update cache with new version
    getApiCache().set(CacheKeys.workItem(result.id), result);
    // Invalidate query cache since item changed
    getApiCache().invalidateByPrefix("wiq:");

    return result;
  }

  async queryWorkItems(wiql: string): Promise<AdoWorkItem[]> {
    const api = await this.getWitApi();

    const queryResult = await api.queryByWiql(
      { query: wiql } as Wiql,
      { project: this.project },
    );

    if (!queryResult.workItems || queryResult.workItems.length === 0) {
      return [];
    }

    const ids = queryResult.workItems
      .map((wi) => wi.id)
      .filter((id): id is number => id != null);

    if (ids.length === 0) return [];

    // Fetch in batches of 200 (ADO limit)
    const batchSize = 200;
    const results: AdoWorkItem[] = [];

    for (let i = 0; i < ids.length; i += batchSize) {
      const batchIds = ids.slice(i, i + batchSize);
      const items = await api.getWorkItems(batchIds);

      for (const item of items) {
        if (item && item.id && item.fields) {
          results.push({
            id: item.id,
            rev: item.rev ?? 0,
            url: item.url ?? "",
            fields: item.fields as AdoWorkItem["fields"],
          });
        }
      }
    }

    return results;
  }
}
