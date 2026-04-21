import type {
  AppEnvironment,
  EntityId,
  StoryEpisode,
  StoryNode,
  StoryObject,
  StoryProject,
  StoryWorkspaceSnapshot,
  TemporaryDrawerItem
} from "../types/domain.js";
import type {
  GlobalProjectRegistryEntry,
  PersistedEntityKind,
  ProjectLinkageMetadata
} from "../types/persistence.js";

export interface BackendHealthContract {
  environment: AppEnvironment;
  service: "backend";
  status: "ok";
}

export type CloudSyncOperation =
  | {
      action: "upsert";
      kind: "project";
      payload: StoryProject;
    }
  | {
      action: "upsert";
      kind: "episode";
      payload: StoryEpisode;
    }
  | {
      action: "upsert";
      kind: "object";
      payload: StoryObject;
    }
  | {
      action: "upsert";
      kind: "node";
      payload: StoryNode;
    }
  | {
      action: "upsert";
      kind: "temporary_drawer";
      payload: TemporaryDrawerItem;
    }
  | {
      action: "delete";
      kind: PersistedEntityKind;
      entityId: EntityId;
      projectId: EntityId;
    };

export interface ImportProjectRequest {
  linkage: ProjectLinkageMetadata | null;
  snapshot: StoryWorkspaceSnapshot;
}

export interface ImportProjectResponse {
  created: boolean;
  linkage: ProjectLinkageMetadata;
  snapshot: StoryWorkspaceSnapshot;
}

export interface GetProjectResponse {
  linkage: ProjectLinkageMetadata | null;
  snapshot: StoryWorkspaceSnapshot | null;
}

export interface ListProjectsResponse {
  projects: GlobalProjectRegistryEntry[];
}

export interface SyncProjectRequest {
  operations: CloudSyncOperation[];
}

export interface SyncProjectResponse {
  linkage: ProjectLinkageMetadata;
  snapshot: StoryWorkspaceSnapshot;
}
