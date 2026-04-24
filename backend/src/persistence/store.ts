import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";

import type {
  CloudSyncOperation,
  GetProjectResponse,
  ImportProjectResponse,
  ListProjectsResponse,
  SyncProjectResponse
} from "@ariad/shared";
import type {
  EntityId,
  StoryEpisode,
  StoryNode,
  StoryObject,
  StoryWorkspaceSnapshot,
  TemporaryDrawerItem
} from "@ariad/shared";
import type {
  GlobalProjectRegistryEntry,
  ProjectLinkageMetadata
} from "@ariad/shared";

interface StoredProjectRecord {
  linkage: ProjectLinkageMetadata;
  snapshot: StoryWorkspaceSnapshot;
}

interface AccountCloudStore {
  projects: Record<string, StoredProjectRecord>;
}

interface CloudStoreDatabase {
  accounts: Record<string, AccountCloudStore>;
}

interface PersistenceStoreOptions {
  cloudDataDir: string;
  now?: () => string;
}

function upsertById<T extends { id: EntityId }>(items: T[], item: T): T[] {
  const next = items.filter((entry) => entry.id !== item.id);
  next.push(item);
  return next;
}

function removeById<T extends { id: EntityId }>(items: T[], entityId: EntityId): T[] {
  return items.filter((entry) => entry.id !== entityId);
}

function cloneSnapshot(snapshot: StoryWorkspaceSnapshot): StoryWorkspaceSnapshot {
  return JSON.parse(JSON.stringify(snapshot)) as StoryWorkspaceSnapshot;
}

function sortEpisodes(episodes: StoryEpisode[]): StoryEpisode[] {
  return [...episodes].sort((left, right) => left.createdAt.localeCompare(right.createdAt));
}

function sortObjects(objects: StoryObject[]): StoryObject[] {
  return [...objects].sort((left, right) => left.createdAt.localeCompare(right.createdAt));
}

function sortNodes(nodes: StoryNode[]): StoryNode[] {
  return [...nodes].sort((left, right) => left.orderIndex - right.orderIndex);
}

function sortDrawer(items: TemporaryDrawerItem[]): TemporaryDrawerItem[] {
  return [...items].sort((left, right) => left.createdAt.localeCompare(right.createdAt));
}

function normalizeObjectEpisodeScope(snapshot: StoryWorkspaceSnapshot): StoryWorkspaceSnapshot {
  const fallbackEpisodeId = snapshot.project.activeEpisodeId ?? snapshot.episodes[0]?.id ?? "";
  const nodeEpisodeByObjectId = new Map<string, string>();

  for (const node of snapshot.nodes) {
    for (const objectId of node.objectIds) {
      if (!nodeEpisodeByObjectId.has(objectId)) {
        nodeEpisodeByObjectId.set(objectId, node.episodeId);
      }
    }
  }

  const objects = snapshot.objects.map((object) => ({
    ...object,
    episodeId:
      (object as StoryObject & { episodeId?: string }).episodeId ??
      nodeEpisodeByObjectId.get(object.id) ??
      fallbackEpisodeId
  }));
  const objectEpisodeById = new Map(objects.map((object) => [object.id, object.episodeId]));
  const nodes = snapshot.nodes.map((node) => ({
    ...node,
    objectIds: node.objectIds.filter((objectId) => objectEpisodeById.get(objectId) === node.episodeId)
  }));

  return {
    ...snapshot,
    nodes,
    objects
  };
}

function normalizeSnapshot(snapshot: StoryWorkspaceSnapshot): StoryWorkspaceSnapshot {
  const scopedSnapshot = normalizeObjectEpisodeScope(cloneSnapshot(snapshot));

  return {
    ...scopedSnapshot,
    episodes: sortEpisodes(scopedSnapshot.episodes),
    objects: sortObjects(scopedSnapshot.objects),
    nodes: sortNodes(scopedSnapshot.nodes),
    temporaryDrawer: sortDrawer(scopedSnapshot.temporaryDrawer)
  };
}

function ensureProjectShell(snapshot: StoryWorkspaceSnapshot, projectId: EntityId) {
  if (snapshot.project.id !== projectId) {
    throw new Error("project_mismatch");
  }
}

function ensureEpisodeExists(snapshot: StoryWorkspaceSnapshot, episodeId: EntityId) {
  if (!snapshot.episodes.some((episode) => episode.id === episodeId)) {
    throw new Error("missing_episode_dependency");
  }
}

function ensureNodeDependencies(snapshot: StoryWorkspaceSnapshot, node: StoryNode) {
  ensureEpisodeExists(snapshot, node.episodeId);

  if (node.parentId && !snapshot.nodes.some((entry) => entry.id === node.parentId)) {
    throw new Error("missing_parent_node_dependency");
  }

  if (
    node.objectIds.some(
      (objectId) => !snapshot.objects.some(
        (entry) => entry.id === objectId && entry.episodeId === node.episodeId
      )
    )
  ) {
    throw new Error("missing_object_dependency");
  }
}

function ensureDrawerDependencies(
  snapshot: StoryWorkspaceSnapshot,
  item: TemporaryDrawerItem
) {
  ensureEpisodeExists(snapshot, item.episodeId);

  if (
    item.sourceNodeId &&
    !snapshot.nodes.some((node) => node.id === item.sourceNodeId)
  ) {
    throw new Error("missing_drawer_node_dependency");
  }
}

function ensureProjectRecord(
  account: AccountCloudStore,
  projectId: EntityId
): StoredProjectRecord {
  const record = account.projects[projectId];

  if (!record) {
    throw new Error("missing_project");
  }

  return record;
}

export class FileBackedPersistenceStore {
  private readonly cloudDataDir: string;

  private readonly now: () => string;

  constructor(options: PersistenceStoreOptions) {
    this.cloudDataDir = path.resolve(options.cloudDataDir);
    this.now = options.now ?? (() => new Date().toISOString());
  }

  private get databasePath() {
    return path.join(this.cloudDataDir, "cloud-store.json");
  }

  private async readDatabase(): Promise<CloudStoreDatabase> {
    try {
      const content = await readFile(this.databasePath, "utf8");
      return JSON.parse(content) as CloudStoreDatabase;
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === "ENOENT") {
        return {
          accounts: {}
        };
      }

      throw error;
    }
  }

  private async writeDatabase(database: CloudStoreDatabase) {
    await mkdir(this.cloudDataDir, {
      recursive: true
    });
    await writeFile(this.databasePath, JSON.stringify(database, null, 2), "utf8");
  }

  private ensureAccount(database: CloudStoreDatabase, accountId: string): AccountCloudStore {
    database.accounts[accountId] ??= {
      projects: {}
    };

    return database.accounts[accountId];
  }

  async listProjects(accountId: string): Promise<ListProjectsResponse> {
    const database = await this.readDatabase();
    const account = database.accounts[accountId];

    if (!account) {
      return {
        projects: []
      };
    }

    const projects: GlobalProjectRegistryEntry[] = Object.values(account.projects).map(
      ({ linkage, snapshot }) => ({
        cloudLinked: linkage.cloudLinked,
        lastOpenedAt: snapshot.project.updatedAt,
        linkedAccountId: linkage.linkedAccountId,
        projectId: snapshot.project.id,
        summary: snapshot.project.summary,
        title: snapshot.project.title,
        updatedAt: snapshot.project.updatedAt
      })
    );

    return {
      projects
    };
  }

  async getProject(accountId: string, projectId: EntityId): Promise<GetProjectResponse> {
    const database = await this.readDatabase();
    const account = database.accounts[accountId];
    const record = account?.projects[projectId];

    if (!record) {
      return {
        linkage: null,
        snapshot: null
      };
    }

    return {
      linkage: { ...record.linkage },
      snapshot: normalizeSnapshot(record.snapshot)
    };
  }

  async importProject(
    accountId: string,
    snapshot: StoryWorkspaceSnapshot,
    linkage: ProjectLinkageMetadata | null
  ): Promise<ImportProjectResponse> {
    const database = await this.readDatabase();
    const account = this.ensureAccount(database, accountId);
    const projectId = snapshot.project.id;
    const now = this.now();
    const existing = account.projects[projectId];

    if (existing) {
      return {
        created: false,
        linkage: { ...existing.linkage },
        snapshot: normalizeSnapshot(existing.snapshot)
      };
    }

    const nextLinkage: ProjectLinkageMetadata = {
      entityId: linkage?.entityId ?? projectId,
      cloudLinked: true,
      linkedAccountId: accountId,
      lastImportedAt: now,
      lastSyncedAt: now
    };

    account.projects[projectId] = {
      linkage: nextLinkage,
      snapshot: normalizeSnapshot(snapshot)
    };

    await this.writeDatabase(database);

    return {
      created: true,
      linkage: nextLinkage,
      snapshot: normalizeSnapshot(snapshot)
    };
  }

  async syncProject(
    accountId: string,
    projectId: EntityId,
    operations: CloudSyncOperation[]
  ): Promise<SyncProjectResponse> {
    const database = await this.readDatabase();
    const account = this.ensureAccount(database, accountId);
    const record = ensureProjectRecord(account, projectId);
    let snapshot = normalizeSnapshot(record.snapshot);

    for (const operation of operations) {
      if (
        operation.action === "delete" &&
        operation.projectId !== projectId
      ) {
        throw new Error("project_mismatch");
      }

      if (operation.action === "delete") {
        switch (operation.kind) {
          case "project":
            throw new Error("project_delete_not_supported");
          case "episode": {
            const deletedObjectIds = new Set(
              snapshot.objects
                .filter((object) => object.episodeId === operation.entityId)
                .map((object) => object.id)
            );
            snapshot = {
              ...snapshot,
              episodes: removeById(snapshot.episodes, operation.entityId),
              nodes: snapshot.nodes
                .filter((node) => node.episodeId !== operation.entityId)
                .map((node) => ({
                  ...node,
                  objectIds: node.objectIds.filter((objectId) => !deletedObjectIds.has(objectId))
                })),
              objects: snapshot.objects.filter((object) => object.episodeId !== operation.entityId),
              temporaryDrawer: snapshot.temporaryDrawer.filter(
                (item) => item.episodeId !== operation.entityId
              )
            };
            break;
          }
          case "object":
            snapshot = {
              ...snapshot,
              nodes: snapshot.nodes.map((node) => ({
                ...node,
                objectIds: node.objectIds.filter((objectId) => objectId !== operation.entityId)
              })),
              objects: removeById(snapshot.objects, operation.entityId)
            };
            break;
          case "node":
            snapshot = {
              ...snapshot,
              nodes: removeById(snapshot.nodes, operation.entityId),
              temporaryDrawer: snapshot.temporaryDrawer.map((item) =>
                item.sourceNodeId === operation.entityId
                  ? { ...item, sourceNodeId: null }
                  : item
              )
            };
            break;
          case "temporary_drawer":
            snapshot = {
              ...snapshot,
              temporaryDrawer: removeById(snapshot.temporaryDrawer, operation.entityId)
            };
            break;
        }

        continue;
      }

      switch (operation.kind) {
        case "project":
          ensureProjectShell(snapshot, operation.payload.id);
          snapshot = {
            ...snapshot,
            project: operation.payload
          };
          break;
        case "episode":
          ensureProjectShell(snapshot, operation.payload.projectId);
          snapshot = {
            ...snapshot,
            episodes: upsertById(snapshot.episodes, operation.payload)
          };
          break;
        case "object":
          ensureProjectShell(snapshot, operation.payload.projectId);
          ensureEpisodeExists(snapshot, operation.payload.episodeId);
          snapshot = {
            ...snapshot,
            objects: upsertById(snapshot.objects, operation.payload)
          };
          break;
        case "node":
          ensureProjectShell(snapshot, operation.payload.projectId);
          ensureNodeDependencies(snapshot, operation.payload);
          snapshot = {
            ...snapshot,
            nodes: upsertById(snapshot.nodes, operation.payload)
          };
          break;
        case "temporary_drawer":
          ensureProjectShell(snapshot, operation.payload.projectId);
          ensureDrawerDependencies(snapshot, operation.payload);
          snapshot = {
            ...snapshot,
            temporaryDrawer: upsertById(snapshot.temporaryDrawer, operation.payload)
          };
          break;
      }
    }

    const nextLinkage: ProjectLinkageMetadata = {
      ...record.linkage,
      cloudLinked: true,
      linkedAccountId: accountId,
      lastSyncedAt: this.now()
    };

    account.projects[projectId] = {
      linkage: nextLinkage,
      snapshot: normalizeSnapshot(snapshot)
    };

    await this.writeDatabase(database);

    return {
      linkage: nextLinkage,
      snapshot: normalizeSnapshot(snapshot)
    };
  }
}
