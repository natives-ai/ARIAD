// 이 파일은 워크스페이스 퍼시스턴스 상태 전환과 동기화 제어를 담당합니다.
import type {
  AuthSession,
  CloudSyncOperation,
  GetProjectResponse,
  GlobalProjectRegistry,
  GlobalProjectRegistryEntry,
  ImportProjectResponse,
  ListProjectsResponse,
  PersistedEntityKind,
  ProjectLinkageMetadata,
  StoryEpisode,
  StoryNode,
  StoryNodeContentMode,
  StoryNodeLevel,
  StoryObjectCategory,
  StoryWorkspaceSnapshot,
  SyncProjectResponse,
  TemporaryDrawerItem
} from "@scenaairo/shared";

import {
  getNodeDrawerLabel,
  parseDrawerPayload,
  serializeDrawerPayload
} from "./drawerPayload";
import type { LocalPersistenceStore, PersistenceCacheScope } from "./localStore";
import { PersistenceFlushQueue } from "./flushQueue";
import {
  clampInsertIndex,
  collectDescendantIds,
  collectSubtreeNodes,
  inferParentId,
  isDescendant,
  normalizeNodeOrder,
  sortNodesByOrder
} from "./nodeTree";
import {
  createEmptyWorkspaceShell,
  createStarterWorkspace,
  isLegacySampleWorkspaceSnapshot
} from "./sampleWorkspace";
import { createStableId } from "./stableId";

export type WorkspaceSyncStatus =
  | "booting"
  | "guest-local"
  | "authenticated-empty"
  | "importing"
  | "syncing"
  | "synced"
  | "error";

export interface WorkspaceHistoryState {
  canRedo: boolean;
  canUndo: boolean;
}

export interface WorkspacePersistenceState {
  cloudProjectCount: number | null;
  history: WorkspaceHistoryState;
  lastError: string | null;
  linkage: ProjectLinkageMetadata | null;
  registry: GlobalProjectRegistry;
  session: AuthSession;
  snapshot: StoryWorkspaceSnapshot;
  syncStatus: WorkspaceSyncStatus;
}

export interface AuthBoundary {
  getCurrentSession(): Promise<AuthSession>;
  signIn(): Promise<AuthSession>;
  signOut(): Promise<AuthSession>;
}

export interface CloudPersistenceGateway {
  getProject(projectId: string): Promise<GetProjectResponse>;
  importProject(
    payload: {
      linkage: ProjectLinkageMetadata | null;
      snapshot: StoryWorkspaceSnapshot;
    }
  ): Promise<ImportProjectResponse>;
  listProjects(): Promise<ListProjectsResponse>;
  syncProject(
    projectId: string,
    payload: {
      operations: CloudSyncOperation[];
    }
  ): Promise<SyncProjectResponse>;
}

export interface WorkspacePersistenceControllerDependencies {
  auth: AuthBoundary;
  cloud: CloudPersistenceGateway;
  flushDebounceMs?: number;
  local: LocalPersistenceStore;
  now?: () => string;
  createId?: (kind: PersistedEntityKind) => string;
}

type WorkspaceListener = (state: WorkspacePersistenceState) => void;

export interface NodeContentDraft {
  contentMode: StoryNodeContentMode;
  keywords: string[];
  text: string;
}

export interface NodeVisualStateDraft {
  isCollapsed?: boolean;
  isFixed?: boolean;
  isImportant?: boolean;
}

export interface NodePlacementDraft {
  canvasX?: number;
  canvasY?: number;
}

export interface StoryObjectDraft {
  category: StoryObjectCategory;
  name: string;
  summary: string;
}

const defaultNodeXByLevel: Record<StoryNodeLevel, number> = {
  detail: 754,
  major: 58,
  minor: 406
};

const defaultNodeYByLevel: Record<StoryNodeLevel, number> = {
  detail: 136,
  major: 56,
  minor: 96
};

const defaultNodeHeightByLevel: Record<StoryNodeLevel, number> = {
  detail: 102,
  major: 102,
  minor: 102
};

const nodeVerticalSpacing = 148;
const minimumNodeVerticalGap = 8;

// 게스트/계정별 로컬 캐시 스코프를 계산합니다.
function getCacheScopeForSession(session: AuthSession): PersistenceCacheScope {
  if (session.mode === "authenticated" && session.accountId) {
    return `account:${session.accountId}`;
  }

  return "guest";
}

function cloneSnapshot(snapshot: StoryWorkspaceSnapshot): StoryWorkspaceSnapshot {
  return JSON.parse(JSON.stringify(snapshot)) as StoryWorkspaceSnapshot;
}

function snapshotsMatch(
  left: StoryWorkspaceSnapshot,
  right: StoryWorkspaceSnapshot
) {
  return JSON.stringify(left) === JSON.stringify(right);
}

function cloneLinkage(
  linkage: ProjectLinkageMetadata | null
): ProjectLinkageMetadata | null {
  return linkage ? { ...linkage } : null;
}

function createRegistryEntry(
  snapshot: StoryWorkspaceSnapshot,
  linkage: ProjectLinkageMetadata | null,
  now: string
): GlobalProjectRegistryEntry {
  return {
    cloudLinked: linkage?.cloudLinked ?? false,
    lastOpenedAt: now,
    linkedAccountId: linkage?.linkedAccountId ?? null,
    projectId: snapshot.project.id,
    summary: snapshot.project.summary,
    title: snapshot.project.title,
    updatedAt: now
  };
}

function upsertRegistryEntry(
  registry: GlobalProjectRegistry,
  entry: GlobalProjectRegistryEntry
): GlobalProjectRegistry {
  const projects = registry.projects.filter(
    (project) => project.projectId !== entry.projectId
  );

  projects.unshift(entry);

  return {
    activeProjectId: entry.projectId,
    projects
  };
}

function createDeleteOperation(
  kind: PersistedEntityKind,
  projectId: string,
  entityId: string
): CloudSyncOperation {
  return {
    action: "delete",
    entityId,
    kind,
    projectId
  };
}

function createNodeOperations(
  previousNodes: StoryNode[],
  nextNodes: StoryNode[],
  projectId: string
) {
  const nextIds = new Set(nextNodes.map((node) => node.id));
  const operations: CloudSyncOperation[] = [];

  for (const previousNode of previousNodes) {
    if (!nextIds.has(previousNode.id)) {
      operations.push(createDeleteOperation("node", projectId, previousNode.id));
    }
  }

  for (const node of nextNodes) {
    operations.push({
      action: "upsert",
      kind: "node",
      payload: node
    });
  }

  return operations;
}

function createEpisodeOperations(
  previousEpisodes: StoryWorkspaceSnapshot["episodes"],
  nextEpisodes: StoryWorkspaceSnapshot["episodes"],
  projectId: string
) {
  const nextIds = new Set(nextEpisodes.map((episode) => episode.id));
  const operations: CloudSyncOperation[] = [];

  for (const previousEpisode of previousEpisodes) {
    if (!nextIds.has(previousEpisode.id)) {
      operations.push(createDeleteOperation("episode", projectId, previousEpisode.id));
    }
  }

  for (const episode of nextEpisodes) {
    operations.push({
      action: "upsert",
      kind: "episode",
      payload: episode
    });
  }

  return operations;
}

function createObjectOperations(
  previousObjects: StoryWorkspaceSnapshot["objects"],
  nextObjects: StoryWorkspaceSnapshot["objects"],
  projectId: string
) {
  const nextIds = new Set(nextObjects.map((object) => object.id));
  const operations: CloudSyncOperation[] = [];

  for (const previousObject of previousObjects) {
    if (!nextIds.has(previousObject.id)) {
      operations.push(createDeleteOperation("object", projectId, previousObject.id));
    }
  }

  for (const object of nextObjects) {
    operations.push({
      action: "upsert",
      kind: "object",
      payload: object
    });
  }

  return operations;
}

function createDrawerOperations(
  previousItems: TemporaryDrawerItem[],
  nextItems: TemporaryDrawerItem[],
  projectId: string
) {
  const nextIds = new Set(nextItems.map((item) => item.id));
  const operations: CloudSyncOperation[] = [];

  for (const previousItem of previousItems) {
    if (!nextIds.has(previousItem.id)) {
      operations.push(
        createDeleteOperation("temporary_drawer", projectId, previousItem.id)
      );
    }
  }

  for (const item of nextItems) {
    operations.push({
      action: "upsert",
      kind: "temporary_drawer",
      payload: item
    });
  }

  return operations;
}

function stampNodes(nodes: StoryNode[], timestamp: string) {
  return nodes.map((node) => ({
    ...node,
    updatedAt: timestamp
  }));
}

function sanitizeKeywords(keywords: string[]) {
  return [...new Set(keywords.map((keyword) => keyword.trim()).filter(Boolean))];
}

function sanitizeText(value: string) {
  return value.trim();
}

// 이 함수는 같은 레인의 기존 간격으로 노드 높이를 추정합니다.
function inferNodeHeightFromLaneSpacing(
  level: StoryNodeLevel,
  currentY: number,
  nextY: number | null
) {
  const defaultHeight = defaultNodeHeightByLevel[level];

  if (nextY === null) {
    return defaultHeight;
  }

  return Math.max(defaultHeight, nextY - currentY - minimumNodeVerticalGap);
}

// 이 함수는 기존 레인 배치 간격을 반영해 다음 노드의 기본 배치를 계산합니다.
function getNextNodePlacement(level: StoryNodeLevel, orderedNodes: StoryNode[]) {
  const sameLevelNodes = orderedNodes.filter((node) => node.level === level);

  if (sameLevelNodes.length === 0) {
    return {
      canvasX: defaultNodeXByLevel[level],
      canvasY: defaultNodeYByLevel[level]
    };
  }

  const sortedLanePlacements = sameLevelNodes
    .map((node, index) => {
      const fallbackY = defaultNodeYByLevel[level] + index * nodeVerticalSpacing;
      return {
        node,
        y: node.canvasY ?? fallbackY
      };
    })
    .sort((left, right) => left.y - right.y);
  const maxBottom = sortedLanePlacements.reduce((current, entry, index) => {
    const nextEntry = sortedLanePlacements[index + 1] ?? null;
    const inferredHeight = inferNodeHeightFromLaneSpacing(level, entry.y, nextEntry?.y ?? null);
    return Math.max(current, entry.y + inferredHeight);
  }, defaultNodeYByLevel[level] - nodeVerticalSpacing);

  return {
    canvasX: defaultNodeXByLevel[level],
    canvasY: Math.max(
      defaultNodeYByLevel[level],
      Math.ceil(maxBottom + minimumNodeVerticalGap)
    )
  };
}

function getActiveEpisode(snapshot: StoryWorkspaceSnapshot) {
  return (
    snapshot.episodes.find((episode) => episode.id === snapshot.project.activeEpisodeId) ??
    snapshot.episodes[0] ??
    null
  );
}

function normalizeWorkspaceSnapshotObjectBindings(snapshot: StoryWorkspaceSnapshot) {
  const fallbackEpisodeId = getActiveEpisode(snapshot)?.id ?? null;
  const knownEpisodeIds = new Set(snapshot.episodes.map((episode) => episode.id));
  const normalizedObjects = snapshot.objects
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
        projectId: snapshot.project.id
      };
    })
    .filter((object): object is StoryWorkspaceSnapshot["objects"][number] => object !== null);
  const objectsById = new Map(normalizedObjects.map((object) => [object.id, object]));
  const normalizedNodes = snapshot.nodes.map((node) => ({
    ...node,
    objectIds: sanitizeKeywords(
      node.objectIds.filter((objectId) => {
        const object = objectsById.get(objectId);
        return (
          object !== undefined &&
          object.projectId === node.projectId
        );
      })
    )
  }));

  return {
    ...snapshot,
    nodes: normalizedNodes,
    objects: normalizedObjects
  };
}

function getOrderedEpisodeNodes(snapshot: StoryWorkspaceSnapshot, episodeId: string) {
  return sortNodesByOrder(snapshot.nodes.filter((node) => node.episodeId === episodeId));
}

// 이 함수는 재정렬 intent를 실제 정렬 힌트 orderIndex 목록으로 변환합니다.
function createReorderOrderIndexHints(
  remainingNodes: StoryNode[],
  insertAtIndex: number,
  movedCount: number
) {
  if (movedCount <= 0) {
    return [];
  }

  const previousNode =
    insertAtIndex > 0 ? remainingNodes[insertAtIndex - 1] ?? null : null;
  const nextNode =
    insertAtIndex < remainingNodes.length ? remainingNodes[insertAtIndex] ?? null : null;

  if (previousNode && nextNode) {
    const gap = nextNode.orderIndex - previousNode.orderIndex;

    if (gap > 0) {
      const step = gap / (movedCount + 1);

      return Array.from({ length: movedCount }, (_, index) => {
        return previousNode.orderIndex + step * (index + 1);
      });
    }

    const epsilon = 0.0001;

    return Array.from({ length: movedCount }, (_, index) => {
      return previousNode.orderIndex + epsilon * (index + 1);
    });
  }

  if (previousNode) {
    return Array.from({ length: movedCount }, (_, index) => {
      return previousNode.orderIndex + index + 1;
    });
  }

  if (nextNode) {
    return Array.from({ length: movedCount }, (_, index) => {
      return nextNode.orderIndex - movedCount + index;
    });
  }

  return Array.from({ length: movedCount }, (_, index) => index + 1);
}

function mergeEpisodeNodes(
  allNodes: StoryNode[],
  episodeId: string,
  nextEpisodeNodes: StoryNode[]
) {
  return [...allNodes.filter((node) => node.episodeId !== episodeId), ...nextEpisodeNodes];
}

function assignNodesToEpisode(
  nodes: StoryNode[],
  episodeId: string,
  projectId: string
) {
  return nodes.map((node) => ({
    ...node,
    episodeId,
    projectId
  }));
}

function inferNextEpisodeTitle(episodes: StoryEpisode[]) {
  const numericEpisodeLabels = episodes
    .map((episode) => /^Episode\s+(\d+)$/i.exec(episode.title)?.[1] ?? null)
    .map((match) => (match ? Number.parseInt(match, 10) : null))
    .filter((value): value is number => value !== null && Number.isFinite(value));

  if (numericEpisodeLabels.length > 0) {
    return `Episode ${Math.max(...numericEpisodeLabels) + 1}`;
  }

  return `Episode ${episodes.length + 1}`;
}

function createSnapshotOperations(
  previousSnapshot: StoryWorkspaceSnapshot,
  nextSnapshot: StoryWorkspaceSnapshot
) {
  const operations: CloudSyncOperation[] = [];

  if (JSON.stringify(previousSnapshot.project) !== JSON.stringify(nextSnapshot.project)) {
    operations.push({
      action: "upsert",
      kind: "project",
      payload: nextSnapshot.project
    });
  }

  if (JSON.stringify(previousSnapshot.episodes) !== JSON.stringify(nextSnapshot.episodes)) {
    operations.push(
      ...createEpisodeOperations(
        previousSnapshot.episodes,
        nextSnapshot.episodes,
        previousSnapshot.project.id
      )
    );
  }

  if (JSON.stringify(previousSnapshot.objects) !== JSON.stringify(nextSnapshot.objects)) {
    operations.push(
      ...createObjectOperations(
        previousSnapshot.objects,
        nextSnapshot.objects,
        previousSnapshot.project.id
      )
    );
  }

  if (JSON.stringify(previousSnapshot.nodes) !== JSON.stringify(nextSnapshot.nodes)) {
    operations.push(
      ...createNodeOperations(
        previousSnapshot.nodes,
        nextSnapshot.nodes,
        previousSnapshot.project.id
      )
    );
  }

  if (
    JSON.stringify(previousSnapshot.temporaryDrawer) !==
    JSON.stringify(nextSnapshot.temporaryDrawer)
  ) {
    operations.push(
      ...createDrawerOperations(
        previousSnapshot.temporaryDrawer,
        nextSnapshot.temporaryDrawer,
        previousSnapshot.project.id
      )
    );
  }

  return operations;
}

type WorkspaceStateSeed = Omit<WorkspacePersistenceState, "history">;

export class WorkspacePersistenceController {
  private readonly listeners = new Set<WorkspaceListener>();

  private readonly now: () => string;

  private readonly createId: (kind: PersistedEntityKind) => string;

  private readonly flushQueue: PersistenceFlushQueue;

  private initializePromise: Promise<void> | null = null;

  private remoteSnapshot: StoryWorkspaceSnapshot | null = null;

  private readonly historyLimit = 50;

  private undoSnapshots: StoryWorkspaceSnapshot[] = [];

  private redoSnapshots: StoryWorkspaceSnapshot[] = [];

  private state: WorkspacePersistenceState | null = null;

  constructor(
    private readonly dependencies: WorkspacePersistenceControllerDependencies
  ) {
    this.now = dependencies.now ?? (() => new Date().toISOString());
    this.createId = dependencies.createId ?? ((kind) => createStableId(kind));

    const flushQueueOptions = {
      getRemoteSnapshot: () => this.remoteSnapshot,
      loadPending: () => this.dependencies.local.getPendingSyncOperations(),
      onError: (error: Error) => {
        if (error.message === "not_authenticated") {
          return;
        }

        this.patchState({
          lastError: error.message,
          syncStatus: "error"
        });
      },
      onSynced: (response: SyncProjectResponse) => {
        this.remoteSnapshot = cloneSnapshot(response.snapshot);
        const registry = this.persistWorkspace(response.snapshot, response.linkage);

        this.replaceState({
          cloudProjectCount: this.state?.cloudProjectCount ?? null,
          lastError: null,
          linkage: cloneLinkage(response.linkage),
          registry,
          session: this.requireState().session,
          snapshot: cloneSnapshot(response.snapshot),
          syncStatus: "synced"
        });
      },
      onSyncing: () => {
        this.patchState({
          lastError: null,
          syncStatus: "syncing"
        });
      },
      savePending: (operations: CloudSyncOperation[]) => {
        this.dependencies.local.savePendingSyncOperations(operations);
      },
      syncProject: async (operations: CloudSyncOperation[]) => {
        const current = this.requireState();

        if (
          current.session.mode !== "authenticated" ||
          current.session.accountId === null
        ) {
          throw new Error("not_authenticated");
        }

        return this.dependencies.cloud.syncProject(
          current.snapshot.project.id,
          {
            operations
          }
        );
      }
    };

    this.flushQueue = new PersistenceFlushQueue(
      dependencies.flushDebounceMs === undefined
        ? flushQueueOptions
        : {
            ...flushQueueOptions,
            debounceMs: dependencies.flushDebounceMs
          }
    );
  }

  getState() {
    return this.state;
  }

  subscribe(listener: WorkspaceListener) {
    this.listeners.add(listener);

    if (this.state) {
      listener(this.state);
    }

    return () => {
      this.listeners.delete(listener);
    };
  }

  async initialize() {
    if (this.initializePromise) {
      return this.initializePromise;
    }

    this.initializePromise = this.initializeInternal();
    return this.initializePromise;
  }

  dispose() {
    this.flushQueue.dispose();
    this.listeners.clear();
  }

  async signIn() {
    const session = await this.dependencies.auth.signIn();
    this.remoteSnapshot = null;
    this.setLocalCacheScope(session);
    this.reloadPendingSyncOperations();

    if (session.mode === "authenticated" && session.accountId !== null) {
      const loaded = this.loadOrSeedWorkspace();

      if (loaded) {
        this.resetHistory();
        this.replaceState({
          cloudProjectCount: null,
          lastError: null,
          linkage: loaded.linkage,
          registry: loaded.registry,
          session,
          snapshot: loaded.snapshot,
          syncStatus: "importing"
        });

        await this.connectAuthenticatedSession(
          session,
          loaded.snapshot,
          loaded.linkage
        );
        return;
      }

      await this.bootstrapAuthenticatedSession(session);
      return;
    }

    const current = this.requireState();
    this.replaceState({
      ...current,
      lastError: null,
      session,
      syncStatus: "guest-local"
    });
  }

  async signOut() {
    await this.flushQueue.flushNow();
    const session = await this.dependencies.auth.signOut();
    this.remoteSnapshot = null;
    this.setLocalCacheScope(session);
    this.reloadPendingSyncOperations();
    this.sanitizeGuestSampleCache();
    const loaded = this.loadOrSeedWorkspace();
    this.resetHistory();

    if (loaded) {
      this.replaceState({
        cloudProjectCount: null,
        lastError: null,
        linkage: loaded.linkage,
        registry: loaded.registry,
        session,
        snapshot: loaded.snapshot,
        syncStatus: "guest-local"
      });
      return;
    }

    this.setGuestEmptyState(session, null);
  }

  // 빈 인증 상태에서 최초 프로젝트를 생성하고 계정 저장소에 연결합니다.
  async createWorkspaceFromEmptyState() {
    const current = this.requireState();

    if (
      current.session.mode !== "authenticated" ||
      current.session.accountId === null ||
      current.linkage?.cloudLinked
    ) {
      return null;
    }

    const starterSnapshot = normalizeWorkspaceSnapshotObjectBindings(
      createStarterWorkspace(this.now(), this.createId)
    );
    this.resetHistory();

    this.replaceState({
      cloudProjectCount: current.cloudProjectCount,
      lastError: null,
      linkage: null,
      registry: current.registry,
      session: current.session,
      snapshot: cloneSnapshot(starterSnapshot),
      syncStatus: "importing"
    });

    await this.connectAuthenticatedSession(current.session, starterSnapshot, null);

    return this.state?.snapshot.project.id ?? null;
  }

  async reloadLocal() {
    const current = this.requireState();
    const loaded = this.loadOrSeedWorkspace();

    if (!loaded) {
      if (current.session.mode === "authenticated") {
        this.resetHistory();
        this.setAuthenticatedEmptyState(current.session, {
          cloudProjectCount: current.cloudProjectCount,
          lastError: null,
          syncStatus: "authenticated-empty"
        });
        return;
      }

      this.resetHistory();
      this.setGuestEmptyState(current.session, null);
      return;
    }

    this.resetHistory();

    this.replaceState({
      ...current,
      linkage: loaded.linkage,
      registry: loaded.registry,
      snapshot: loaded.snapshot,
      syncStatus:
        current.session.mode === "authenticated" ? current.syncStatus : "guest-local"
    });
  }

  async recoverFromCloud() {
    const current = this.requireState();

    if (
      current.session.mode !== "authenticated" ||
      current.session.accountId === null
    ) {
      return;
    }

    this.patchState({
      lastError: null,
      syncStatus: "syncing"
    });

    try {
      const response = await this.dependencies.cloud.getProject(
        current.snapshot.project.id
      );

      if (!response.snapshot || !response.linkage) {
        await this.connectAuthenticatedSession(
          current.session,
          current.snapshot,
          current.linkage
        );
        return;
      }

      const normalizedSnapshot = normalizeWorkspaceSnapshotObjectBindings(
        response.snapshot
      );
      this.remoteSnapshot = cloneSnapshot(normalizedSnapshot);
      const registry = this.persistWorkspace(normalizedSnapshot, response.linkage);
      const cloudProjectCount = await this.getCloudProjectCount(
        
      );
      this.resetHistory();

      this.replaceState({
        cloudProjectCount,
        lastError: null,
        linkage: cloneLinkage(response.linkage),
        registry,
        session: current.session,
        snapshot: cloneSnapshot(normalizedSnapshot),
        syncStatus: "synced"
      });
    } catch (error) {
      this.patchState({
        lastError: this.toMessage(error),
        syncStatus: "error"
      });
    }
  }

  // 인증된 클라우드 연동 상태에서만 즉시 동기화를 수행합니다.
  async flushNow() {
    const current = this.state;

    if (
      !current ||
      current.session.mode !== "authenticated" ||
      current.session.accountId === null ||
      !current.linkage?.cloudLinked
    ) {
      return;
    }

    await this.flushQueue.flushNow();
  }

  async undo() {
    const current = this.requireState();
    const previousSnapshot = this.undoSnapshots.pop();

    if (!previousSnapshot) {
      return;
    }

    this.redoSnapshots.push(cloneSnapshot(current.snapshot));
    await this.applyHistoricalSnapshot(previousSnapshot);
  }

  async redo() {
    const current = this.requireState();
    const nextSnapshot = this.redoSnapshots.pop();

    if (!nextSnapshot) {
      return;
    }

    this.pushUndoSnapshot(current.snapshot);
    await this.applyHistoricalSnapshot(nextSnapshot);
  }

  async addSampleNode() {
    const current = this.requireState();
    const activeEpisode =
      current.snapshot.episodes.find(
        (episode) => episode.id === current.snapshot.project.activeEpisodeId
      ) ?? current.snapshot.episodes[0];

    if (!activeEpisode) {
      return;
    }

    const createdNodeId = await this.createNode(
      current.snapshot.nodes.some((node) => node.level === "major") ? "minor" : "major",
      current.snapshot.nodes.length
    );

    if (!createdNodeId) {
      return;
    }

    const orderIndex =
      this.requireState().snapshot.nodes.find((node) => node.id === createdNodeId)
        ?.orderIndex ?? 1;

    await this.updateNodeContent(createdNodeId, {
      contentMode: "keywords",
      keywords: ["hesitation", "pressure", `beat ${orderIndex}`],
      text: ""
    });
  }

  async addDrawerItem() {
    const current = this.requireState();
    const activeEpisode = getActiveEpisode(current.snapshot);

    if (!activeEpisode) {
      return;
    }

    const timestamp = this.now();
    const sourceNode = current.snapshot.nodes.at(-1) ?? null;
    const item: TemporaryDrawerItem = {
      createdAt: timestamp,
      episodeId: activeEpisode.id,
      id: this.createId("temporary_drawer"),
      label: `Spare beat ${current.snapshot.temporaryDrawer.length + 1}`,
      note: "Hold this beat in reserve until the episode pacing needs it.",
      projectId: current.snapshot.project.id,
      sourceNodeId: sourceNode?.id ?? null,
      updatedAt: timestamp
    };
    const snapshot: StoryWorkspaceSnapshot = {
      ...current.snapshot,
      temporaryDrawer: [...current.snapshot.temporaryDrawer, item]
    };

    this.applyLocalMutation(snapshot, [
      {
        action: "upsert",
        kind: "temporary_drawer",
        payload: item
      }
    ]);
  }

  async createEpisode() {
    const current = this.requireState();
    const timestamp = this.now();
    const nextEpisode: StoryEpisode = {
      createdAt: timestamp,
      endpoint: "Define the closing turn for this episode.",
      id: this.createId("episode"),
      objective: "Outline the next structural beat for this episode.",
      projectId: current.snapshot.project.id,
      title: inferNextEpisodeTitle(current.snapshot.episodes),
      updatedAt: timestamp
    };
    const nextProject = {
      ...current.snapshot.project,
      activeEpisodeId: nextEpisode.id,
      updatedAt: timestamp
    };
    const snapshot: StoryWorkspaceSnapshot = {
      ...current.snapshot,
      episodes: [...current.snapshot.episodes, nextEpisode],
      project: nextProject
    };

    this.applyLocalMutation(snapshot, [
      {
        action: "upsert",
        kind: "project",
        payload: nextProject
      },
      ...createEpisodeOperations(
        current.snapshot.episodes,
        snapshot.episodes,
        current.snapshot.project.id
      )
    ]);

    return nextEpisode.id;
  }

  async selectEpisode(episodeId: string) {
    const current = this.requireState();
    const selectedEpisode = current.snapshot.episodes.find((episode) => episode.id === episodeId);

    if (!selectedEpisode || current.snapshot.project.activeEpisodeId === episodeId) {
      return;
    }

    const timestamp = this.now();
    const nextEpisodes = current.snapshot.episodes.map((episode) =>
      episode.id === episodeId
        ? {
            ...episode,
            updatedAt: timestamp
          }
        : episode
    );
    const nextProject = {
      ...current.snapshot.project,
      activeEpisodeId: episodeId,
      updatedAt: timestamp
    };
    const snapshot: StoryWorkspaceSnapshot = {
      ...current.snapshot,
      episodes: nextEpisodes,
      project: nextProject
    };

    this.applyLocalMutation(snapshot, [
      {
        action: "upsert",
        kind: "project",
        payload: nextProject
      },
      ...createEpisodeOperations(
        current.snapshot.episodes,
        nextEpisodes,
        current.snapshot.project.id
      )
    ]);
  }

  async renameEpisode(episodeId: string, title: string) {
    const current = this.requireState();
    const nextTitle = sanitizeText(title);

    if (!nextTitle) {
      return;
    }

    const episode = current.snapshot.episodes.find((entry) => entry.id === episodeId);

    if (!episode) {
      return;
    }

    const timestamp = this.now();
    const nextEpisodes = current.snapshot.episodes.map((entry) =>
      entry.id === episodeId
        ? {
            ...entry,
            title: nextTitle,
            updatedAt: timestamp
          }
        : entry
    );
    const nextProject = {
      ...current.snapshot.project,
      updatedAt: timestamp
    };
    const snapshot: StoryWorkspaceSnapshot = {
      ...current.snapshot,
      episodes: nextEpisodes,
      project: nextProject
    };

    this.applyLocalMutation(snapshot, [
      {
        action: "upsert",
        kind: "project",
        payload: nextProject
      },
      ...createEpisodeOperations(
        current.snapshot.episodes,
        nextEpisodes,
        current.snapshot.project.id
      )
    ]);
  }

  async deleteEpisode(episodeId: string) {
    const current = this.requireState();

    if (current.snapshot.episodes.length <= 1) {
      return false;
    }

    const remainingEpisodes = current.snapshot.episodes.filter(
      (episode) => episode.id !== episodeId
    );

    if (remainingEpisodes.length === current.snapshot.episodes.length) {
      return false;
    }

    const timestamp = this.now();
    const nextProject = {
      ...current.snapshot.project,
      activeEpisodeId:
        current.snapshot.project.activeEpisodeId === episodeId
          ? remainingEpisodes[0]!.id
          : current.snapshot.project.activeEpisodeId,
      updatedAt: timestamp
    };
    const nextObjects = current.snapshot.objects.filter(
      (object) => object.episodeId !== episodeId
    );
    const remainingObjectIds = new Set(nextObjects.map((object) => object.id));
    const nextNodes = current.snapshot.nodes
      .filter((node) => node.episodeId !== episodeId)
      .map((node) => ({
        ...node,
        objectIds: node.objectIds.filter((objectId) => remainingObjectIds.has(objectId))
      }));
    const nextDrawer = current.snapshot.temporaryDrawer.filter(
      (item) => item.episodeId !== episodeId
    );
    const snapshot: StoryWorkspaceSnapshot = {
      ...current.snapshot,
      episodes: remainingEpisodes,
      nodes: nextNodes,
      objects: nextObjects,
      project: nextProject,
      temporaryDrawer: nextDrawer
    };

    this.applyLocalMutation(snapshot, [
      {
        action: "upsert",
        kind: "project",
        payload: nextProject
      },
      ...createEpisodeOperations(
        current.snapshot.episodes,
        remainingEpisodes,
        current.snapshot.project.id
      ),
      ...createObjectOperations(
        current.snapshot.objects,
        nextObjects,
        current.snapshot.project.id
      ),
      ...createNodeOperations(current.snapshot.nodes, nextNodes, current.snapshot.project.id),
      ...createDrawerOperations(
        current.snapshot.temporaryDrawer,
        nextDrawer,
        current.snapshot.project.id
      )
    ]);

    return true;
  }

  async createNode(
    level: StoryNodeLevel,
    insertAtIndex: number,
    placement?: NodePlacementDraft
  ) {
    const current = this.requireState();
    const shouldUseCanonicalCreate =
      current.session.mode === "authenticated" &&
      current.session.accountId !== null &&
      placement !== undefined &&
      current.linkage?.cloudLinked === true;
    const activeEpisode = getActiveEpisode(current.snapshot);

    if (!activeEpisode) {
      return null;
    }

    const orderedNodes = getOrderedEpisodeNodes(current.snapshot, activeEpisode.id);
    const clampedIndex = clampInsertIndex(insertAtIndex, orderedNodes.length);
    const timestamp = this.now();
    const fallbackPlacement = getNextNodePlacement(level, orderedNodes);
    const node: StoryNode = {
      canvasX: placement?.canvasX ?? fallbackPlacement.canvasX,
      canvasY: placement?.canvasY ?? fallbackPlacement.canvasY,
      contentMode: "empty",
      createdAt: timestamp,
      episodeId: activeEpisode.id,
      id: this.createId("node"),
      isCollapsed: false,
      isFixed: false,
      isImportant: false,
      keywords: [],
      level,
      objectIds: [],
      orderIndex: clampedIndex + 1,
      parentId: inferParentId(orderedNodes, level, clampedIndex),
      projectId: current.snapshot.project.id,
      text: "",
      updatedAt: timestamp
    };
    const nextEpisodeNodes = normalizeNodeOrder(
      stampNodes(
        [
          ...orderedNodes.slice(0, clampedIndex),
          node,
          ...orderedNodes.slice(clampedIndex)
        ],
        timestamp
      )
    );
    const nextNodes = mergeEpisodeNodes(current.snapshot.nodes, activeEpisode.id, nextEpisodeNodes);
    const snapshot: StoryWorkspaceSnapshot = {
      ...current.snapshot,
      nodes: nextNodes
    };

    this.applyLocalMutation(
      snapshot,
      createNodeOperations(current.snapshot.nodes, nextNodes, current.snapshot.project.id)
    );

    if (shouldUseCanonicalCreate) {
      await this.flushNow();
    }

    return node.id;
  }

  async updateNodeContent(nodeId: string, draft: NodeContentDraft) {
    const current = this.requireState();
    const timestamp = this.now();
    const nextNodes = current.snapshot.nodes.map((node) => {
      if (node.id !== nodeId) {
        return node;
      }

      return {
        ...node,
        contentMode: draft.contentMode,
        keywords: sanitizeKeywords(draft.keywords),
        text: draft.text.trim(),
        updatedAt: timestamp
      };
    });
    const updatedNode = nextNodes.find((node) => node.id === nodeId);

    if (!updatedNode) {
      return;
    }

    const snapshot: StoryWorkspaceSnapshot = {
      ...current.snapshot,
      nodes: nextNodes
    };

    this.applyLocalMutation(snapshot, [
      {
        action: "upsert",
        kind: "node",
        payload: updatedNode
      }
    ]);
  }

  async updateNodePlacement(nodeId: string, draft: NodePlacementDraft) {
    const current = this.requireState();
    const currentNode = current.snapshot.nodes.find((node) => node.id === nodeId);

    if (!currentNode || currentNode.isFixed) {
      return;
    }

    const timestamp = this.now();
    const nextNodes = current.snapshot.nodes.map((node) =>
      node.id === nodeId
        ? {
            ...node,
            canvasX: draft.canvasX ?? node.canvasX ?? defaultNodeXByLevel[node.level],
            canvasY: draft.canvasY ?? node.canvasY ?? defaultNodeYByLevel[node.level],
            updatedAt: timestamp
          }
        : node
    );
    const updatedNode = nextNodes.find((node) => node.id === nodeId);

    if (!updatedNode) {
      return;
    }

    const snapshot: StoryWorkspaceSnapshot = {
      ...current.snapshot,
      nodes: nextNodes
    };

    this.applyLocalMutation(snapshot, [
      {
        action: "upsert",
        kind: "node",
        payload: updatedNode
      }
    ]);
  }

  async updateNodeVisualState(nodeId: string, draft: NodeVisualStateDraft) {
    const current = this.requireState();
    const timestamp = this.now();
    const nextNodes = current.snapshot.nodes.map((node) => {
      if (node.id !== nodeId) {
        return node;
      }

      return {
        ...node,
        isCollapsed: draft.isCollapsed ?? node.isCollapsed ?? false,
        isFixed: draft.isFixed ?? node.isFixed ?? false,
        isImportant: draft.isImportant ?? node.isImportant ?? false,
        updatedAt: timestamp
      };
    });
    const updatedNode = nextNodes.find((node) => node.id === nodeId);

    if (!updatedNode) {
      return;
    }

    const snapshot: StoryWorkspaceSnapshot = {
      ...current.snapshot,
      nodes: nextNodes
    };

    this.applyLocalMutation(snapshot, [
      {
        action: "upsert",
        kind: "node",
        payload: updatedNode
      }
    ]);
  }

  async createObject(draft: StoryObjectDraft) {
    const current = this.requireState();
    const activeEpisode = getActiveEpisode(current.snapshot);
    const name = sanitizeText(draft.name);
    const summary = sanitizeText(draft.summary);

    if (!name || !activeEpisode) {
      return null;
    }

    const timestamp = this.now();
    const nextObject = {
      category: draft.category,
      createdAt: timestamp,
      episodeId: activeEpisode.id,
      id: this.createId("object"),
      name,
      projectId: current.snapshot.project.id,
      summary,
      updatedAt: timestamp
    };
    const snapshot: StoryWorkspaceSnapshot = {
      ...current.snapshot,
      objects: [...current.snapshot.objects, nextObject]
    };

    this.applyLocalMutation(snapshot, [
      {
        action: "upsert",
        kind: "object",
        payload: nextObject
      }
    ]);

    return nextObject.id;
  }

  async updateObject(objectId: string, draft: StoryObjectDraft) {
    const current = this.requireState();
    const name = sanitizeText(draft.name);
    const summary = sanitizeText(draft.summary);

    if (!name) {
      return;
    }

    const timestamp = this.now();
    const nextObjects = current.snapshot.objects.map((object) =>
      object.id === objectId
        ? {
            ...object,
            category: draft.category,
            name,
            summary,
            updatedAt: timestamp
          }
        : object
    );
    const updatedObject = nextObjects.find((object) => object.id === objectId);

    if (!updatedObject) {
      return;
    }

    const snapshot: StoryWorkspaceSnapshot = {
      ...current.snapshot,
      objects: nextObjects
    };

    this.applyLocalMutation(snapshot, [
      {
        action: "upsert",
        kind: "object",
        payload: updatedObject
      }
    ]);
  }

  async deleteObject(objectId: string) {
    const current = this.requireState();

    if (!current.snapshot.objects.some((object) => object.id === objectId)) {
      return false;
    }

    const timestamp = this.now();
    const nextObjects = current.snapshot.objects.filter((object) => object.id !== objectId);
    const nextNodes = current.snapshot.nodes.map((node) =>
      node.objectIds.includes(objectId)
        ? {
            ...node,
            objectIds: node.objectIds.filter((entry) => entry !== objectId),
            updatedAt: timestamp
          }
        : node
    );
    const snapshot: StoryWorkspaceSnapshot = {
      ...current.snapshot,
      nodes: nextNodes,
      objects: nextObjects
    };

    this.applyLocalMutation(snapshot, [
      ...createObjectOperations(
        current.snapshot.objects,
        nextObjects,
        current.snapshot.project.id
      ),
      ...createNodeOperations(current.snapshot.nodes, nextNodes, current.snapshot.project.id)
    ]);

    return true;
  }

  async attachObjectToNode(nodeId: string, objectId: string) {
    const current = this.requireState();
    const targetNode = current.snapshot.nodes.find((node) => node.id === nodeId);

    if (!targetNode) {
      return;
    }

    const targetObject = current.snapshot.objects.find((object) => object.id === objectId);

    if (!targetObject || targetObject.projectId !== targetNode.projectId) {
      return;
    }

    const timestamp = this.now();
    const nextNodes = current.snapshot.nodes.map((node) =>
      node.id === nodeId
        ? {
            ...node,
            objectIds: sanitizeKeywords([...node.objectIds, objectId]),
            updatedAt: timestamp
          }
        : node
    );
    const updatedNode = nextNodes.find((node) => node.id === nodeId);

    if (!updatedNode) {
      return;
    }

    const snapshot: StoryWorkspaceSnapshot = {
      ...current.snapshot,
      nodes: nextNodes
    };

    this.applyLocalMutation(snapshot, [
      {
        action: "upsert",
        kind: "node",
        payload: updatedNode
      }
    ]);
  }

  async detachObjectFromNode(nodeId: string, objectId: string) {
    const current = this.requireState();
    const timestamp = this.now();
    const nextNodes = current.snapshot.nodes.map((node) =>
      node.id === nodeId
        ? {
            ...node,
            objectIds: node.objectIds.filter((entry) => entry !== objectId),
            updatedAt: timestamp
          }
        : node
    );
    const updatedNode = nextNodes.find((node) => node.id === nodeId);

    if (!updatedNode) {
      return;
    }

    const snapshot: StoryWorkspaceSnapshot = {
      ...current.snapshot,
      nodes: nextNodes
    };

    this.applyLocalMutation(snapshot, [
      {
        action: "upsert",
        kind: "node",
        payload: updatedNode
      }
    ]);
  }

  // 에피소드 외부 참조 오브젝트를 현재 에피소드 소유로 고정합니다.
  async localizeObjectReferencesForEpisode(episodeId: string) {
    const current = this.requireState();
    const episodeNodes = current.snapshot.nodes.filter((node) => node.episodeId === episodeId);

    if (episodeNodes.length === 0) {
      return false;
    }

    const objectsById = new Map(current.snapshot.objects.map((object) => [object.id, object]));
    const sourceObjectIds = new Set(
      episodeNodes.flatMap((node) => node.objectIds).filter((objectId) => {
        const object = objectsById.get(objectId);
        return (
          object !== undefined &&
          object.projectId === current.snapshot.project.id &&
          object.episodeId !== episodeId
        );
      })
    );

    if (sourceObjectIds.size === 0) {
      return false;
    }

    const timestamp = this.now();
    const cloneIdBySourceId = new Map<string, string>();
    const clonedObjects = [...sourceObjectIds].flatMap((sourceId) => {
      const sourceObject = objectsById.get(sourceId);

      if (!sourceObject) {
        return [];
      }

      const cloneId = this.createId("object");
      cloneIdBySourceId.set(sourceId, cloneId);

      return [
        {
          ...sourceObject,
          createdAt: timestamp,
          episodeId,
          id: cloneId,
          updatedAt: timestamp
        }
      ];
    });

    if (clonedObjects.length === 0) {
      return false;
    }

    const nextNodes = current.snapshot.nodes.map((node) => {
      if (node.episodeId !== episodeId) {
        return node;
      }

      return {
        ...node,
        objectIds: sanitizeKeywords(
          node.objectIds.map((objectId) => cloneIdBySourceId.get(objectId) ?? objectId)
        ),
        updatedAt: timestamp
      };
    });
    const nextObjects = [...current.snapshot.objects, ...clonedObjects];
    const snapshot: StoryWorkspaceSnapshot = {
      ...current.snapshot,
      nodes: nextNodes,
      objects: nextObjects
    };

    this.applyLocalMutation(snapshot, [
      ...createObjectOperations(
        current.snapshot.objects,
        nextObjects,
        current.snapshot.project.id
      ),
      ...createNodeOperations(current.snapshot.nodes, nextNodes, current.snapshot.project.id)
    ]);

    return true;
  }

  // 이 함수는 노드 이동 intent를 반영하고 필요 시 서버 canonical 순서를 즉시 반영합니다.
  async moveNode(
    nodeId: string,
    insertAtIndex: number,
    options: {
      preserveParent?: boolean;
    } = {}
  ) {
    const current = this.requireState();
    const rootNode = current.snapshot.nodes.find((node) => node.id === nodeId);

    if (!rootNode) {
      return;
    }

    const orderedNodes = getOrderedEpisodeNodes(current.snapshot, rootNode.episodeId);
    const subtreeNodes = collectSubtreeNodes(orderedNodes, nodeId);

    if (subtreeNodes.length === 0) {
      return;
    }

    const subtreeIds = new Set(subtreeNodes.map((node) => node.id));
    const clampedInsertIndex = clampInsertIndex(insertAtIndex, orderedNodes.length);
    const removedBeforeInsert = orderedNodes
      .slice(0, clampedInsertIndex)
      .filter((node) => subtreeIds.has(node.id)).length;
    const remainingNodes = orderedNodes.filter((node) => !subtreeIds.has(node.id));
    const adjustedIndex = clampInsertIndex(
      clampedInsertIndex - removedBeforeInsert,
      remainingNodes.length
    );
    const timestamp = this.now();
    const shouldUseCanonicalReorder =
      current.session.mode === "authenticated" &&
      current.session.accountId !== null &&
      current.linkage?.cloudLinked === true;

    const parentId = inferParentId(
      remainingNodes,
      rootNode.level,
      adjustedIndex,
      subtreeIds
    );
    const preserveParent = options.preserveParent === true;
    const reorderOrderHints = shouldUseCanonicalReorder
      ? createReorderOrderIndexHints(
          remainingNodes,
          adjustedIndex,
          subtreeNodes.length
        )
      : [];
    const movedNodes = subtreeNodes.map((node, index) =>
      shouldUseCanonicalReorder
        ? {
            ...node,
            orderIndex: reorderOrderHints[index] ?? node.orderIndex,
            parentId:
              node.id === rootNode.id && !preserveParent
                ? parentId
                : node.parentId,
            updatedAt: timestamp
          }
        : node.id === rootNode.id && !preserveParent
            ? {
                ...node,
                parentId
              }
            : node
    );
    const nextEpisodeNodes = shouldUseCanonicalReorder
      ? [
          ...remainingNodes.slice(0, adjustedIndex),
          ...movedNodes,
          ...remainingNodes.slice(adjustedIndex)
        ]
      : normalizeNodeOrder(
          stampNodes(
            [
              ...remainingNodes.slice(0, adjustedIndex),
              ...movedNodes,
              ...remainingNodes.slice(adjustedIndex)
            ],
            timestamp
          )
        );
    const nextNodes = mergeEpisodeNodes(
      current.snapshot.nodes,
      rootNode.episodeId,
      nextEpisodeNodes
    );
    const snapshot: StoryWorkspaceSnapshot = {
      ...current.snapshot,
      nodes: nextNodes
    };

    const operations =
      shouldUseCanonicalReorder
        ? movedNodes.map((node) => ({
            action: "upsert" as const,
            kind: "node" as const,
            payload: node
          }))
        : createNodeOperations(
            current.snapshot.nodes,
            nextNodes,
            current.snapshot.project.id
          );

    this.applyLocalMutation(snapshot, operations);

    if (shouldUseCanonicalReorder) {
      void this.flushNow();
    }
  }

  async rewireNode(nodeId: string, nextParentId: string | null) {
    const current = this.requireState();
    const node = current.snapshot.nodes.find((entry) => entry.id === nodeId);

    if (!node) {
      return;
    }

    if (nextParentId !== null) {
      const parentNode = current.snapshot.nodes.find((entry) => entry.id === nextParentId);

      if (!parentNode || parentNode.id === node.id || isDescendant(current.snapshot.nodes, node.id, parentNode.id)) {
        return;
      }
    }

    const timestamp = this.now();
    const nextNodes = current.snapshot.nodes.map((entry) =>
      entry.id === node.id
        ? {
            ...entry,
            parentId: nextParentId,
            updatedAt: timestamp
          }
        : entry
    );
    const rewiredNode = nextNodes.find((entry) => entry.id === node.id);

    if (!rewiredNode) {
      return;
    }

    const snapshot: StoryWorkspaceSnapshot = {
      ...current.snapshot,
      nodes: nextNodes
    };

    this.applyLocalMutation(snapshot, [
      {
        action: "upsert",
        kind: "node",
        payload: rewiredNode
      }
    ]);
  }

  async deleteNodeTree(nodeId: string) {
    const current = this.requireState();
    const targetNode = current.snapshot.nodes.find((node) => node.id === nodeId);

    if (!targetNode) {
      return;
    }

    const episodeNodes = getOrderedEpisodeNodes(current.snapshot, targetNode.episodeId);
    const subtreeIds = collectDescendantIds(episodeNodes, nodeId);

    if (subtreeIds.size === 0) {
      return;
    }

    const timestamp = this.now();
    const nextEpisodeNodes = normalizeNodeOrder(
      stampNodes(
        episodeNodes.filter((node) => !subtreeIds.has(node.id)),
        timestamp
      )
    );
    const nextNodes = mergeEpisodeNodes(
      current.snapshot.nodes,
      targetNode.episodeId,
      nextEpisodeNodes
    );
    const snapshot: StoryWorkspaceSnapshot = {
      ...current.snapshot,
      nodes: nextNodes
    };

    this.applyLocalMutation(
      snapshot,
      createNodeOperations(current.snapshot.nodes, nextNodes, current.snapshot.project.id)
    );
  }

  async moveNodeToDrawer(nodeId: string) {
    const current = this.requireState();
    const rootNode = current.snapshot.nodes.find((node) => node.id === nodeId);

    if (!rootNode) {
      return null;
    }

    const episodeNodes = getOrderedEpisodeNodes(current.snapshot, rootNode.episodeId);
    const subtreeNodes = collectSubtreeNodes(episodeNodes, nodeId);

    if (subtreeNodes.length === 0) {
      return null;
    }

    const timestamp = this.now();
    const subtreeIds = new Set(subtreeNodes.map((node) => node.id));
    const stampedSubtree = stampNodes(subtreeNodes, timestamp);
    const stampedRootNode = stampedSubtree.find((node) => node.id === nodeId);

    if (!stampedRootNode) {
      return null;
    }

    const drawerItem: TemporaryDrawerItem = {
      createdAt: timestamp,
      episodeId: stampedRootNode.episodeId,
      id: this.createId("temporary_drawer"),
      label: getNodeDrawerLabel(stampedRootNode),
      note: serializeDrawerPayload(stampedSubtree, stampedRootNode.id),
      projectId: current.snapshot.project.id,
      sourceNodeId: stampedRootNode.id,
      updatedAt: timestamp
    };
    const nextEpisodeNodes = normalizeNodeOrder(
      stampNodes(
        episodeNodes.filter((node) => !subtreeIds.has(node.id)),
        timestamp
      )
    );
    const nextNodes = mergeEpisodeNodes(current.snapshot.nodes, rootNode.episodeId, nextEpisodeNodes);
    const nextDrawer = [...current.snapshot.temporaryDrawer, drawerItem];
    const snapshot: StoryWorkspaceSnapshot = {
      ...current.snapshot,
      nodes: nextNodes,
      temporaryDrawer: nextDrawer
    };

    this.applyLocalMutation(snapshot, [
      ...createNodeOperations(current.snapshot.nodes, nextNodes, current.snapshot.project.id),
      ...createDrawerOperations(
        current.snapshot.temporaryDrawer,
        nextDrawer,
        current.snapshot.project.id
      )
    ]);

    return drawerItem.id;
  }

  async restoreDrawerItem(drawerItemId: string, insertAtIndex: number) {
    const current = this.requireState();
    const drawerItem = current.snapshot.temporaryDrawer.find(
      (item) => item.id === drawerItemId
    );
    const activeEpisode = getActiveEpisode(current.snapshot);

    if (!drawerItem || !activeEpisode) {
      return null;
    }

    const timestamp = this.now();
    const parsedPayload = parseDrawerPayload(drawerItem.note);
    const existingIds = new Set(current.snapshot.nodes.map((node) => node.id));
    const restoredPayload =
      parsedPayload && parsedPayload.nodes.length > 0
        ? this.remapRestoredNodes(
            assignNodesToEpisode(
              parsedPayload.nodes,
              activeEpisode.id,
              current.snapshot.project.id
            ),
            parsedPayload.rootId,
            existingIds
          )
        : this.createFallbackDrawerNodes(drawerItem, activeEpisode.id, timestamp);

    if (restoredPayload.nodes.length === 0) {
      return null;
    }

    const orderedRestoredNodes = sortNodesByOrder(restoredPayload.nodes);
    const restoredIds = new Set(orderedRestoredNodes.map((node) => node.id));
    const remainingNodes = getOrderedEpisodeNodes(current.snapshot, activeEpisode.id);
    const clampedIndex = clampInsertIndex(insertAtIndex, remainingNodes.length);
    const rootNode =
      orderedRestoredNodes.find((node) => node.id === restoredPayload.rootId) ??
      orderedRestoredNodes[0];

    if (!rootNode) {
      return null;
    }
    const rootParentId = inferParentId(
      remainingNodes,
      rootNode.level,
      clampedIndex,
      restoredIds
    );
    const mergedNodes = [
      ...remainingNodes.slice(0, clampedIndex),
      ...orderedRestoredNodes.map((node) =>
        node.id === rootNode.id
          ? {
              ...node,
              parentId: rootParentId
            }
          : node
      ),
      ...remainingNodes.slice(clampedIndex)
    ];
    const nextEpisodeNodes = normalizeNodeOrder(stampNodes(mergedNodes, timestamp));
    const nextNodes = mergeEpisodeNodes(current.snapshot.nodes, activeEpisode.id, nextEpisodeNodes);
    const nextDrawer = current.snapshot.temporaryDrawer.filter(
      (item) => item.id !== drawerItemId
    );
    const snapshot: StoryWorkspaceSnapshot = {
      ...current.snapshot,
      nodes: nextNodes,
      temporaryDrawer: nextDrawer
    };

    this.applyLocalMutation(snapshot, [
      ...createNodeOperations(current.snapshot.nodes, nextNodes, current.snapshot.project.id),
      ...createDrawerOperations(
        current.snapshot.temporaryDrawer,
        nextDrawer,
        current.snapshot.project.id
      )
    ]);

    return rootNode.id;
  }

  async pasteNodeTree(
    copiedNodes: StoryNode[],
    copiedRootId: string | null,
    insertAtIndex: number
  ) {
    const current = this.requireState();
    const activeEpisode = getActiveEpisode(current.snapshot);

    if (copiedNodes.length === 0 || !activeEpisode) {
      return null;
    }

    const timestamp = this.now();
    const existingIds = new Set(current.snapshot.nodes.map((node) => node.id));
    const remappedPayload = this.remapRestoredNodes(
      assignNodesToEpisode(
        stampNodes(copiedNodes, timestamp),
        activeEpisode.id,
        current.snapshot.project.id
      ),
      copiedRootId,
      existingIds
    );

    if (remappedPayload.nodes.length === 0) {
      return null;
    }

    const orderedRestoredNodes = sortNodesByOrder(remappedPayload.nodes);
    const remainingNodes = getOrderedEpisodeNodes(current.snapshot, activeEpisode.id);
    const restoredIds = new Set(orderedRestoredNodes.map((node) => node.id));
    const clampedIndex = clampInsertIndex(insertAtIndex, remainingNodes.length);
    const rootNode =
      orderedRestoredNodes.find((node) => node.id === remappedPayload.rootId) ??
      orderedRestoredNodes[0];

    if (!rootNode) {
      return null;
    }

    const rootParentId = inferParentId(
      remainingNodes,
      rootNode.level,
      clampedIndex,
      restoredIds
    );
    const mergedNodes = [
      ...remainingNodes.slice(0, clampedIndex),
      ...orderedRestoredNodes.map((node) =>
        node.id === rootNode.id
          ? {
              ...node,
              parentId: rootParentId
            }
          : node
      ),
      ...remainingNodes.slice(clampedIndex)
    ];
    const nextEpisodeNodes = normalizeNodeOrder(stampNodes(mergedNodes, timestamp));
    const nextNodes = mergeEpisodeNodes(current.snapshot.nodes, activeEpisode.id, nextEpisodeNodes);
    const snapshot: StoryWorkspaceSnapshot = {
      ...current.snapshot,
      nodes: nextNodes
    };

    this.applyLocalMutation(
      snapshot,
      createNodeOperations(current.snapshot.nodes, nextNodes, current.snapshot.project.id)
    );

    return rootNode.id;
  }

  private async initializeInternal() {
    const session = await this.dependencies.auth.getCurrentSession();
    this.remoteSnapshot = null;
    this.setLocalCacheScope(session);
    this.reloadPendingSyncOperations();

    if (session.mode === "authenticated" && session.accountId !== null) {
      const loaded = this.loadOrSeedWorkspace();

      if (loaded) {
        this.resetHistory();
        this.replaceState({
          cloudProjectCount: null,
          lastError: null,
          linkage: loaded.linkage,
          registry: loaded.registry,
          session,
          snapshot: loaded.snapshot,
          syncStatus: "importing"
        });

        await this.connectAuthenticatedSession(
          session,
          loaded.snapshot,
          loaded.linkage
        );
        return;
      }

      await this.bootstrapAuthenticatedSession(session);
      return;
    }

    this.sanitizeGuestSampleCache();
    const loaded = this.loadOrSeedWorkspace();

    if (!loaded) {
      this.resetHistory();
      this.setGuestEmptyState(session, null);
      return;
    }

    this.resetHistory();

    this.replaceState({
      cloudProjectCount: null,
      lastError: null,
      linkage: loaded.linkage,
      registry: loaded.registry,
      session,
      snapshot: loaded.snapshot,
      syncStatus: "guest-local"
    });
  }

  // 현재 스코프에서 저장된 워크스페이스를 읽습니다.
  private loadOrSeedWorkspace() {
    const registry = this.dependencies.local.getRegistry();
    const activeProjectId =
      registry.activeProjectId ?? registry.projects[0]?.projectId ?? null;

    if (activeProjectId) {
      const snapshot = this.dependencies.local.getSnapshot(activeProjectId);

      if (snapshot) {
        const normalizedSnapshot = normalizeWorkspaceSnapshotObjectBindings(snapshot);
        const linkage = this.dependencies.local.getLinkage(activeProjectId);
        const nextRegistry = upsertRegistryEntry(
          registry,
          createRegistryEntry(normalizedSnapshot, linkage, this.now())
        );

        if (!snapshotsMatch(snapshot, normalizedSnapshot)) {
          this.dependencies.local.saveSnapshot(normalizedSnapshot);
        }
        this.dependencies.local.saveRegistry(nextRegistry);

        return {
          linkage,
          registry: nextRegistry,
          snapshot: normalizedSnapshot
        };
      }
    }

    return null;
  }

  // 인증 계정의 프로젝트가 없을 때 빈 상태를 명시적으로 설정합니다.
  private setAuthenticatedEmptyState(
    session: AuthSession,
    options: {
      cloudProjectCount: number | null;
      lastError: string | null;
      syncStatus: "authenticated-empty" | "error";
    }
  ) {
    const emptySnapshot = normalizeWorkspaceSnapshotObjectBindings(
      createEmptyWorkspaceShell(this.now(), this.createId)
    );
    const emptyRegistry: GlobalProjectRegistry = {
      activeProjectId: null,
      projects: []
    };

    this.remoteSnapshot = null;
    this.dependencies.local.saveRegistry(emptyRegistry);

    this.replaceState({
      cloudProjectCount: options.cloudProjectCount,
      lastError: options.lastError,
      linkage: null,
      registry: emptyRegistry,
      session,
      snapshot: emptySnapshot,
      syncStatus: options.syncStatus
    });
  }

  // 게스트 모드에서 사용할 빈 워크스페이스 상태를 설정합니다.
  private setGuestEmptyState(session: AuthSession, lastError: string | null) {
    const emptySnapshot = normalizeWorkspaceSnapshotObjectBindings(
      createEmptyWorkspaceShell(this.now(), this.createId)
    );
    const registryEntry = createRegistryEntry(emptySnapshot, null, this.now());
    const emptyRegistry: GlobalProjectRegistry = {
      activeProjectId: registryEntry.projectId,
      projects: [registryEntry]
    };

    this.remoteSnapshot = null;
    this.dependencies.local.saveSnapshot(emptySnapshot);
    this.dependencies.local.saveRegistry(emptyRegistry);

    this.replaceState({
      cloudProjectCount: null,
      lastError,
      linkage: null,
      registry: emptyRegistry,
      session,
      snapshot: emptySnapshot,
      syncStatus: "guest-local"
    });
  }

  // guest 캐시에서 알려진 샘플 워크스페이스를 식별해 제거합니다.
  private sanitizeGuestSampleCache() {
    if (this.dependencies.local.getCacheScope() !== "guest") {
      return false;
    }

    const registry = this.dependencies.local.getRegistry();
    let removedAny = false;
    const nextProjects = registry.projects.filter((entry) => {
      const snapshot = this.dependencies.local.getSnapshot(entry.projectId);

      if (!snapshot) {
        removedAny = true;
        this.dependencies.local.removeLinkage(entry.projectId);
        return false;
      }

      if (!isLegacySampleWorkspaceSnapshot(snapshot)) {
        return true;
      }

      removedAny = true;
      this.dependencies.local.removeSnapshot(entry.projectId);
      this.dependencies.local.removeLinkage(entry.projectId);
      return false;
    });
    const activeProjectId = nextProjects.some(
      (entry) => entry.projectId === registry.activeProjectId
    )
      ? registry.activeProjectId
      : (nextProjects[0]?.projectId ?? null);
    const shouldSaveRegistry =
      removedAny ||
      nextProjects.length !== registry.projects.length ||
      activeProjectId !== registry.activeProjectId;

    if (shouldSaveRegistry) {
      this.dependencies.local.saveRegistry({
        activeProjectId,
        projects: nextProjects
      });
    }

    return removedAny;
  }

  // 인증 계정의 로컬/원격 워크스페이스를 선택해 초기 상태를 부트스트랩합니다.
  private async bootstrapAuthenticatedSession(session: AuthSession) {
    try {
      const cloudProjects = await this.dependencies.cloud.listProjects();
      const cloudProjectCount = cloudProjects.projects.length;
      const preferredProjectId = [...cloudProjects.projects]
        .sort(
          (left, right) =>
            right.updatedAt.localeCompare(left.updatedAt) ||
            right.lastOpenedAt.localeCompare(left.lastOpenedAt)
        )[0]?.projectId ?? null;

      if (preferredProjectId) {
        const response = await this.dependencies.cloud.getProject(preferredProjectId);

        if (response.snapshot && response.linkage) {
          const normalizedSnapshot = normalizeWorkspaceSnapshotObjectBindings(
            response.snapshot
          );
          this.remoteSnapshot = cloneSnapshot(normalizedSnapshot);
          const registry = this.persistWorkspace(normalizedSnapshot, response.linkage);
          this.resetHistory();

          this.replaceState({
            cloudProjectCount,
            lastError: null,
            linkage: cloneLinkage(response.linkage),
            registry,
            session,
            snapshot: cloneSnapshot(normalizedSnapshot),
            syncStatus: "synced"
          });

          return;
        }

        this.resetHistory();
        this.setAuthenticatedEmptyState(session, {
          cloudProjectCount,
          lastError: "cloud_project_unavailable",
          syncStatus: "error"
        });
        return;
      }

      this.resetHistory();
      this.setAuthenticatedEmptyState(session, {
        cloudProjectCount,
        lastError: null,
        syncStatus: "authenticated-empty"
      });
    } catch (error) {
      this.resetHistory();
      this.setAuthenticatedEmptyState(session, {
        cloudProjectCount: null,
        lastError: this.toMessage(error),
        syncStatus: "error"
      });
    }
  }

  private async connectAuthenticatedSession(
    session: AuthSession,
    snapshot: StoryWorkspaceSnapshot,
    linkage: ProjectLinkageMetadata | null
  ) {
    if (session.accountId === null) {
      return;
    }

    this.patchState({
      lastError: null,
      syncStatus: "importing"
    });

    try {
      let nextSnapshot = snapshot;
      let nextLinkage = linkage;

      if (
        linkage?.cloudLinked &&
        linkage.linkedAccountId === session.accountId
      ) {
        this.patchState({
          syncStatus: "syncing"
        });
        const response = await this.dependencies.cloud.getProject(
          snapshot.project.id
        );

        if (response.snapshot && response.linkage) {
          nextSnapshot = response.snapshot;
          nextLinkage = response.linkage;
        } else {
          const imported = await this.dependencies.cloud.importProject(
            {
              linkage,
              snapshot
            }
          );

          nextSnapshot = imported.snapshot;
          nextLinkage = imported.linkage;
        }
      } else {
        const imported = await this.dependencies.cloud.importProject(
          {
            linkage,
            snapshot
          }
        );

        nextSnapshot = imported.snapshot;
        nextLinkage = imported.linkage;
      }

      nextSnapshot = normalizeWorkspaceSnapshotObjectBindings(nextSnapshot);
      this.remoteSnapshot = cloneSnapshot(nextSnapshot);
      const registry = this.persistWorkspace(nextSnapshot, nextLinkage);
      const cloudProjectCount = await this.getCloudProjectCount();
      this.resetHistory();

      this.replaceState({
        cloudProjectCount,
        lastError: null,
        linkage: cloneLinkage(nextLinkage),
        registry,
        session,
        snapshot: cloneSnapshot(nextSnapshot),
        syncStatus: "synced"
      });

      await this.flushNow();
    } catch (error) {
      this.patchState({
        lastError: this.toMessage(error),
        syncStatus: "error"
      });
    }
  }

  private applyLocalMutation(
    snapshot: StoryWorkspaceSnapshot,
    operations: CloudSyncOperation[]
  ) {
    const current = this.requireState();
    if (snapshotsMatch(current.snapshot, snapshot)) {
      return;
    }

    this.pushUndoSnapshot(current.snapshot);
    this.redoSnapshots = [];
    this.commitSnapshot(snapshot, operations);
  }

  private async applyHistoricalSnapshot(snapshot: StoryWorkspaceSnapshot) {
    const current = this.requireState();
    this.commitSnapshot(
      snapshot,
      createSnapshotOperations(current.snapshot, snapshot)
    );
  }

  private commitSnapshot(
    snapshot: StoryWorkspaceSnapshot,
    operations: CloudSyncOperation[]
  ) {
    const current = this.requireState();
    const registry = this.persistWorkspace(snapshot, current.linkage);

    this.replaceState({
      ...current,
      lastError: null,
      linkage: current.linkage,
      registry,
      snapshot: cloneSnapshot(snapshot),
      syncStatus:
        current.session.mode === "authenticated" && current.linkage?.cloudLinked
          ? "syncing"
          : "guest-local"
    });

    if (
      current.session.mode === "authenticated" &&
      current.session.accountId !== null &&
      current.linkage?.cloudLinked
    ) {
      this.flushQueue.schedule(operations);
    }
  }

  private pushUndoSnapshot(snapshot: StoryWorkspaceSnapshot) {
    this.undoSnapshots.push(cloneSnapshot(snapshot));

    if (this.undoSnapshots.length > this.historyLimit) {
      this.undoSnapshots.shift();
    }
  }

  private resetHistory() {
    this.undoSnapshots = [];
    this.redoSnapshots = [];
  }

  private persistWorkspace(
    snapshot: StoryWorkspaceSnapshot,
    linkage: ProjectLinkageMetadata | null
  ) {
    const nextSnapshot = cloneSnapshot(snapshot);
    const nextLinkage = cloneLinkage(linkage);
    const registry = upsertRegistryEntry(
      this.dependencies.local.getRegistry(),
      createRegistryEntry(nextSnapshot, nextLinkage, this.now())
    );

    this.dependencies.local.saveSnapshot(nextSnapshot);

    if (nextLinkage) {
      this.dependencies.local.saveLinkage(nextLinkage);
    }

    this.dependencies.local.saveRegistry(registry);

    return registry;
  }

  private async getCloudProjectCount() {
    try {
      const response = await this.dependencies.cloud.listProjects();
      return response.projects.length;
    } catch {
      return null;
    }
  }

  // 현재 인증 세션에 맞는 로컬 캐시 스코프를 적용합니다.
  private setLocalCacheScope(session: AuthSession) {
    this.dependencies.local.setCacheScope(getCacheScopeForSession(session));
  }

  // 현재 로컬 캐시 스코프의 pending sync를 플러시 큐에 다시 적재합니다.
  private reloadPendingSyncOperations() {
    this.flushQueue.replacePending(this.dependencies.local.getPendingSyncOperations());
  }

  private requireState() {
    if (!this.state) {
      throw new Error("workspace_not_initialized");
    }

    return this.state;
  }

  private replaceState(state: WorkspaceStateSeed) {
    this.state = {
      ...state,
      history: this.getHistoryState()
    };
    this.emit();
  }

  private patchState(patch: Partial<WorkspaceStateSeed>) {
    if (!this.state) {
      return;
    }

    this.state = {
      ...this.state,
      ...patch,
      history: this.getHistoryState()
    };
    this.emit();
  }

  private emit() {
    if (!this.state) {
      return;
    }

    for (const listener of this.listeners) {
      listener(this.state);
    }
  }

  private toMessage(error: unknown) {
    return error instanceof Error ? error.message : "unknown_error";
  }

  private getHistoryState(): WorkspaceHistoryState {
    return {
      canRedo: this.redoSnapshots.length > 0,
      canUndo: this.undoSnapshots.length > 0
    };
  }

  private remapRestoredNodes(
    nodes: StoryNode[],
    rootId: string | null,
    existingIds: Set<string>
  ) {
    const idMap = new Map<string, string>();
    const nextNodes = sortNodesByOrder(nodes).map((node) => {
      const nextId = existingIds.has(node.id) ? this.createId("node") : node.id;

      existingIds.add(nextId);
      idMap.set(node.id, nextId);

      return {
        ...node,
        id: nextId
      };
    });

    return {
      nodes: nextNodes.map((node) => ({
        ...node,
        parentId: node.parentId ? (idMap.get(node.parentId) ?? node.parentId) : null
      })),
      rootId: rootId ? (idMap.get(rootId) ?? rootId) : nextNodes[0]?.id ?? null
    };
  }

  private createFallbackDrawerNodes(
    drawerItem: TemporaryDrawerItem,
    episodeId: string,
    timestamp: string
  ) {
    const current = this.requireState();
    const episodeNodes = getOrderedEpisodeNodes(current.snapshot, episodeId);
    const sourceNode = drawerItem.sourceNodeId
      ? current.snapshot.nodes.find((node) => node.id === drawerItem.sourceNodeId) ?? null
      : null;
    const level: StoryNodeLevel =
      sourceNode?.level ??
      (episodeNodes.some((node) => node.level === "major") ? "minor" : "major");
    const text = [drawerItem.label, drawerItem.note].filter(Boolean).join(". ");
    const fallbackPlacement = sourceNode
      ? {
          canvasX: sourceNode.canvasX ?? defaultNodeXByLevel[level],
          canvasY: (sourceNode.canvasY ?? defaultNodeYByLevel[level]) + nodeVerticalSpacing
        }
      : getNextNodePlacement(level, episodeNodes);

    const node: StoryNode = {
      canvasX: fallbackPlacement.canvasX,
      canvasY: fallbackPlacement.canvasY,
      contentMode: text ? "text" : "empty",
      createdAt: drawerItem.createdAt,
      episodeId,
      id: this.createId("node"),
      isCollapsed: false,
      isFixed: false,
      isImportant: false,
      keywords: text ? [] : [drawerItem.label],
      level,
      objectIds: [],
      orderIndex: episodeNodes.length + 1,
      parentId: null,
      projectId: current.snapshot.project.id,
      text,
      updatedAt: timestamp
    };

    return {
      nodes: [node],
      rootId: node.id
    };
  }
}
