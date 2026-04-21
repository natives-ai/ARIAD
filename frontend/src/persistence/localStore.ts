import type {
  GlobalProjectRegistry,
  ProjectLinkageMetadata,
  StoryWorkspaceSnapshot
} from "@scenaairo/shared";

import type { StorageLike } from "../auth/stubAuthBoundary";

const REGISTRY_KEY = "persistence:registry";
const SNAPSHOT_KEY = "persistence:project";
const LINKAGE_KEY = "persistence:linkage";

export class LocalPersistenceStore {
  private readonly registryKey: string;

  constructor(
    private readonly storage: StorageLike,
    private readonly storagePrefix: string
  ) {
    this.registryKey = `${storagePrefix}:${REGISTRY_KEY}`;
  }

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

  saveRegistry(registry: GlobalProjectRegistry) {
    this.storage.setItem(this.registryKey, JSON.stringify(registry));
  }

  getSnapshot(projectId: string): StoryWorkspaceSnapshot | null {
    const saved = this.storage.getItem(this.projectSnapshotKey(projectId));
    return saved ? (JSON.parse(saved) as StoryWorkspaceSnapshot) : null;
  }

  saveSnapshot(snapshot: StoryWorkspaceSnapshot) {
    this.storage.setItem(
      this.projectSnapshotKey(snapshot.project.id),
      JSON.stringify(snapshot)
    );
  }

  getLinkage(projectId: string): ProjectLinkageMetadata | null {
    const saved = this.storage.getItem(this.projectLinkageKey(projectId));
    return saved ? (JSON.parse(saved) as ProjectLinkageMetadata) : null;
  }

  saveLinkage(linkage: ProjectLinkageMetadata) {
    this.storage.setItem(this.projectLinkageKey(linkage.entityId), JSON.stringify(linkage));
  }

  private projectLinkageKey(projectId: string) {
    return `${this.storagePrefix}:${LINKAGE_KEY}:${projectId}`;
  }

  private projectSnapshotKey(projectId: string) {
    return `${this.storagePrefix}:${SNAPSHOT_KEY}:${projectId}`;
  }
}
