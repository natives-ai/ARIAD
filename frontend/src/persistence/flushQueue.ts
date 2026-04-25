// 이 파일은 클라우드 동기화 작업의 의존성 정렬과 플러시 큐를 처리합니다.
import type {
  CloudSyncOperation,
  StoryWorkspaceSnapshot,
  SyncProjectResponse
} from "@scenaairo/shared";

const defaultRank: Record<CloudSyncOperation["kind"], number> = {
  episode: 3,
  node: 0,
  object: 1,
  project: 4,
  temporary_drawer: 2
};

const dependencyRank: Record<CloudSyncOperation["kind"], number> = {
  episode: 1,
  node: 3,
  object: 2,
  project: 0,
  temporary_drawer: 4
};

function getOperationKey(operation: CloudSyncOperation): string {
  if (operation.action === "delete") {
    return `${operation.kind}:${operation.entityId}`;
  }

  return `${operation.kind}:${operation.payload.id}`;
}

function hasProject(projectId: string, remoteSnapshot: StoryWorkspaceSnapshot | null) {
  return remoteSnapshot?.project.id === projectId;
}

function hasEpisode(
  episodeId: string,
  remoteSnapshot: StoryWorkspaceSnapshot | null,
  scheduledKeys: Set<string>
) {
  return (
    remoteSnapshot?.episodes.some((episode) => episode.id === episodeId) ||
    scheduledKeys.has(`episode:${episodeId}`)
  );
}

function hasNode(
  nodeId: string,
  remoteSnapshot: StoryWorkspaceSnapshot | null,
  scheduledKeys: Set<string>
) {
  return (
    remoteSnapshot?.nodes.some((node) => node.id === nodeId) ||
    scheduledKeys.has(`node:${nodeId}`)
  );
}

function hasObject(
  objectId: string,
  remoteSnapshot: StoryWorkspaceSnapshot | null,
  scheduledKeys: Set<string>
) {
  return (
    remoteSnapshot?.objects.some((object) => object.id === objectId) ||
    scheduledKeys.has(`object:${objectId}`)
  );
}

function getDependencyKeys(
  operation: CloudSyncOperation,
  remoteSnapshot: StoryWorkspaceSnapshot | null,
  availableOperations: Map<string, CloudSyncOperation>
) {
  if (operation.action === "delete") {
    return [];
  }

  const dependencies: string[] = [];

  switch (operation.kind) {
    case "project":
      return dependencies;
    case "episode":
      if (
        !hasProject(operation.payload.projectId, remoteSnapshot) &&
        availableOperations.has(`project:${operation.payload.projectId}`)
      ) {
        dependencies.push(`project:${operation.payload.projectId}`);
      }

      return dependencies;
    case "object":
      if (
        !hasProject(operation.payload.projectId, remoteSnapshot) &&
        availableOperations.has(`project:${operation.payload.projectId}`)
      ) {
        dependencies.push(`project:${operation.payload.projectId}`);
      }

      if (
        !hasEpisode(operation.payload.episodeId, remoteSnapshot, new Set()) &&
        availableOperations.has(`episode:${operation.payload.episodeId}`)
      ) {
        dependencies.push(`episode:${operation.payload.episodeId}`);
      }

      return dependencies;
    case "node":
      if (
        !hasProject(operation.payload.projectId, remoteSnapshot) &&
        availableOperations.has(`project:${operation.payload.projectId}`)
      ) {
        dependencies.push(`project:${operation.payload.projectId}`);
      }

      if (
        !hasEpisode(operation.payload.episodeId, remoteSnapshot, new Set()) &&
        availableOperations.has(`episode:${operation.payload.episodeId}`)
      ) {
        dependencies.push(`episode:${operation.payload.episodeId}`);
      }

      for (const objectId of operation.payload.objectIds) {
        if (
          !hasObject(objectId, remoteSnapshot, new Set()) &&
          availableOperations.has(`object:${objectId}`)
        ) {
          dependencies.push(`object:${objectId}`);
        }
      }

      if (
        operation.payload.parentId !== null &&
        !hasNode(operation.payload.parentId, remoteSnapshot, new Set()) &&
        availableOperations.has(`node:${operation.payload.parentId}`)
      ) {
        dependencies.push(`node:${operation.payload.parentId}`);
      }

      return dependencies;
    case "temporary_drawer":
      if (
        !hasProject(operation.payload.projectId, remoteSnapshot) &&
        availableOperations.has(`project:${operation.payload.projectId}`)
      ) {
        dependencies.push(`project:${operation.payload.projectId}`);
      }

      if (
        !hasEpisode(operation.payload.episodeId, remoteSnapshot, new Set()) &&
        availableOperations.has(`episode:${operation.payload.episodeId}`)
      ) {
        dependencies.push(`episode:${operation.payload.episodeId}`);
      }

      if (
        operation.payload.sourceNodeId !== null &&
        !hasNode(operation.payload.sourceNodeId, remoteSnapshot, new Set()) &&
        availableOperations.has(`node:${operation.payload.sourceNodeId}`)
      ) {
        dependencies.push(`node:${operation.payload.sourceNodeId}`);
      }

      return dependencies;
  }
}

export function sortCloudOperations(
  operations: CloudSyncOperation[],
  remoteSnapshot: StoryWorkspaceSnapshot | null
) {
  const deduped = new Map<string, CloudSyncOperation>();

  for (const operation of operations) {
    const key = getOperationKey(operation);
    if (deduped.has(key)) {
      deduped.delete(key);
    }

    deduped.set(key, operation);
  }

  const normalized = [...deduped.values()].map((operation, index) => ({
    index,
    key: getOperationKey(operation),
    operation
  }));
  const availableOperations = new Map(
    normalized.map((entry) => [entry.key, entry.operation])
  );
  const ordered: CloudSyncOperation[] = [];
  const scheduledKeys = new Set<string>();

  while (ordered.length < normalized.length) {
    const readyEntries = normalized
      .filter((entry) => !scheduledKeys.has(entry.key))
      .filter((entry) =>
        getDependencyKeys(entry.operation, remoteSnapshot, availableOperations).every(
          (dependencyKey) => scheduledKeys.has(dependencyKey)
        )
      )
      .sort(
        (left, right) =>
          defaultRank[left.operation.kind] - defaultRank[right.operation.kind] ||
          left.index - right.index
      );

    if (readyEntries.length === 0) {
      const remaining = normalized
        .filter((entry) => !scheduledKeys.has(entry.key))
        .sort(
          (left, right) =>
            dependencyRank[left.operation.kind] -
              dependencyRank[right.operation.kind] ||
            left.index - right.index
        );

      for (const entry of remaining) {
        ordered.push(entry.operation);
        scheduledKeys.add(entry.key);
      }

      break;
    }

    const nextEntry = readyEntries[0]!;

    ordered.push(nextEntry.operation);
    scheduledKeys.add(nextEntry.key);
  }

  return ordered;
}

interface FlushQueueOptions {
  debounceMs?: number;
  onSynced: (response: SyncProjectResponse) => void;
  onSyncing: () => void;
  onError: (error: Error) => void;
  loadPending?: () => CloudSyncOperation[];
  savePending?: (operations: CloudSyncOperation[]) => void;
  retryBaseMs?: number;
  maxRetryDelayMs?: number;
  syncProject: (operations: CloudSyncOperation[]) => Promise<SyncProjectResponse>;
  getRemoteSnapshot: () => StoryWorkspaceSnapshot | null;
}

export class PersistenceFlushQueue {
  private inFlight: Promise<void> | null = null;

  private pending: CloudSyncOperation[] = [];

  private retryAttempt = 0;

  private retryTimeoutId: ReturnType<typeof setTimeout> | null = null;

  private timeoutId: ReturnType<typeof setTimeout> | null = null;

  private readonly debounceMs: number;

  private readonly retryBaseMs: number;

  private readonly maxRetryDelayMs: number;

  constructor(private readonly options: FlushQueueOptions) {
    this.debounceMs = options.debounceMs ?? 40;
    this.retryBaseMs = options.retryBaseMs ?? 1000;
    this.maxRetryDelayMs = options.maxRetryDelayMs ?? 15000;
    this.pending = [...(options.loadPending?.() ?? [])];
  }

  // 큐 타이머를 정리하고 후속 동기화를 중단합니다.
  dispose() {
    if (this.timeoutId) {
      clearTimeout(this.timeoutId);
      this.timeoutId = null;
    }

    if (this.retryTimeoutId) {
      clearTimeout(this.retryTimeoutId);
      this.retryTimeoutId = null;
    }
  }

  // 현재 스코프의 대기 연산으로 큐 내용을 교체합니다.
  replacePending(operations: CloudSyncOperation[]) {
    if (this.timeoutId) {
      clearTimeout(this.timeoutId);
      this.timeoutId = null;
    }

    if (this.retryTimeoutId) {
      clearTimeout(this.retryTimeoutId);
      this.retryTimeoutId = null;
    }

    this.retryAttempt = 0;
    this.pending = [...operations];
  }

  // 새 동기화 연산을 큐에 적재하고 디바운스 플러시를 예약합니다.
  schedule(operations: CloudSyncOperation[]) {
    if (operations.length === 0) {
      return;
    }

    this.pending.push(...operations);
    this.persistPending();

    if (this.timeoutId) {
      clearTimeout(this.timeoutId);
    }

    if (this.retryTimeoutId) {
      clearTimeout(this.retryTimeoutId);
      this.retryTimeoutId = null;
    }

    this.timeoutId = setTimeout(() => {
      void this.flushNow();
    }, this.debounceMs);
  }

  // 현재 큐를 즉시 원격으로 전송합니다.
  async flushNow() {
    if (this.timeoutId) {
      clearTimeout(this.timeoutId);
      this.timeoutId = null;
    }

    if (this.retryTimeoutId) {
      clearTimeout(this.retryTimeoutId);
      this.retryTimeoutId = null;
    }

    if (this.pending.length === 0) {
      if (this.inFlight) {
        await this.inFlight;
      }
      return;
    }

    if (this.inFlight) {
      await this.inFlight;
      return;
    }

    const operations = sortCloudOperations(
      this.pending,
      this.options.getRemoteSnapshot()
    );
    this.pending = [];
    this.persistPending();

    this.options.onSyncing();
    this.inFlight = this.options
      .syncProject(operations)
      .then((response) => {
        this.retryAttempt = 0;
        this.options.onSynced(response);
      })
      .catch((error: unknown) => {
        const syncError =
          error instanceof Error ? error : new Error("sync_failed");
        this.pending = [...operations, ...this.pending];
        this.persistPending();

        if (syncError.message !== "not_authenticated") {
          this.retryAttempt += 1;
          this.scheduleRetry();
        }

        this.options.onError(syncError);
      })
      .finally(() => {
        this.inFlight = null;
      });

    await this.inFlight;
  }

  // 현재 대기 연산을 영속 저장소에 기록합니다.
  private persistPending() {
    if (this.options.savePending) {
      this.options.savePending(this.pending);
    }
  }

  // 실패 후 지수 백오프로 재시도를 예약합니다.
  private scheduleRetry() {
    if (this.pending.length === 0) {
      return;
    }

    if (this.retryTimeoutId) {
      clearTimeout(this.retryTimeoutId);
    }

    const delay = Math.min(
      this.maxRetryDelayMs,
      this.retryBaseMs * 2 ** Math.max(0, this.retryAttempt - 1)
    );

    this.retryTimeoutId = setTimeout(() => {
      this.retryTimeoutId = null;
      void this.flushNow();
    }, delay);
  }
}
