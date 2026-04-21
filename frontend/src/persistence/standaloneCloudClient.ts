import type {
  CloudSyncOperation,
  GetProjectResponse,
  GlobalProjectRegistry,
  GlobalProjectRegistryEntry,
  ImportProjectResponse,
  ListProjectsResponse,
  ProjectLinkageMetadata,
  StoryWorkspaceSnapshot,
  SyncProjectResponse
} from "@scenaairo/shared";

import type { StorageLike } from "../auth/stubAuthBoundary";

const REGISTRY_KEY = "standalone-cloud:registry";
const SNAPSHOT_KEY = "standalone-cloud:project";
const LINKAGE_KEY = "standalone-cloud:linkage";

function cloneSnapshot(snapshot: StoryWorkspaceSnapshot): StoryWorkspaceSnapshot {
  return JSON.parse(JSON.stringify(snapshot)) as StoryWorkspaceSnapshot;
}

function cloneLinkage(
  linkage: ProjectLinkageMetadata
): ProjectLinkageMetadata {
  return JSON.parse(JSON.stringify(linkage)) as ProjectLinkageMetadata;
}

function upsertById<T extends { id: string }>(items: T[], nextItem: T) {
  const withoutCurrent = items.filter((item) => item.id !== nextItem.id);
  return [...withoutCurrent, nextItem];
}

function deleteById<T extends { id: string }>(items: T[], id: string) {
  return items.filter((item) => item.id !== id);
}

export class StandaloneCloudPersistenceClient {
  constructor(
    private readonly storage: StorageLike,
    private readonly storagePrefix: string,
    private readonly now: () => string = () => new Date().toISOString()
  ) {}

  async getProject(accountId: string, projectId: string): Promise<GetProjectResponse> {
    const linkage = this.getLinkage(projectId);
    const snapshot = this.getSnapshot(projectId);

    if (!linkage || !snapshot || linkage.linkedAccountId !== accountId) {
      return {
        linkage: null,
        snapshot: null
      };
    }

    return {
      linkage: cloneLinkage(linkage),
      snapshot: cloneSnapshot(snapshot)
    };
  }

  async importProject(
    accountId: string,
    payload: {
      linkage: ProjectLinkageMetadata | null;
      snapshot: StoryWorkspaceSnapshot;
    }
  ): Promise<ImportProjectResponse> {
    const timestamp = this.now();
    const existing = this.getLinkage(payload.snapshot.project.id);
    const linkage: ProjectLinkageMetadata = {
      entityId: payload.snapshot.project.id,
      cloudLinked: true,
      lastImportedAt: existing?.lastImportedAt ?? timestamp,
      lastSyncedAt: timestamp,
      linkedAccountId: accountId
    };

    if (!existing) {
      linkage.lastImportedAt = timestamp;
    }

    this.saveSnapshot(payload.snapshot);
    this.saveLinkage(linkage);
    this.saveRegistryEntry(payload.snapshot, linkage, timestamp);

    return {
      created: existing === null,
      linkage: cloneLinkage(linkage),
      snapshot: cloneSnapshot(payload.snapshot)
    };
  }

  async listProjects(accountId: string): Promise<ListProjectsResponse> {
    const registry = this.getRegistry();

    return {
      projects: registry.projects
        .filter((project) => project.linkedAccountId === accountId)
        .map((project) => ({ ...project }))
    };
  }

  async syncProject(
    accountId: string,
    projectId: string,
    payload: {
      operations: CloudSyncOperation[];
    }
  ): Promise<SyncProjectResponse> {
    const current = this.getSnapshot(projectId);
    const currentLinkage = this.getLinkage(projectId);

    if (!current || !currentLinkage || currentLinkage.linkedAccountId !== accountId) {
      throw new Error("project_not_found");
    }

    let nextSnapshot = cloneSnapshot(current);

    for (const operation of payload.operations) {
      if (operation.action === "delete") {
        switch (operation.kind) {
          case "episode":
            nextSnapshot = {
              ...nextSnapshot,
              episodes: deleteById(nextSnapshot.episodes, operation.entityId)
            };
            break;
          case "node":
            nextSnapshot = {
              ...nextSnapshot,
              nodes: deleteById(nextSnapshot.nodes, operation.entityId)
            };
            break;
          case "object":
            nextSnapshot = {
              ...nextSnapshot,
              objects: deleteById(nextSnapshot.objects, operation.entityId)
            };
            break;
          case "temporary_drawer":
            nextSnapshot = {
              ...nextSnapshot,
              temporaryDrawer: deleteById(nextSnapshot.temporaryDrawer, operation.entityId)
            };
            break;
          case "project":
            break;
        }

        continue;
      }

      switch (operation.kind) {
        case "project":
          nextSnapshot = {
            ...nextSnapshot,
            project: operation.payload
          };
          break;
        case "episode":
          nextSnapshot = {
            ...nextSnapshot,
            episodes: upsertById(nextSnapshot.episodes, operation.payload)
          };
          break;
        case "node":
          nextSnapshot = {
            ...nextSnapshot,
            nodes: upsertById(nextSnapshot.nodes, operation.payload)
          };
          break;
        case "object":
          nextSnapshot = {
            ...nextSnapshot,
            objects: upsertById(nextSnapshot.objects, operation.payload)
          };
          break;
        case "temporary_drawer":
          nextSnapshot = {
            ...nextSnapshot,
            temporaryDrawer: upsertById(nextSnapshot.temporaryDrawer, operation.payload)
          };
          break;
      }
    }

    const linkage: ProjectLinkageMetadata = {
      ...currentLinkage,
      lastSyncedAt: this.now()
    };

    this.saveSnapshot(nextSnapshot);
    this.saveLinkage(linkage);
    this.saveRegistryEntry(nextSnapshot, linkage, linkage.lastSyncedAt ?? this.now());

    return {
      linkage: cloneLinkage(linkage),
      snapshot: cloneSnapshot(nextSnapshot)
    };
  }

  private getRegistry(): GlobalProjectRegistry {
    const saved = this.storage.getItem(this.registryKey());

    if (!saved) {
      return {
        activeProjectId: null,
        projects: []
      };
    }

    return JSON.parse(saved) as GlobalProjectRegistry;
  }

  private getLinkage(projectId: string): ProjectLinkageMetadata | null {
    const saved = this.storage.getItem(this.linkageKey(projectId));
    return saved ? (JSON.parse(saved) as ProjectLinkageMetadata) : null;
  }

  private getSnapshot(projectId: string): StoryWorkspaceSnapshot | null {
    const saved = this.storage.getItem(this.snapshotKey(projectId));
    return saved ? (JSON.parse(saved) as StoryWorkspaceSnapshot) : null;
  }

  private saveLinkage(linkage: ProjectLinkageMetadata) {
    this.storage.setItem(this.linkageKey(linkage.entityId), JSON.stringify(linkage));
  }

  private saveRegistryEntry(
    snapshot: StoryWorkspaceSnapshot,
    linkage: ProjectLinkageMetadata,
    timestamp: string
  ) {
    const registry = this.getRegistry();
    const nextEntry: GlobalProjectRegistryEntry = {
      cloudLinked: linkage.cloudLinked,
      lastOpenedAt: timestamp,
      linkedAccountId: linkage.linkedAccountId,
      projectId: snapshot.project.id,
      summary: snapshot.project.summary,
      title: snapshot.project.title,
      updatedAt: timestamp
    };

    const nextRegistry: GlobalProjectRegistry = {
      activeProjectId: snapshot.project.id,
      projects: [
        nextEntry,
        ...registry.projects.filter((project) => project.projectId !== snapshot.project.id)
      ]
    };

    this.storage.setItem(this.registryKey(), JSON.stringify(nextRegistry));
  }

  private saveSnapshot(snapshot: StoryWorkspaceSnapshot) {
    this.storage.setItem(this.snapshotKey(snapshot.project.id), JSON.stringify(snapshot));
  }

  private linkageKey(projectId: string) {
    return `${this.storagePrefix}:${LINKAGE_KEY}:${projectId}`;
  }

  private registryKey() {
    return `${this.storagePrefix}:${REGISTRY_KEY}`;
  }

  private snapshotKey(projectId: string) {
    return `${this.storagePrefix}:${SNAPSHOT_KEY}:${projectId}`;
  }
}
