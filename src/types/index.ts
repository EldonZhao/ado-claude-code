// Work item types from Azure DevOps
export type WorkItemType =
  | "Epic"
  | "Feature"
  | "User Story"
  | "Task"
  | "Bug"
  | string;

export interface LocalWorkItem {
  id: number;
  rev: number;
  url: string;
  syncedAt: string;
  type: WorkItemType;
  title: string;
  state: string;
  assignedTo?: string;
  areaPath?: string;
  iterationPath?: string;
  priority?: number;
  storyPoints?: number;
  parent?: number;
  children?: number[];
  description?: string;
  customFields?: Record<string, unknown>;
  comments?: WorkItemComment[];
}

export interface WorkItemComment {
  author: string;
  date: string;
  text: string;
}

// Config types
export interface AdoConfig {
  version: string;
  azure_devops: {
    organization: string;
    project: string;
    auth: {
      type: "pat" | "azure-ad";
      patEnvVar?: string;
    };
  };
  storage: {
    basePath: string;
    workItemsPath: string;
    instructionsPath: string;
  };
  sync: {
    autoSync: boolean;
    pullOnStartup: boolean;
    defaultQuery?: string;
    conflictResolution: "local-wins" | "remote-wins" | "ask";
  };
}

// Sync types
export interface SyncState {
  version: string;
  lastFullSync: string | null;
  project: string;
  organization: string;
  workItems: Record<
    string,
    {
      localPath: string;
      adoRev: number;
      localHash: string;
      lastSyncedAt: string;
      syncStatus: "synced" | "localModified" | "remoteModified" | "conflict";
    }
  >;
}
