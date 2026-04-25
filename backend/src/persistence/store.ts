// 이 파일은 백엔드 파일 기반 퍼시스턴스 저장소 동작을 구현합니다.
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";

import type {
  CloudSyncOperation,
  GetProjectResponse,
  ImportProjectResponse,
  ListProjectsResponse,
  SyncProjectResponse
} from "@scenaairo/shared";
import type {
  EntityId,
  StoryEpisode,
  StoryNode,
  StoryObject,
  StoryWorkspaceSnapshot,
  TemporaryDrawerItem
} from "@scenaairo/shared";
import type {
  GlobalProjectRegistryEntry,
  ProjectLinkageMetadata
} from "@scenaairo/shared";
import {
  assertFreshNodeRevision,
  canonicalizeNodeOrderByEpisode,
  getExpectedParentLevel,
  validateNodeGraphIntegrity
} from "./node-order.js";

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

function sortDrawer(items: TemporaryDrawerItem[]): TemporaryDrawerItem[] {
  return [...items].sort((left, right) => left.createdAt.localeCompare(right.createdAt));
}

function normalizeSnapshot(snapshot: StoryWorkspaceSnapshot): StoryWorkspaceSnapshot {
  const clonedSnapshot = cloneSnapshot(snapshot);
  const normalizedEpisodes = sortEpisodes(clonedSnapshot.episodes);
  const fallbackEpisodeId =
    normalizedEpisodes.find(
      (episode) => episode.id === clonedSnapshot.project.activeEpisodeId
    )?.id ??
    normalizedEpisodes[0]?.id ??
    null;
  const knownEpisodeIds = new Set(normalizedEpisodes.map((episode) => episode.id));
  const normalizedObjects = clonedSnapshot.objects
    .map((object) => {
      const episodeId =
        object.episodeId && knownEpisodeIds.has(object.episodeId)
          ? object.episodeId
          : fallbackEpisodeId;

      if (!episodeId) {
        return null;
      }

      return {
        ...object,
        episodeId,
        projectId: clonedSnapshot.project.id
      };
    })
    .filter((object): object is StoryObject => object !== null);
  const objectsById = new Map(normalizedObjects.map((object) => [object.id, object]));
  const normalizedNodes = clonedSnapshot.nodes.map((node) => ({
    ...node,
    objectIds: [...new Set(
      node.objectIds.filter((objectId) => {
        const object = objectsById.get(objectId);
        return (
          object !== undefined &&
          object.projectId === node.projectId
        );
      })
    )]
  }));
  const normalizedNodesByEpisode = canonicalizeNodeOrderByEpisode(
    normalizedNodes,
    normalizedEpisodes
  );
  // canonicalization은 orderIndex만 재정렬하고 노드 배치/시각 필드는 그대로 유지합니다.

  return {
    ...clonedSnapshot,
    episodes: normalizedEpisodes,
    objects: sortObjects(normalizedObjects),
    nodes: normalizedNodesByEpisode,
    temporaryDrawer: sortDrawer(clonedSnapshot.temporaryDrawer)
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

function ensureObjectDependencies(snapshot: StoryWorkspaceSnapshot, object: StoryObject) {
  ensureEpisodeExists(snapshot, object.episodeId);
  const episode = snapshot.episodes.find((entry) => entry.id === object.episodeId);

  if (!episode || episode.projectId !== object.projectId) {
    throw new Error("object_episode_project_mismatch");
  }
}

function ensureNodeDependencies(snapshot: StoryWorkspaceSnapshot, node: StoryNode) {
  ensureEpisodeExists(snapshot, node.episodeId);

  if (node.parentId) {
    const parentNode = snapshot.nodes.find((entry) => entry.id === node.parentId);

    if (!parentNode) {
      throw new Error("missing_parent_node_dependency");
    }

    if (parentNode.projectId !== node.projectId) {
      throw new Error("parent_project_mismatch");
    }

    if (parentNode.episodeId !== node.episodeId) {
      throw new Error("parent_episode_mismatch");
    }

    const expectedParentLevel = getExpectedParentLevel(node.level);

    if (!expectedParentLevel || parentNode.level !== expectedParentLevel) {
      throw new Error("invalid_parent_level");
    }
  }

  for (const objectId of node.objectIds) {
    const object = snapshot.objects.find((entry) => entry.id === objectId);

    if (!object) {
      throw new Error("missing_object_dependency");
    }

    if (object.projectId !== node.projectId) {
      throw new Error("object_project_mismatch");
    }
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

  if (item.sourceNodeId) {
    const sourceNode = snapshot.nodes.find((node) => node.id === item.sourceNodeId);

    if (sourceNode && sourceNode.episodeId !== item.episodeId) {
      throw new Error("drawer_episode_mismatch");
    }
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

    const normalizedSnapshot = normalizeSnapshot(snapshot);
    validateNodeGraphIntegrity(normalizedSnapshot);

    account.projects[projectId] = {
      linkage: nextLinkage,
      snapshot: normalizedSnapshot
    };

    await this.writeDatabase(database);

    return {
      created: true,
      linkage: nextLinkage,
      snapshot: normalizedSnapshot
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
            const removedObjectIds = new Set(
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
                  objectIds: node.objectIds.filter(
                    (objectId) => !removedObjectIds.has(objectId)
                  )
                })),
              objects: snapshot.objects.filter(
                (object) => object.episodeId !== operation.entityId
              ),
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
          ensureObjectDependencies(snapshot, operation.payload);
          snapshot = {
            ...snapshot,
            objects: upsertById(snapshot.objects, operation.payload)
          };
          break;
        case "node":
          ensureProjectShell(snapshot, operation.payload.projectId);
          assertFreshNodeRevision(
            snapshot.nodes.find((entry) => entry.id === operation.payload.id),
            operation.payload
          );
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
    const normalizedSnapshot = normalizeSnapshot(snapshot);
    validateNodeGraphIntegrity(normalizedSnapshot);

    account.projects[projectId] = {
      linkage: nextLinkage,
      snapshot: normalizedSnapshot
    };

    await this.writeDatabase(database);

    return {
      linkage: nextLinkage,
      snapshot: normalizedSnapshot
    };
  }
}

