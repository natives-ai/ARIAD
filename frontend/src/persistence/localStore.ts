// 이 파일은 로컬 스토리지 기반 워크스페이스 영속화 저장소를 제공합니다.
import type {
  CloudSyncOperation,
  GlobalProjectRegistry,
  ProjectLinkageMetadata,
  StoryWorkspaceSnapshot
} from "@scenaairo/shared";

import type { StorageLike } from "../auth/stubAuthBoundary";

const REGISTRY_KEY = "persistence:registry";
const SNAPSHOT_KEY = "persistence:project";
const LINKAGE_KEY = "persistence:linkage";
const PENDING_SYNC_KEY = "persistence:pending-sync-operations";

export type PersistenceCacheScope = "bootstrap" | "guest" | `account:${string}`;

const LEGACY_REGISTRY_KEY = REGISTRY_KEY;
const LEGACY_SNAPSHOT_KEY = SNAPSHOT_KEY;
const LEGACY_LINKAGE_KEY = LINKAGE_KEY;
const LEGACY_PENDING_SYNC_KEY = PENDING_SYNC_KEY;

// 현재 세션 범위에 맞는 로컬 캐시를 읽고 씁니다.
export class LocalPersistenceStore {
  private cacheScope: PersistenceCacheScope;

  constructor(
    private readonly storage: StorageLike,
    private readonly storagePrefix: string,
    initialScope: PersistenceCacheScope = "bootstrap"
  ) {
    this.cacheScope = initialScope;
  }

  // 현재 로컬 캐시 스코프를 변경합니다.
  setCacheScope(scope: PersistenceCacheScope) {
    this.cacheScope = scope;
  }

  // 현재 로컬 캐시 스코프를 반환합니다.
  getCacheScope() {
    return this.cacheScope;
  }

  // 전역 프로젝트 레지스트리를 조회합니다.
  getRegistry(): GlobalProjectRegistry {
    const saved = this.readScopedItem(REGISTRY_KEY, LEGACY_REGISTRY_KEY);

    if (!saved) {
      return {
        activeProjectId: null,
        projects: []
      };
    }

    return JSON.parse(saved) as GlobalProjectRegistry;
  }

  // 전역 프로젝트 레지스트리를 저장합니다.
  saveRegistry(registry: GlobalProjectRegistry) {
    this.storage.setItem(this.scopedKey(REGISTRY_KEY), JSON.stringify(registry));
  }

  // 프로젝트 스냅샷을 조회합니다.
  getSnapshot(projectId: string): StoryWorkspaceSnapshot | null {
    const saved = this.readScopedItem(
      this.projectSnapshotKey(projectId),
      this.legacyProjectSnapshotKey(projectId)
    );
    return saved ? (JSON.parse(saved) as StoryWorkspaceSnapshot) : null;
  }

  // 프로젝트 스냅샷을 저장합니다.
  saveSnapshot(snapshot: StoryWorkspaceSnapshot) {
    this.storage.setItem(
      this.scopedKey(this.projectSnapshotKey(snapshot.project.id)),
      JSON.stringify(snapshot)
    );
  }

  // 프로젝트 스냅샷을 삭제합니다.
  removeSnapshot(projectId: string) {
    this.removeScopedItem(
      this.projectSnapshotKey(projectId),
      this.legacyProjectSnapshotKey(projectId)
    );
  }

  // 프로젝트 클라우드 연동 메타데이터를 조회합니다.
  getLinkage(projectId: string): ProjectLinkageMetadata | null {
    const saved = this.readScopedItem(
      this.projectLinkageKey(projectId),
      this.legacyProjectLinkageKey(projectId)
    );
    return saved ? (JSON.parse(saved) as ProjectLinkageMetadata) : null;
  }

  // 프로젝트 클라우드 연동 메타데이터를 저장합니다.
  saveLinkage(linkage: ProjectLinkageMetadata) {
    this.storage.setItem(
      this.scopedKey(this.projectLinkageKey(linkage.entityId)),
      JSON.stringify(linkage)
    );
  }

  // 프로젝트 클라우드 연동 메타데이터를 삭제합니다.
  removeLinkage(projectId: string) {
    this.removeScopedItem(
      this.projectLinkageKey(projectId),
      this.legacyProjectLinkageKey(projectId)
    );
  }

  // 영속화 대기 중인 동기화 연산 목록을 조회합니다.
  getPendingSyncOperations(): CloudSyncOperation[] {
    const saved = this.readScopedItem(PENDING_SYNC_KEY, LEGACY_PENDING_SYNC_KEY);

    if (!saved) {
      return [];
    }

    try {
      const parsed = JSON.parse(saved) as unknown;

      if (!Array.isArray(parsed)) {
        return [];
      }

      return parsed as CloudSyncOperation[];
    } catch {
      return [];
    }
  }

  // 동기화 대기 연산 목록을 로컬 스토리지에 저장합니다.
  savePendingSyncOperations(operations: CloudSyncOperation[]) {
    if (operations.length === 0) {
      this.storage.removeItem(this.scopedKey(PENDING_SYNC_KEY));
      return;
    }

    this.storage.setItem(this.scopedKey(PENDING_SYNC_KEY), JSON.stringify(operations));
  }

  // 동기화 대기 연산 목록을 초기화합니다.
  clearPendingSyncOperations() {
    this.storage.removeItem(this.scopedKey(PENDING_SYNC_KEY));
  }

  // 프로젝트별 연동 메타데이터 키를 생성합니다.
  private projectLinkageKey(projectId: string) {
    return `${LINKAGE_KEY}:${projectId}`;
  }

  // 프로젝트별 스냅샷 키를 생성합니다.
  private projectSnapshotKey(projectId: string) {
    return `${SNAPSHOT_KEY}:${projectId}`;
  }

  // 현재 스코프를 포함한 저장 키를 생성합니다.
  private scopedKey(key: string) {
    return `${this.storagePrefix}:${this.cacheScope}:${key}`;
  }

  // guest 레거시 키를 포함해 현재 스코프 값을 조회합니다.
  private readScopedItem(scopedKey: string, legacyKey: string) {
    const scopedValue = this.storage.getItem(this.scopedKey(scopedKey));

    if (scopedValue !== null) {
      return scopedValue;
    }

    if (this.cacheScope !== "guest") {
      return null;
    }

    return this.storage.getItem(`${this.storagePrefix}:${legacyKey}`);
  }

  // 현재 스코프 값을 삭제하고 guest라면 레거시 키도 함께 정리합니다.
  private removeScopedItem(scopedKey: string, legacyKey: string) {
    this.storage.removeItem(this.scopedKey(scopedKey));

    if (this.cacheScope !== "guest") {
      return;
    }

    this.storage.removeItem(`${this.storagePrefix}:${legacyKey}`);
  }

  // 레거시 guest 연동 키를 만듭니다.
  private legacyProjectLinkageKey(projectId: string) {
    return `${LEGACY_LINKAGE_KEY}:${projectId}`;
  }

  // 레거시 guest 스냅샷 키를 만듭니다.
  private legacyProjectSnapshotKey(projectId: string) {
    return `${LEGACY_SNAPSHOT_KEY}:${projectId}`;
  }
}
