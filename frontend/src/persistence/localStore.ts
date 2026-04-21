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

export class LocalPersistenceStore {
  private readonly registryKey: string;
  private readonly pendingSyncKey: string;

  constructor(
    private readonly storage: StorageLike,
    private readonly storagePrefix: string
  ) {
    this.registryKey = `${storagePrefix}:${REGISTRY_KEY}`;
    this.pendingSyncKey = `${storagePrefix}:${PENDING_SYNC_KEY}`;
  }

  // 전역 프로젝트 레지스트리를 조회합니다.
  getRegistry(): GlobalProjectRegistry {
    const saved = this.storage.getItem(this.registryKey);

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
    this.storage.setItem(this.registryKey, JSON.stringify(registry));
  }

  // 프로젝트 스냅샷을 조회합니다.
  getSnapshot(projectId: string): StoryWorkspaceSnapshot | null {
    const saved = this.storage.getItem(this.projectSnapshotKey(projectId));
    return saved ? (JSON.parse(saved) as StoryWorkspaceSnapshot) : null;
  }

  // 프로젝트 스냅샷을 저장합니다.
  saveSnapshot(snapshot: StoryWorkspaceSnapshot) {
    this.storage.setItem(
      this.projectSnapshotKey(snapshot.project.id),
      JSON.stringify(snapshot)
    );
  }

  // 프로젝트 클라우드 연동 메타데이터를 조회합니다.
  getLinkage(projectId: string): ProjectLinkageMetadata | null {
    const saved = this.storage.getItem(this.projectLinkageKey(projectId));
    return saved ? (JSON.parse(saved) as ProjectLinkageMetadata) : null;
  }

  // 프로젝트 클라우드 연동 메타데이터를 저장합니다.
  saveLinkage(linkage: ProjectLinkageMetadata) {
    this.storage.setItem(this.projectLinkageKey(linkage.entityId), JSON.stringify(linkage));
  }

  // 영속화 대기 중인 동기화 연산 목록을 조회합니다.
  getPendingSyncOperations(): CloudSyncOperation[] {
    const saved = this.storage.getItem(this.pendingSyncKey);

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
      this.storage.removeItem(this.pendingSyncKey);
      return;
    }

    this.storage.setItem(this.pendingSyncKey, JSON.stringify(operations));
  }

  // 동기화 대기 연산 목록을 초기화합니다.
  clearPendingSyncOperations() {
    this.storage.removeItem(this.pendingSyncKey);
  }

  // 프로젝트별 연동 메타데이터 키를 생성합니다.
  private projectLinkageKey(projectId: string) {
    return `${this.storagePrefix}:${LINKAGE_KEY}:${projectId}`;
  }

  // 프로젝트별 스냅샷 키를 생성합니다.
  private projectSnapshotKey(projectId: string) {
    return `${this.storagePrefix}:${SNAPSHOT_KEY}:${projectId}`;
  }
}
