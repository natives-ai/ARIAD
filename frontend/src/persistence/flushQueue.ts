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
  syncProject: (operations: CloudSyncOperation[]) => Promise<SyncProjectResponse>;
  getRemoteSnapshot: () => StoryWorkspaceSnapshot | null;
}

export class PersistenceFlushQueue {
  private inFlight: Promise<void> | null = null;

  private pending: CloudSyncOperation[] = [];

  private timeoutId: ReturnType<typeof setTimeout> | null = null;

  private readonly debounceMs: number;

  constructor(private readonly options: FlushQueueOptions) {
    this.debounceMs = options.debounceMs ?? 40;
  }

  dispose() {
    if (this.timeoutId) {
      clearTimeout(this.timeoutId);
      this.timeoutId = null;
    }
  }

  schedule(operations: CloudSyncOperation[]) {
    this.pending.push(...operations);

    if (this.timeoutId) {
      clearTimeout(this.timeoutId);
    }

    this.timeoutId = setTimeout(() => {
      void this.flushNow();
    }, this.debounceMs);
  }

  async flushNow() {
    if (this.timeoutId) {
      clearTimeout(this.timeoutId);
      this.timeoutId = null;
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

    this.options.onSyncing();
    this.inFlight = this.options
      .syncProject(operations)
      .then((response) => {
        this.options.onSynced(response);
      })
      .catch((error: unknown) => {
        this.pending = [...operations, ...this.pending];
        this.options.onError(error instanceof Error ? error : new Error("sync_failed"));
      })
      .finally(() => {
        this.inFlight = null;
      });

    await this.inFlight;
  }
}
