// 이 파일은 워크스페이스 퍼시스턴스 컨트롤러의 인증/캐시 회귀를 검증합니다.
import { describe, expect, it } from "vitest";
import type {
  AuthSession,
  CloudSyncOperation,
  GlobalProjectRegistryEntry,
  ImportProjectResponse,
  ProjectLinkageMetadata,
  StoryWorkspaceSnapshot
} from "@scenaairo/shared";

import { StubAuthBoundary, type StorageLike } from "../auth/stubAuthBoundary";
import { WorkspacePersistenceController } from "./controller";
import { LocalPersistenceStore } from "./localStore";
import { collectSubtreeNodes } from "./nodeTree";
import { createSampleWorkspace } from "./sampleWorkspace";

function cloneSnapshot(snapshot: StoryWorkspaceSnapshot): StoryWorkspaceSnapshot {
  return JSON.parse(JSON.stringify(snapshot)) as StoryWorkspaceSnapshot;
}

function upsertById<T extends { id: string }>(items: T[], item: T) {
  return [...items.filter((entry) => entry.id !== item.id), item];
}

function removeById<T extends { id: string }>(items: T[], id: string) {
  return items.filter((entry) => entry.id !== id);
}

class MemoryStorage implements StorageLike {
  private readonly values = new Map<string, string>();

  getItem(key: string) {
    return this.values.get(key) ?? null;
  }

  removeItem(key: string) {
    this.values.delete(key);
  }

  setItem(key: string, value: string) {
    this.values.set(key, value);
  }
}

// 테스트에서 원하는 세션 전환을 제어하는 인증 경계를 제공합니다.
class ControlledAuthBoundary {
  private currentSession: AuthSession;
  private nextSignInSession: AuthSession;

  constructor(initialSession: AuthSession) {
    this.currentSession = { ...initialSession };
    this.nextSignInSession = { ...initialSession };
  }

  setNextSignInSession(session: AuthSession) {
    this.nextSignInSession = { ...session };
  }

  getCurrentAccountId() {
    return this.currentSession.accountId;
  }

  async getCurrentSession() {
    return { ...this.currentSession };
  }

  async signIn() {
    this.currentSession = { ...this.nextSignInSession };
    return { ...this.currentSession };
  }

  async signOut() {
    this.currentSession = {
      accountId: null,
      displayName: "Guest Creator",
      mode: "guest"
    };
    return { ...this.currentSession };
  }
}

interface StoredProjectRecord {
  linkage: ProjectLinkageMetadata;
  snapshot: StoryWorkspaceSnapshot;
}

class FakeCloudPersistenceGateway {
  private readonly projects = new Map<string, StoredProjectRecord>();
  private readonly lastSyncOperationsByProject = new Map<string, CloudSyncOperation[]>();

  constructor(private readonly now: () => string) {}

  async getProject(projectId: string) {
    const project = this.projects.get(projectId);

    if (!project) {
      return {
        linkage: null,
        snapshot: null
      };
    }

    return {
      linkage: { ...project.linkage },
      snapshot: cloneSnapshot(project.snapshot)
    };
  }

  async importProject(
    payload: {
      linkage: ProjectLinkageMetadata | null;
      snapshot: StoryWorkspaceSnapshot;
    }
  ) {
    const projectId = payload.snapshot.project.id;
    const fallbackAccountId = payload.linkage?.linkedAccountId ?? "demo-account";
    const existing = this.projects.get(projectId);

    if (existing) {
      return {
        created: false,
        linkage: { ...existing.linkage },
        snapshot: cloneSnapshot(existing.snapshot)
      };
    }

    const linkage: ProjectLinkageMetadata = {
      cloudLinked: true,
      entityId: payload.linkage?.entityId ?? projectId,
      lastImportedAt: this.now(),
      lastSyncedAt: this.now(),
      linkedAccountId: fallbackAccountId
    };

    this.projects.set(projectId, {
      linkage,
      snapshot: cloneSnapshot(payload.snapshot)
    });

    return {
      created: true,
      linkage: { ...linkage },
      snapshot: cloneSnapshot(payload.snapshot)
    };
  }

  async listProjects() {
    const projects = [...this.projects.values()].map(
      ({ linkage, snapshot }): GlobalProjectRegistryEntry => ({
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

  async syncProject(
    projectId: string,
    payload: {
      operations: CloudSyncOperation[];
    }
  ) {
    const current = this.projects.get(projectId);

    if (!current) {
      throw new Error("missing_project");
    }

    this.lastSyncOperationsByProject.set(
      projectId,
      payload.operations.map((operation) =>
        JSON.parse(JSON.stringify(operation)) as CloudSyncOperation
      )
    );

    let snapshot = cloneSnapshot(current.snapshot);

    for (const operation of payload.operations) {
      if (operation.action === "delete") {
        switch (operation.kind) {
          case "project":
            throw new Error("project_delete_not_supported");
          case "episode":
            snapshot = {
              ...snapshot,
              episodes: removeById(snapshot.episodes, operation.entityId)
            };
            break;
          case "object":
            snapshot = {
              ...snapshot,
              objects: removeById(snapshot.objects, operation.entityId)
            };
            break;
          case "node":
            snapshot = {
              ...snapshot,
              nodes: removeById(snapshot.nodes, operation.entityId)
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
          snapshot = {
            ...snapshot,
            project: operation.payload
          };
          break;
        case "episode":
          snapshot = {
            ...snapshot,
            episodes: upsertById(snapshot.episodes, operation.payload)
          };
          break;
        case "object":
          snapshot = {
            ...snapshot,
            objects: upsertById(snapshot.objects, operation.payload)
          };
          break;
        case "node":
          snapshot = {
            ...snapshot,
            nodes: upsertById(snapshot.nodes, operation.payload)
          };
          break;
        case "temporary_drawer":
          snapshot = {
            ...snapshot,
            temporaryDrawer: upsertById(snapshot.temporaryDrawer, operation.payload)
          };
          break;
      }
    }

    const linkage: ProjectLinkageMetadata = {
      ...current.linkage,
      lastSyncedAt: this.now()
    };

    this.projects.set(projectId, {
      linkage,
      snapshot
    });

    return {
      linkage: { ...linkage },
      snapshot: cloneSnapshot(snapshot)
    };
  }

  getLastSyncOperations(projectId: string) {
    return [...(this.lastSyncOperationsByProject.get(projectId) ?? [])];
  }

  seedProject(
    snapshot: StoryWorkspaceSnapshot,
    linkage: ProjectLinkageMetadata
  ) {
    this.projects.set(snapshot.project.id, {
      linkage: { ...linkage },
      snapshot: cloneSnapshot(snapshot)
    });
  }
}

// 현재 인증 계정 기준으로만 프로젝트를 노출하는 클라우드 게이트웨이 테스트 더블입니다.
class SessionScopedCloudPersistenceGateway {
  private readonly projectsByAccount = new Map<string, Map<string, StoredProjectRecord>>();

  constructor(
    private readonly now: () => string,
    private readonly getCurrentAccountId: () => string | null
  ) {}

  async getProject(projectId: string) {
    const currentProjects = this.getCurrentAccountProjects();
    const project = currentProjects?.get(projectId);

    if (!project) {
      return {
        linkage: null,
        snapshot: null
      };
    }

    return {
      linkage: { ...project.linkage },
      snapshot: cloneSnapshot(project.snapshot)
    };
  }

  async importProject(payload: {
    linkage: ProjectLinkageMetadata | null;
    snapshot: StoryWorkspaceSnapshot;
  }) {
    const accountId = this.requireCurrentAccountId();
    const accountProjects = this.ensureAccountProjects(accountId);
    const projectId = payload.snapshot.project.id;
    const existing = accountProjects.get(projectId);

    if (existing) {
      return {
        created: false,
        linkage: { ...existing.linkage },
        snapshot: cloneSnapshot(existing.snapshot)
      };
    }

    const linkage: ProjectLinkageMetadata = {
      cloudLinked: true,
      entityId: payload.linkage?.entityId ?? projectId,
      lastImportedAt: this.now(),
      lastSyncedAt: this.now(),
      linkedAccountId: accountId
    };

    accountProjects.set(projectId, {
      linkage,
      snapshot: cloneSnapshot(payload.snapshot)
    });

    return {
      created: true,
      linkage: { ...linkage },
      snapshot: cloneSnapshot(payload.snapshot)
    };
  }

  async listProjects() {
    const accountProjects = this.getCurrentAccountProjects();
    const projects = [...(accountProjects?.values() ?? [])].map(
      ({ linkage, snapshot }): GlobalProjectRegistryEntry => ({
        cloudLinked: linkage.cloudLinked,
        lastOpenedAt: snapshot.project.updatedAt,
        linkedAccountId: linkage.linkedAccountId,
        projectId: snapshot.project.id,
        summary: snapshot.project.summary,
        title: snapshot.project.title,
        updatedAt: snapshot.project.updatedAt
      })
    );

    return { projects };
  }

  async syncProject(
    projectId: string,
    payload: {
      operations: CloudSyncOperation[];
    }
  ) {
    const accountId = this.requireCurrentAccountId();
    const accountProjects = this.ensureAccountProjects(accountId);
    const current = accountProjects.get(projectId);

    if (!current) {
      throw new Error("missing_project");
    }

    let snapshot = cloneSnapshot(current.snapshot);

    for (const operation of payload.operations) {
      if (operation.action === "delete") {
        switch (operation.kind) {
          case "project":
            throw new Error("project_delete_not_supported");
          case "episode":
            snapshot = {
              ...snapshot,
              episodes: removeById(snapshot.episodes, operation.entityId)
            };
            break;
          case "object":
            snapshot = {
              ...snapshot,
              objects: removeById(snapshot.objects, operation.entityId)
            };
            break;
          case "node":
            snapshot = {
              ...snapshot,
              nodes: removeById(snapshot.nodes, operation.entityId)
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
          snapshot = {
            ...snapshot,
            project: operation.payload
          };
          break;
        case "episode":
          snapshot = {
            ...snapshot,
            episodes: upsertById(snapshot.episodes, operation.payload)
          };
          break;
        case "object":
          snapshot = {
            ...snapshot,
            objects: upsertById(snapshot.objects, operation.payload)
          };
          break;
        case "node":
          snapshot = {
            ...snapshot,
            nodes: upsertById(snapshot.nodes, operation.payload)
          };
          break;
        case "temporary_drawer":
          snapshot = {
            ...snapshot,
            temporaryDrawer: upsertById(snapshot.temporaryDrawer, operation.payload)
          };
          break;
      }
    }

    const linkage: ProjectLinkageMetadata = {
      ...current.linkage,
      lastSyncedAt: this.now()
    };

    accountProjects.set(projectId, {
      linkage,
      snapshot
    });

    return {
      linkage: { ...linkage },
      snapshot: cloneSnapshot(snapshot)
    };
  }

  seedProject(
    accountId: string,
    snapshot: StoryWorkspaceSnapshot,
    linkage: ProjectLinkageMetadata
  ) {
    const accountProjects = this.ensureAccountProjects(accountId);
    accountProjects.set(snapshot.project.id, {
      linkage: { ...linkage },
      snapshot: cloneSnapshot(snapshot)
    });
  }

  private getCurrentAccountProjects() {
    const accountId = this.getCurrentAccountId();

    if (!accountId) {
      return null;
    }

    return this.projectsByAccount.get(accountId) ?? null;
  }

  private ensureAccountProjects(accountId: string) {
    const existing = this.projectsByAccount.get(accountId);

    if (existing) {
      return existing;
    }

    const created = new Map<string, StoredProjectRecord>();
    this.projectsByAccount.set(accountId, created);
    return created;
  }

  private requireCurrentAccountId() {
    const accountId = this.getCurrentAccountId();

    if (!accountId) {
      throw new Error("not_authenticated");
    }

    return accountId;
  }
}

class ImportFailureCloudPersistenceGateway extends FakeCloudPersistenceGateway {
  override async importProject(
    _payload: {
      linkage: ProjectLinkageMetadata | null;
      snapshot: StoryWorkspaceSnapshot;
    }
  ): Promise<ImportProjectResponse> {
    void _payload;
    throw new Error("import_failed");
  }
}

class SyncFailureOnceCloudPersistenceGateway extends FakeCloudPersistenceGateway {
  private shouldFailNextSync = true;

  override async syncProject(
    projectId: string,
    payload: {
      operations: CloudSyncOperation[];
    }
  ) {
    if (this.shouldFailNextSync) {
      this.shouldFailNextSync = false;
      throw new Error("transient_sync_failure");
    }

    return super.syncProject(projectId, payload);
  }
}

function createClock() {
  let tick = 0;

  return () => {
    const seconds = String(tick).padStart(2, "0");
    tick += 1;
    return `2026-04-15T00:00:${seconds}.000Z`;
  };
}

// 스냅샷에 레거시 샘플 에피소드 타이틀이 포함되는지 확인합니다.
function hasLegacySampleEpisodeTitles(snapshot: StoryWorkspaceSnapshot) {
  const episodeTitles = new Set(snapshot.episodes.map((episode) => episode.title));
  return (
    episodeTitles.has("Episode 12") &&
    episodeTitles.has("Episode 11") &&
    episodeTitles.has("Episode 10") &&
    episodeTitles.has("Episode 9")
  );
}

// guest 스코프에 레거시 샘플 캐시를 주입합니다.
function seedLegacyGuestSampleCache(storage: MemoryStorage, now: () => string) {
  const local = new LocalPersistenceStore(storage, "test");
  local.setCacheScope("guest");

  const sampleSnapshot = createSampleWorkspace(now());
  local.saveSnapshot(sampleSnapshot);
  local.saveRegistry({
    activeProjectId: sampleSnapshot.project.id,
    projects: [
      {
        cloudLinked: false,
        lastOpenedAt: sampleSnapshot.project.updatedAt,
        linkedAccountId: null,
        projectId: sampleSnapshot.project.id,
        summary: sampleSnapshot.project.summary,
        title: sampleSnapshot.project.title,
        updatedAt: sampleSnapshot.project.updatedAt
      }
    ]
  });

  return sampleSnapshot;
}

describe("workspace persistence controller", () => {
  it("boots guest mode with an empty local workspace shell and stable registry metadata", async () => {
    const now = createClock();
    const storage = new MemoryStorage();
    const auth = new StubAuthBoundary(storage, "test");
    const controller = new WorkspacePersistenceController({
      auth,
      cloud: new FakeCloudPersistenceGateway(now),
      local: new LocalPersistenceStore(storage, "test"),
      now
    });

    await controller.initialize();

    const state = controller.getState();

    expect(state?.session.mode).toBe("guest");
    expect(state?.snapshot.project.id).toMatch(/^project_/);
    expect(state?.snapshot.project.activeEpisodeId).toBe("");
    expect(state?.snapshot.episodes).toHaveLength(0);
    expect(state?.snapshot.objects).toHaveLength(0);
    expect(state?.snapshot.nodes).toHaveLength(0);
    expect(state?.snapshot.temporaryDrawer).toHaveLength(0);
    expect(state?.registry.activeProjectId).toBe(state?.snapshot.project.id);
    expect(state?.registry.projects).toHaveLength(1);
    expect(state?.linkage).toBeNull();

    controller.dispose();
  });

  it("sanitizes legacy guest sample cache to the empty guest shell on initialize", async () => {
    const now = createClock();
    const storage = new MemoryStorage();
    seedLegacyGuestSampleCache(storage, now);

    const auth = new StubAuthBoundary(storage, "test");
    const controller = new WorkspacePersistenceController({
      auth,
      cloud: new FakeCloudPersistenceGateway(now),
      local: new LocalPersistenceStore(storage, "test"),
      now
    });

    await controller.initialize();

    const state = controller.getState()!;

    expect(state.session.mode).toBe("guest");
    expect(hasLegacySampleEpisodeTitles(state.snapshot)).toBe(false);
    expect(state.snapshot.episodes).toHaveLength(0);
    expect(state.snapshot.nodes).toHaveLength(0);
    expect(state.snapshot.temporaryDrawer).toHaveLength(0);

    controller.dispose();
  });

  it("boots authenticated state from the current account scope instead of guest local cache", async () => {
    const now = createClock();
    const sharedStorage = new MemoryStorage();
    const guestSeeder = new WorkspacePersistenceController({
      auth: new StubAuthBoundary(sharedStorage, "test"),
      cloud: new FakeCloudPersistenceGateway(now),
      local: new LocalPersistenceStore(sharedStorage, "test"),
      now
    });

    await guestSeeder.initialize();
    const guestSnapshot = cloneSnapshot(guestSeeder.getState()!.snapshot);
    guestSeeder.dispose();

    const remoteSeedController = new WorkspacePersistenceController({
      auth: new StubAuthBoundary(new MemoryStorage(), "remote-seed"),
      cloud: new FakeCloudPersistenceGateway(now),
      local: new LocalPersistenceStore(new MemoryStorage(), "remote-seed"),
      now
    });

    await remoteSeedController.initialize();
    const remoteSnapshot = cloneSnapshot(remoteSeedController.getState()!.snapshot);
    remoteSeedController.dispose();

    const auth = new ControlledAuthBoundary({
      accountId: "account-a",
      displayName: "Account A",
      mode: "authenticated"
    });
    const cloud = new SessionScopedCloudPersistenceGateway(now, () => auth.getCurrentAccountId());
    cloud.seedProject("account-a", remoteSnapshot, {
      cloudLinked: true,
      entityId: remoteSnapshot.project.id,
      lastImportedAt: now(),
      lastSyncedAt: now(),
      linkedAccountId: "account-a"
    });

    const controller = new WorkspacePersistenceController({
      auth,
      cloud,
      local: new LocalPersistenceStore(sharedStorage, "test"),
      now
    });

    await controller.initialize();

    const state = controller.getState()!;

    expect(state.session.mode).toBe("authenticated");
    expect(state.session.accountId).toBe("account-a");
    expect(state.snapshot.project.id).toBe(remoteSnapshot.project.id);
    expect(state.snapshot.project.id).not.toBe(guestSnapshot.project.id);
    expect(state.linkage?.linkedAccountId).toBe("account-a");
    expect(state.syncStatus).toBe("synced");

    controller.dispose();
  });

  it("keeps a newly authenticated account empty when cloud projects do not exist", async () => {
    const now = createClock();
    const storage = new MemoryStorage();
    const auth = new ControlledAuthBoundary({
      accountId: "account-empty",
      displayName: "Empty Account",
      mode: "authenticated"
    });
    const cloud = new SessionScopedCloudPersistenceGateway(now, () => auth.getCurrentAccountId());
    const controller = new WorkspacePersistenceController({
      auth,
      cloud,
      local: new LocalPersistenceStore(storage, "test"),
      now
    });

    await controller.initialize();

    const state = controller.getState()!;

    expect(state.session.mode).toBe("authenticated");
    expect(state.session.accountId).toBe("account-empty");
    expect(state.cloudProjectCount).toBe(0);
    expect(state.linkage).toBeNull();
    expect(state.snapshot.episodes).toHaveLength(0);
    expect(state.snapshot.nodes).toHaveLength(0);
    expect(state.snapshot.temporaryDrawer).toHaveLength(0);
    expect(state.syncStatus).toBe("authenticated-empty");
    expect(state.registry.activeProjectId).toBeNull();
    expect(state.registry.projects).toHaveLength(0);

    controller.dispose();
  });

  it("ignores stale authenticated local cache when cloud projects do not exist", async () => {
    const now = createClock();
    const storage = new MemoryStorage();
    const staleSnapshot = createSampleWorkspace(now());
    const staleLocal = new LocalPersistenceStore(storage, "test");

    staleLocal.setCacheScope("account:account-empty");
    staleLocal.saveSnapshot(staleSnapshot);
    staleLocal.saveRegistry({
      activeProjectId: staleSnapshot.project.id,
      projects: [
        {
          cloudLinked: false,
          lastOpenedAt: staleSnapshot.project.updatedAt,
          linkedAccountId: null,
          projectId: staleSnapshot.project.id,
          summary: staleSnapshot.project.summary,
          title: staleSnapshot.project.title,
          updatedAt: staleSnapshot.project.updatedAt
        }
      ]
    });

    const auth = new ControlledAuthBoundary({
      accountId: "account-empty",
      displayName: "Empty Account",
      mode: "authenticated"
    });
    const cloud = new SessionScopedCloudPersistenceGateway(now, () => auth.getCurrentAccountId());
    const controller = new WorkspacePersistenceController({
      auth,
      cloud,
      local: new LocalPersistenceStore(storage, "test"),
      now
    });

    await controller.initialize();

    const state = controller.getState()!;
    const cloudProjects = await cloud.listProjects();

    expect(state.session.mode).toBe("authenticated");
    expect(state.session.accountId).toBe("account-empty");
    expect(state.syncStatus).toBe("authenticated-empty");
    expect(state.registry.activeProjectId).toBeNull();
    expect(state.registry.projects).toHaveLength(0);
    expect(state.snapshot.project.id).not.toBe(staleSnapshot.project.id);
    expect(state.snapshot.episodes).toHaveLength(0);
    expect(state.snapshot.nodes).toHaveLength(0);
    expect(cloudProjects.projects).toHaveLength(0);

    controller.dispose();
  });

  it("creates the first authenticated project only after explicit empty-state action", async () => {
    const now = createClock();
    const storage = new MemoryStorage();
    const auth = new ControlledAuthBoundary({
      accountId: "account-empty",
      displayName: "Empty Account",
      mode: "authenticated"
    });
    const cloud = new SessionScopedCloudPersistenceGateway(now, () => auth.getCurrentAccountId());
    const controller = new WorkspacePersistenceController({
      auth,
      cloud,
      local: new LocalPersistenceStore(storage, "test"),
      now
    });

    await controller.initialize();
    const createdProjectId = await controller.createWorkspaceFromEmptyState();
    const state = controller.getState()!;
    const cloudProjects = await cloud.listProjects();

    expect(createdProjectId).toBeTruthy();
    expect(state.syncStatus).toBe("synced");
    expect(state.cloudProjectCount).toBe(1);
    expect(state.linkage?.cloudLinked).toBe(true);
    expect(state.linkage?.linkedAccountId).toBe("account-empty");
    expect(state.snapshot.project.id).toBe(createdProjectId);
    expect(state.snapshot.episodes).toHaveLength(1);
    expect(state.snapshot.nodes).toHaveLength(0);
    expect(cloudProjects.projects).toHaveLength(1);
    expect(cloudProjects.projects[0]?.projectId).toBe(createdProjectId);

    controller.dispose();
  });

  it("does not import guest local workspace when signing in to a new authenticated account", async () => {
    const now = createClock();
    const storage = new MemoryStorage();
    const auth = new ControlledAuthBoundary({
      accountId: null,
      displayName: "Guest Creator",
      mode: "guest"
    });
    const cloud = new SessionScopedCloudPersistenceGateway(now, () => auth.getCurrentAccountId());
    const controller = new WorkspacePersistenceController({
      auth,
      cloud,
      local: new LocalPersistenceStore(storage, "test"),
      now
    });

    await controller.initialize();
    await controller.createEpisode();

    expect(controller.getState()!.snapshot.episodes).toHaveLength(1);

    auth.setNextSignInSession({
      accountId: "account-new",
      displayName: "Account New",
      mode: "authenticated"
    });
    await controller.signIn();

    const state = controller.getState()!;
    const cloudProjects = await cloud.listProjects();

    expect(state.session.mode).toBe("authenticated");
    expect(state.session.accountId).toBe("account-new");
    expect(state.syncStatus).toBe("authenticated-empty");
    expect(state.linkage).toBeNull();
    expect(state.snapshot.episodes).toHaveLength(0);
    expect(state.snapshot.nodes).toHaveLength(0);
    expect(cloudProjects.projects).toHaveLength(0);

    controller.dispose();
  });

  it("ignores stale authenticated local cache when signing in to an empty cloud account", async () => {
    const now = createClock();
    const storage = new MemoryStorage();
    const staleSnapshot = createSampleWorkspace(now());
    const staleLocal = new LocalPersistenceStore(storage, "test");

    staleLocal.setCacheScope("account:account-new");
    staleLocal.saveSnapshot(staleSnapshot);
    staleLocal.saveRegistry({
      activeProjectId: staleSnapshot.project.id,
      projects: [
        {
          cloudLinked: false,
          lastOpenedAt: staleSnapshot.project.updatedAt,
          linkedAccountId: null,
          projectId: staleSnapshot.project.id,
          summary: staleSnapshot.project.summary,
          title: staleSnapshot.project.title,
          updatedAt: staleSnapshot.project.updatedAt
        }
      ]
    });

    const auth = new ControlledAuthBoundary({
      accountId: null,
      displayName: "Guest Creator",
      mode: "guest"
    });
    auth.setNextSignInSession({
      accountId: "account-new",
      displayName: "Account New",
      mode: "authenticated"
    });
    const cloud = new SessionScopedCloudPersistenceGateway(now, () => auth.getCurrentAccountId());
    const controller = new WorkspacePersistenceController({
      auth,
      cloud,
      local: new LocalPersistenceStore(storage, "test"),
      now
    });

    await controller.initialize();
    await controller.signIn();

    const state = controller.getState()!;
    const cloudProjects = await cloud.listProjects();

    expect(state.session.mode).toBe("authenticated");
    expect(state.session.accountId).toBe("account-new");
    expect(state.syncStatus).toBe("authenticated-empty");
    expect(state.registry.activeProjectId).toBeNull();
    expect(state.registry.projects).toHaveLength(0);
    expect(state.snapshot.project.id).not.toBe(staleSnapshot.project.id);
    expect(state.snapshot.episodes).toHaveLength(0);
    expect(state.snapshot.nodes).toHaveLength(0);
    expect(cloudProjects.projects).toHaveLength(0);

    controller.dispose();
  });

  it("removes guest sample cache on sign-out and keeps it removed after guest reinitialize", async () => {
    const now = createClock();
    const storage = new MemoryStorage();
    const auth = new ControlledAuthBoundary({
      accountId: null,
      displayName: "Guest Creator",
      mode: "guest"
    });
    const cloud = new SessionScopedCloudPersistenceGateway(now, () => auth.getCurrentAccountId());
    const controller = new WorkspacePersistenceController({
      auth,
      cloud,
      local: new LocalPersistenceStore(storage, "test"),
      now
    });

    await controller.initialize();
    expect(hasLegacySampleEpisodeTitles(controller.getState()!.snapshot)).toBe(false);

    auth.setNextSignInSession({
      accountId: "account-a",
      displayName: "Account A",
      mode: "authenticated"
    });
    await controller.signIn();
    seedLegacyGuestSampleCache(storage, now);
    await controller.signOut();

    const signedOutState = controller.getState()!;
    expect(signedOutState.session.mode).toBe("guest");
    expect(hasLegacySampleEpisodeTitles(signedOutState.snapshot)).toBe(false);

    controller.dispose();

    const guestAuth = new ControlledAuthBoundary({
      accountId: null,
      displayName: "Guest Creator",
      mode: "guest"
    });
    const reloadedController = new WorkspacePersistenceController({
      auth: guestAuth,
      cloud: new SessionScopedCloudPersistenceGateway(now, () => guestAuth.getCurrentAccountId()),
      local: new LocalPersistenceStore(storage, "test"),
      now
    });

    await reloadedController.initialize();

    const reloadedState = reloadedController.getState()!;
    expect(reloadedState.session.mode).toBe("guest");
    expect(hasLegacySampleEpisodeTitles(reloadedState.snapshot)).toBe(false);

    reloadedController.dispose();
  });

  it("replaces the visible authenticated snapshot with a fresh guest workspace on sign-out", async () => {
    const now = createClock();
    const storage = new MemoryStorage();
    const auth = new ControlledAuthBoundary({
      accountId: null,
      displayName: "Guest Creator",
      mode: "guest"
    });
    auth.setNextSignInSession({
      accountId: "account-a",
      displayName: "Account A",
      mode: "authenticated"
    });
    const cloud = new SessionScopedCloudPersistenceGateway(now, () => auth.getCurrentAccountId());
    const controller = new WorkspacePersistenceController({
      auth,
      cloud,
      local: new LocalPersistenceStore(storage, "test"),
      now
    });

    await controller.initialize();
    await controller.signIn();
    const authenticatedProjectId = controller.getState()!.snapshot.project.id;

    await controller.signOut();

    const state = controller.getState()!;

    expect(state.session.mode).toBe("guest");
    expect(state.syncStatus).toBe("guest-local");
    expect(state.snapshot.project.id).not.toBe(authenticatedProjectId);
    expect(state.linkage).toBeNull();

    controller.dispose();
  });

  it("does not carry the previous authenticated project across account switches", async () => {
    const now = createClock();
    const storage = new MemoryStorage();
    const auth = new ControlledAuthBoundary({
      accountId: null,
      displayName: "Guest Creator",
      mode: "guest"
    });
    const cloud = new SessionScopedCloudPersistenceGateway(now, () => auth.getCurrentAccountId());
    const controller = new WorkspacePersistenceController({
      auth,
      cloud,
      local: new LocalPersistenceStore(storage, "test"),
      now
    });

    await controller.initialize();

    auth.setNextSignInSession({
      accountId: "account-a",
      displayName: "Account A",
      mode: "authenticated"
    });
    await controller.signIn();
    const accountAProjectId = await controller.createWorkspaceFromEmptyState();

    await controller.signOut();

    auth.setNextSignInSession({
      accountId: "account-b",
      displayName: "Account B",
      mode: "authenticated"
    });
    await controller.signIn();

    const state = controller.getState()!;

    expect(state.session.mode).toBe("authenticated");
    expect(state.session.accountId).toBe("account-b");
    expect(state.syncStatus).toBe("authenticated-empty");
    expect(state.linkage).toBeNull();
    expect(state.snapshot.project.id).not.toBe(accountAProjectId);

    controller.dispose();
  });

  it("keeps sign-in empty by default, then syncs and recovers after explicit first project creation", async () => {
    const now = createClock();
    const storage = new MemoryStorage();
    const auth = new StubAuthBoundary(storage, "test");
    const cloud = new FakeCloudPersistenceGateway(now);
    const controller = new WorkspacePersistenceController({
      auth,
      cloud,
      flushDebounceMs: 0,
      local: new LocalPersistenceStore(storage, "test"),
      now
    });

    await controller.initialize();

    await controller.signIn();

    let state = controller.getState()!;

    expect(state.session.mode).toBe("authenticated");
    expect(state.syncStatus).toBe("authenticated-empty");
    expect(state.linkage).toBeNull();
    expect(state.cloudProjectCount).toBe(0);
    expect(state.snapshot.episodes).toHaveLength(0);

    const initialProjectId = await controller.createWorkspaceFromEmptyState();

    state = controller.getState()!;

    expect(initialProjectId).toBeTruthy();
    expect(state.linkage?.cloudLinked).toBe(true);
    expect(state.linkage?.linkedAccountId).toBe("demo-account");
    expect(state.cloudProjectCount).toBe(1);
    expect(state.snapshot.episodes).toHaveLength(1);

    await controller.addSampleNode();
    await controller.flushNow();

    state = controller.getState()!;

    expect(state.snapshot.nodes).toHaveLength(1);
    expect(state.syncStatus).toBe("synced");

    const remoteAfterSync = await cloud.getProject(initialProjectId!);

    expect(remoteAfterSync.snapshot?.nodes).toHaveLength(1);

    const recoveredSnapshot = cloneSnapshot(remoteAfterSync.snapshot!);

    recoveredSnapshot.temporaryDrawer.push({
      createdAt: now(),
      episodeId: recoveredSnapshot.project.activeEpisodeId,
      id: "temporary_drawer_recovered",
      label: "Recovered cloud beat",
      note: "Pulled back from canonical cloud persistence.",
      projectId: recoveredSnapshot.project.id,
      sourceNodeId: recoveredSnapshot.nodes.at(-1)?.id ?? null,
      updatedAt: now()
    });
    cloud.seedProject(recoveredSnapshot, remoteAfterSync.linkage!);

    await controller.recoverFromCloud();

    state = controller.getState()!;

    expect(state.snapshot.temporaryDrawer).toHaveLength(1);
    expect(state.snapshot.temporaryDrawer.at(-1)?.label).toBe("Recovered cloud beat");

    await controller.signOut();

    expect(controller.getState()?.session.mode).toBe("guest");

    controller.dispose();
  });

  it("keeps authenticated empty state visible when first project creation import fails", async () => {
    const now = createClock();
    const storage = new MemoryStorage();
    const auth = new StubAuthBoundary(storage, "test");
    const controller = new WorkspacePersistenceController({
      auth,
      cloud: new ImportFailureCloudPersistenceGateway(now),
      local: new LocalPersistenceStore(storage, "test"),
      now
    });

    await controller.initialize();

    await controller.signIn();
    await controller.createWorkspaceFromEmptyState();

    const state = controller.getState()!;

    expect(state.session.mode).toBe("authenticated");
    expect(state.syncStatus).toBe("error");
    expect(state.lastError).toBe("import_failed");
    expect(state.snapshot.episodes).toHaveLength(1);
    expect(state.snapshot.nodes).toHaveLength(0);
    expect(state.linkage).toBeNull();

    controller.dispose();
  });

  it("moves a parent subtree together and supports manual rewiring", async () => {
    const now = createClock();
    const storage = new MemoryStorage();
    const auth = new StubAuthBoundary(storage, "test");
    const controller = new WorkspacePersistenceController({
      auth,
      cloud: new FakeCloudPersistenceGateway(now),
      local: new LocalPersistenceStore(storage, "test"),
      now
    });

    await controller.initialize();

    await controller.createEpisode();
    const initialMajorId = (await controller.createNode("major", 0))!;
    const secondMajorId = (await controller.createNode("major", 1))!;
    const minorId = (await controller.createNode("minor", 1))!;
    const detailId = (await controller.createNode("detail", 2))!;

    let state = controller.getState()!;

    expect(state.snapshot.nodes.map((node) => node.id)).toEqual([
      initialMajorId,
      minorId,
      detailId,
      secondMajorId
    ]);
    expect(state.snapshot.nodes.find((node) => node.id === minorId)?.parentId).toBe(
      initialMajorId
    );
    expect(state.snapshot.nodes.find((node) => node.id === detailId)?.parentId).toBe(
      minorId
    );

    await controller.moveNode(initialMajorId, 4);

    state = controller.getState()!;

    expect(state.snapshot.nodes.map((node) => node.id)).toEqual([
      secondMajorId,
      initialMajorId,
      minorId,
      detailId
    ]);
    expect(state.snapshot.nodes.find((node) => node.id === minorId)?.parentId).toBe(
      initialMajorId
    );
    expect(state.snapshot.nodes.find((node) => node.id === detailId)?.parentId).toBe(
      minorId
    );

    await controller.rewireNode(minorId, secondMajorId);

    state = controller.getState()!;

    expect(state.snapshot.nodes.find((node) => node.id === minorId)?.parentId).toBe(
      secondMajorId
    );
    expect(state.snapshot.nodes.find((node) => node.id === detailId)?.parentId).toBe(
      minorId
    );

    await controller.rewireNode(detailId, secondMajorId);

    state = controller.getState()!;

    expect(state.snapshot.nodes.find((node) => node.id === detailId)?.parentId).toBe(
      secondMajorId
    );

    controller.dispose();
  });

  it("deletes only the selected parent and reconnects direct children", async () => {
    const now = createClock();
    const storage = new MemoryStorage();
    const auth = new StubAuthBoundary(storage, "test");
    const controller = new WorkspacePersistenceController({
      auth,
      cloud: new FakeCloudPersistenceGateway(now),
      local: new LocalPersistenceStore(storage, "test"),
      now
    });

    await controller.initialize();

    await controller.createEpisode();
    const majorAId = (await controller.createNode("major", 0))!;
    const minorId = (await controller.createNode("minor", 1))!;
    const detailId = (await controller.createNode("detail", 2))!;
    const majorBId = (await controller.createNode("major", 3))!;

    await controller.deleteNodeAndReconnectChildren(
      majorAId,
      new Map([[minorId, majorBId]])
    );

    const state = controller.getState()!;

    expect(state.snapshot.nodes.map((node) => node.id)).toEqual([
      minorId,
      detailId,
      majorBId
    ]);
    expect(state.snapshot.nodes.find((node) => node.id === majorAId)).toBeUndefined();
    expect(state.snapshot.nodes.find((node) => node.id === minorId)?.parentId).toBe(
      majorBId
    );
    expect(state.snapshot.nodes.find((node) => node.id === detailId)?.parentId).toBe(
      minorId
    );

    controller.dispose();
  });

  it("reconnects same-lane direct children to a valid upper-lane parent on delete", async () => {
    const now = createClock();
    const storage = new MemoryStorage();
    const auth = new StubAuthBoundary(storage, "test");
    const controller = new WorkspacePersistenceController({
      auth,
      cloud: new FakeCloudPersistenceGateway(now),
      local: new LocalPersistenceStore(storage, "test"),
      now
    });

    await controller.initialize();

    await controller.createEpisode();
    const majorAId = (await controller.createNode("major", 0))!;
    const majorBId = (await controller.createNode("major", 1))!;
    const minorAId = (await controller.createNode("minor", 1))!;
    const minorBId = (await controller.createNode("minor", 3))!;

    await controller.rewireNode(minorBId, minorAId);
    await controller.deleteNodeAndReconnectChildren(
      minorAId,
      new Map([[minorBId, majorBId]])
    );

    const state = controller.getState()!;

    expect(state.snapshot.nodes.find((node) => node.id === minorAId)).toBeUndefined();
    expect(state.snapshot.nodes.find((node) => node.id === minorBId)?.parentId).toBe(
      majorBId
    );
    expect(state.snapshot.nodes.find((node) => node.id === majorAId)?.parentId).toBeNull();

    controller.dispose();
  });

  it("keeps a rewired parent when the node is moved with preserved parent intent", async () => {
    const now = createClock();
    const storage = new MemoryStorage();
    const auth = new StubAuthBoundary(storage, "test");
    const controller = new WorkspacePersistenceController({
      auth,
      cloud: new FakeCloudPersistenceGateway(now),
      local: new LocalPersistenceStore(storage, "test"),
      now
    });

    await controller.initialize();

    await controller.createEpisode();
    await controller.createNode("major", 0);
    const secondMajorId = (await controller.createNode("major", 1))!;
    const minorId = (await controller.createNode("minor", 1))!;

    await controller.rewireNode(minorId, secondMajorId);

    let state = controller.getState()!;

    expect(state.snapshot.nodes.find((node) => node.id === minorId)?.parentId).toBe(
      secondMajorId
    );

    await controller.moveNode(minorId, 0, {
      preserveParent: true
    });

    state = controller.getState()!;
    expect(state.snapshot.nodes.find((node) => node.id === minorId)?.parentId).toBe(
      secondMajorId
    );

    controller.dispose();
  });

  it("stores freeform node placement coordinates for new and moved nodes", async () => {
    const now = createClock();
    const storage = new MemoryStorage();
    const auth = new StubAuthBoundary(storage, "test");
    const controller = new WorkspacePersistenceController({
      auth,
      cloud: new FakeCloudPersistenceGateway(now),
      local: new LocalPersistenceStore(storage, "test"),
      now
    });

    await controller.initialize();
    await controller.createEpisode();

    const nextNodeId = await controller.createNode("minor", 1, {
      canvasHeight: 132,
      canvasWidth: 284,
      canvasX: 452,
      canvasY: 244
    });

    expect(nextNodeId).toBeTruthy();

    await controller.updateNodePlacement(nextNodeId!, {
      canvasHeight: 176,
      canvasWidth: 312,
      canvasX: 516,
      canvasY: 308
    });

    const movedNode = controller.getState()!.snapshot.nodes.find((node) => node.id === nextNodeId);

    expect(movedNode?.canvasX).toBe(516);
    expect(movedNode?.canvasY).toBe(308);
    expect(movedNode?.canvasWidth).toBe(312);
    expect(movedNode?.canvasHeight).toBe(176);

    controller.dispose();
  });

  it("infers lane spacing when creating a node without an explicit placement", async () => {
    const now = createClock();
    const storage = new MemoryStorage();
    const auth = new StubAuthBoundary(storage, "test");
    const controller = new WorkspacePersistenceController({
      auth,
      cloud: new FakeCloudPersistenceGateway(now),
      local: new LocalPersistenceStore(storage, "test"),
      now
    });

    await controller.initialize();
    await controller.createEpisode();

    const minorA = await controller.createNode("minor", 1, {
      canvasX: 452,
      canvasY: 100
    });
    const minorB = await controller.createNode("minor", 2, {
      canvasX: 452,
      canvasY: 320
    });
    const inferredMinor = await controller.createNode("minor", Number.MAX_SAFE_INTEGER);
    const state = controller.getState()!;
    const inferredMinorNode = state.snapshot.nodes.find((node) => node.id === inferredMinor);

    expect(minorA).toBeTruthy();
    expect(minorB).toBeTruthy();
    expect(inferredMinorNode?.canvasY).toBe(430);

    controller.dispose();
  });

  it("does not move fixed nodes when placement updates are requested", async () => {
    const now = createClock();
    const storage = new MemoryStorage();
    const auth = new StubAuthBoundary(storage, "test");
    const controller = new WorkspacePersistenceController({
      auth,
      cloud: new FakeCloudPersistenceGateway(now),
      local: new LocalPersistenceStore(storage, "test"),
      now
    });

    await controller.initialize();

    await controller.createEpisode();
    const nodeId = (await controller.createNode("major", 0))!;
    const initialNode = controller.getState()!.snapshot.nodes.find((node) => node.id === nodeId)!;

    await controller.updateNodeVisualState(nodeId, {
      isFixed: true
    });
    await controller.updateNodePlacement(nodeId, {
      canvasHeight: 220,
      canvasWidth: 420,
      canvasX: (initialNode.canvasX ?? 0) + 140,
      canvasY: (initialNode.canvasY ?? 0) + 88
    });

    const fixedNode = controller.getState()!.snapshot.nodes.find((node) => node.id === nodeId);

    expect(fixedNode?.canvasX).toBe(initialNode.canvasX);
    expect(fixedNode?.canvasY).toBe(initialNode.canvasY);
    expect(fixedNode?.canvasWidth).toBe(initialNode.canvasWidth);
    expect(fixedNode?.canvasHeight).toBe(initialNode.canvasHeight);

    controller.dispose();
  });

  it("creates project objects, attaches them to nodes, and keeps drawer state separate", async () => {
    const now = createClock();
    const storage = new MemoryStorage();
    const auth = new StubAuthBoundary(storage, "test");
    const cloud = new FakeCloudPersistenceGateway(now);
    const controller = new WorkspacePersistenceController({
      auth,
      cloud,
      flushDebounceMs: 0,
      local: new LocalPersistenceStore(storage, "test"),
      now
    });

    await controller.initialize();
    await controller.signIn();
    await controller.createWorkspaceFromEmptyState();
    const nodeId = (await controller.createNode("major", 0))!;

    const initialDrawerCount = controller.getState()!.snapshot.temporaryDrawer.length;
    const objectId = await controller.createObject({
      category: "place",
      name: "Cafe Exit",
      summary: "A fallback location anchor for the confrontation beat."
    });

    expect(objectId).toBeTruthy();

    await controller.attachObjectToNode(nodeId, objectId!);
    await controller.updateObject(objectId!, {
      category: "place",
      name: "Cafe Exit",
      summary: "A stable location anchor for the confrontation beat."
    });
    await controller.flushNow();

    const state = controller.getState()!;

    expect(state.snapshot.objects).toHaveLength(1);
    expect(state.snapshot.nodes.find((node) => node.id === nodeId)?.objectIds).toContain(
      objectId
    );
    expect(state.snapshot.temporaryDrawer).toHaveLength(initialDrawerCount);

    const remoteSnapshot = await cloud.getProject(state.snapshot.project.id);

    expect(remoteSnapshot.snapshot?.objects.some((object) => object.id === objectId)).toBe(
      true
    );
    expect(
      remoteSnapshot.snapshot?.nodes.find((node) => node.id === nodeId)?.objectIds
    ).toContain(objectId);

    await controller.deleteObject(objectId!);
    await controller.flushNow();

    const deletedState = controller.getState()!;
    const remoteAfterDelete = await cloud.getProject(deletedState.snapshot.project.id);

    expect(deletedState.snapshot.objects).toHaveLength(0);
    expect(
      deletedState.snapshot.nodes.find((node) => node.id === nodeId)?.objectIds
    ).not.toContain(objectId);
    expect(
      remoteAfterDelete.snapshot?.objects.some((object) => object.id === objectId)
    ).toBe(false);

    controller.dispose();
  });

  it("sends subtree-only node upserts for authenticated reorder intent", async () => {
    const now = createClock();
    const storage = new MemoryStorage();
    const auth = new StubAuthBoundary(storage, "test");
    const cloud = new FakeCloudPersistenceGateway(now);
    const controller = new WorkspacePersistenceController({
      auth,
      cloud,
      flushDebounceMs: 0,
      local: new LocalPersistenceStore(storage, "test"),
      now
    });

    await controller.initialize();
    await controller.signIn();
    await controller.createWorkspaceFromEmptyState();

    const initialMajorId = (await controller.createNode("major", 0))!;
    const secondMajorId = (await controller.createNode("major", 1))!;
    const minorId = (await controller.createNode("minor", 1))!;
    const detailId = (await controller.createNode("detail", 2))!;

    await controller.flushNow();
    await controller.moveNode(initialMajorId, 4);
    await controller.flushNow();

    const state = controller.getState()!;
    const syncedOperations = cloud.getLastSyncOperations(
      state.snapshot.project.id
    );
    const syncedNodeUpserts = syncedOperations
      .filter((operation): operation is Extract<CloudSyncOperation, { action: "upsert"; kind: "node" }> => {
        return operation.action === "upsert" && operation.kind === "node";
      })
      .map((operation) => operation.payload.id);

    expect(state.snapshot.nodes.map((node) => node.id)).toEqual([
      secondMajorId,
      initialMajorId,
      minorId,
      detailId
    ]);
    expect(syncedNodeUpserts).toEqual([initialMajorId, minorId, detailId]);
    expect(syncedNodeUpserts).not.toContain(secondMajorId);

    controller.dispose();
  });

  it("flushes cloud-linked create mutations immediately for canonical sync adoption", async () => {
    const now = createClock();
    const storage = new MemoryStorage();
    const auth = new StubAuthBoundary(storage, "test");
    const cloud = new FakeCloudPersistenceGateway(now);
    const controller = new WorkspacePersistenceController({
      auth,
      cloud,
      flushDebounceMs: 5000,
      local: new LocalPersistenceStore(storage, "test"),
      now
    });

    await controller.initialize();
    await controller.signIn();
    await controller.createWorkspaceFromEmptyState();

    const projectId = controller.getState()!.snapshot.project.id;
    const createdNodeId = await controller.createNode("minor", 1, {
      canvasX: 452,
      canvasY: 244
    });
    const syncedOperations = cloud.getLastSyncOperations(projectId);
    const syncedNodeIds = syncedOperations
      .filter((operation): operation is Extract<CloudSyncOperation, { action: "upsert"; kind: "node" }> => {
        return operation.action === "upsert" && operation.kind === "node";
      })
      .map((operation) => operation.payload.id);

    expect(createdNodeId).toBeTruthy();
    expect(syncedNodeIds).toContain(createdNodeId);

    controller.dispose();
  });

  it("allows cross-episode object references and localizes them per episode on demand", async () => {
    const now = createClock();
    const storage = new MemoryStorage();
    const auth = new StubAuthBoundary(storage, "test");
    const controller = new WorkspacePersistenceController({
      auth,
      cloud: new FakeCloudPersistenceGateway(now),
      local: new LocalPersistenceStore(storage, "test"),
      now
    });

    await controller.initialize();

    const firstEpisodeId = await controller.createEpisode();
    const ownerObjectId = await controller.createObject({
      category: "place",
      name: "Shared alley",
      summary: "A neutral location used across episodes."
    });
    const ownerObject = controller
      .getState()!
      .snapshot.objects.find((object) => object.id === ownerObjectId)!;
    const secondEpisodeId = (await controller.createEpisode())!;

    await controller.selectEpisode(secondEpisodeId);
    const secondEpisodeNodeId = (await controller.createNode("major", 0))!;

    await controller.attachObjectToNode(secondEpisodeNodeId, ownerObject.id);

    let state = controller.getState()!;
    let secondEpisodeNode = state.snapshot.nodes.find((node) => node.id === secondEpisodeNodeId);

    expect(secondEpisodeNode?.episodeId).toBe(secondEpisodeId);
    expect(secondEpisodeNode?.objectIds).toContain(ownerObject.id);

    await controller.localizeObjectReferencesForEpisode(secondEpisodeId);

    state = controller.getState()!;
    secondEpisodeNode = state.snapshot.nodes.find((node) => node.id === secondEpisodeNodeId);
    const localizedObjectId = secondEpisodeNode?.objectIds[0] ?? null;
    const localizedObject =
      localizedObjectId !== null
        ? state.snapshot.objects.find((object) => object.id === localizedObjectId) ?? null
        : null;

    expect(localizedObjectId).not.toBe(ownerObject.id);
    expect(localizedObject?.episodeId).toBe(secondEpisodeId);
    expect(localizedObject?.name).toBe(ownerObject.name);
    expect(
      state.snapshot.objects.some(
        (object) => object.id === ownerObject.id && object.episodeId === firstEpisodeId
      )
    ).toBe(true);

    controller.dispose();
  });

  it("retries a failed sync without losing local state", async () => {
    const now = createClock();
    const storage = new MemoryStorage();
    const auth = new StubAuthBoundary(storage, "test");
    const cloud = new SyncFailureOnceCloudPersistenceGateway(now);
    const controller = new WorkspacePersistenceController({
      auth,
      cloud,
      flushDebounceMs: 0,
      local: new LocalPersistenceStore(storage, "test"),
      now
    });

    await controller.initialize();
    await controller.signIn();
    await controller.createWorkspaceFromEmptyState();
    await controller.addSampleNode();
    await controller.flushNow();

    let state = controller.getState()!;

    expect(state.snapshot.nodes).toHaveLength(1);
    expect(state.syncStatus).toBe("error");
    expect(state.lastError).toBe("transient_sync_failure");

    await controller.flushNow();

    state = controller.getState()!;

    expect(state.snapshot.nodes).toHaveLength(1);
    expect(state.syncStatus).toBe("synced");
    expect(state.lastError).toBeNull();

    const remoteSnapshot = await cloud.getProject(state.snapshot.project.id);

    expect(remoteSnapshot.snapshot?.nodes).toHaveLength(1);

    controller.dispose();
  });

  it("duplicates copied node trees and restores them through undo and redo", async () => {
    const now = createClock();
    const storage = new MemoryStorage();
    const auth = new StubAuthBoundary(storage, "test");
    const controller = new WorkspacePersistenceController({
      auth,
      cloud: new FakeCloudPersistenceGateway(now),
      local: new LocalPersistenceStore(storage, "test"),
      now
    });

    await controller.initialize();
    await controller.createEpisode();
    const copiedRootId = (await controller.createNode("major", 0))!;

    const initialState = controller.getState()!;
    const pastedRootId = await controller.pasteNodeTree(
      collectSubtreeNodes(initialState.snapshot.nodes, copiedRootId),
      copiedRootId,
      initialState.snapshot.nodes.length
    );

    let state = controller.getState()!;

    expect(pastedRootId).toBeTruthy();
    expect(state.snapshot.nodes).toHaveLength(2);
    expect(state.history.canUndo).toBe(true);
    expect(state.snapshot.nodes.some((node) => node.id === pastedRootId)).toBe(true);

    await controller.undo();

    state = controller.getState()!;

    expect(state.snapshot.nodes).toHaveLength(1);
    expect(state.history.canRedo).toBe(true);

    await controller.redo();

    state = controller.getState()!;

    expect(state.snapshot.nodes).toHaveLength(2);
    expect(state.snapshot.nodes.some((node) => node.id === pastedRootId)).toBe(true);

    controller.dispose();
  });

  it("persists node fold and visual markers through local mutations and sync", async () => {
    const now = createClock();
    const storage = new MemoryStorage();
    const auth = new StubAuthBoundary(storage, "test");
    const cloud = new FakeCloudPersistenceGateway(now);
    const controller = new WorkspacePersistenceController({
      auth,
      cloud,
      flushDebounceMs: 0,
      local: new LocalPersistenceStore(storage, "test"),
      now
    });

    await controller.initialize();
    await controller.signIn();
    await controller.createWorkspaceFromEmptyState();

    const majorId = (await controller.createNode("major", 0))!;
    const minorId = (await controller.createNode("minor", 1))!;

    await controller.updateNodeVisualState(majorId, {
      isCollapsed: true,
      isFixed: true,
      isImportant: true
    });
    await controller.updateNodeVisualState(minorId, {
      isFixed: true
    });
    await controller.flushNow();

    const state = controller.getState()!;
    const majorNode = state.snapshot.nodes.find((node) => node.id === majorId);
    const minorNode = state.snapshot.nodes.find((node) => node.id === minorId);
    const remoteSnapshot = await cloud.getProject(state.snapshot.project.id);

    expect(majorNode?.isCollapsed).toBe(true);
    expect(majorNode?.isImportant).toBe(true);
    expect(majorNode?.isFixed).toBe(true);
    expect(minorNode?.isFixed).toBe(true);
    expect(remoteSnapshot.snapshot?.nodes.find((node) => node.id === majorId)?.isCollapsed).toBe(
      true
    );

    controller.dispose();
  });

  it("creates, switches, renames, and deletes episodes without mixing canvas nodes", async () => {
    const now = createClock();
    const storage = new MemoryStorage();
    const auth = new StubAuthBoundary(storage, "test");
    const controller = new WorkspacePersistenceController({
      auth,
      cloud: new FakeCloudPersistenceGateway(now),
      local: new LocalPersistenceStore(storage, "test"),
      now
    });

    await controller.initialize();

    const initialEpisodeId = await controller.createEpisode();
    const initialNodeId = (await controller.createNode("major", 0))!;
    const nextEpisodeId = await controller.createEpisode();

    expect(nextEpisodeId).toBeTruthy();

    let state = controller.getState()!;

    expect(state.snapshot.project.activeEpisodeId).toBe(nextEpisodeId);
    expect(state.snapshot.episodes.some((episode) => episode.id === nextEpisodeId)).toBe(true);
    expect(state.snapshot.nodes.filter((node) => node.episodeId === nextEpisodeId)).toHaveLength(0);

    const nextNodeId = await controller.createNode("major", 0);

    expect(nextNodeId).toBeTruthy();

    state = controller.getState()!;

    expect(state.snapshot.nodes.filter((node) => node.episodeId === nextEpisodeId)).toHaveLength(1);
    expect(
      state.snapshot.nodes.filter((node) => node.episodeId === initialEpisodeId).map((node) => node.id)
    ).toEqual([initialNodeId]);

    await controller.renameEpisode(nextEpisodeId!, "ARIAD pilot");

    state = controller.getState()!;

    expect(state.snapshot.episodes.find((episode) => episode.id === nextEpisodeId)?.title).toBe(
      "ARIAD pilot"
    );

    await controller.selectEpisode(initialEpisodeId);

    state = controller.getState()!;

    expect(state.snapshot.project.activeEpisodeId).toBe(initialEpisodeId);
    expect(
      state.snapshot.nodes.filter((node) => node.episodeId === state.snapshot.project.activeEpisodeId)
    ).toHaveLength(1);

    const deleted = await controller.deleteEpisode(nextEpisodeId!);

    state = controller.getState()!;

    expect(deleted).toBe(true);
    expect(state.snapshot.episodes.some((episode) => episode.id === nextEpisodeId)).toBe(false);
    expect(state.snapshot.nodes.some((node) => node.episodeId === nextEpisodeId)).toBe(false);

    const deletedLastEpisode = await controller.deleteEpisode(initialEpisodeId);

    state = controller.getState()!;

    expect(deletedLastEpisode).toBe(true);
    expect(state.snapshot.project.activeEpisodeId).toBe("");
    expect(state.snapshot.episodes).toHaveLength(0);
    expect(state.snapshot.nodes.some((node) => node.episodeId === initialEpisodeId)).toBe(false);

    controller.dispose();
  });

  it("moves a subtree to the drawer and restores it without data loss", async () => {
    const now = createClock();
    const storage = new MemoryStorage();
    const auth = new StubAuthBoundary(storage, "test");
    const controller = new WorkspacePersistenceController({
      auth,
      cloud: new FakeCloudPersistenceGateway(now),
      local: new LocalPersistenceStore(storage, "test"),
      now
    });

    await controller.initialize();

    await controller.createEpisode();
    const majorId = (await controller.createNode("major", 0))!;
    const minorId = (await controller.createNode("minor", 1))!;

    await controller.updateNodeContent(majorId, {
      contentMode: "keywords",
      keywords: ["meeting", "pressure", "hesitation"],
      text: ""
    });
    await controller.updateNodeContent(minorId, {
      contentMode: "keywords",
      keywords: ["aftermath", "silence"],
      text: ""
    });
    await controller.moveNodeToDrawer(majorId);

    let state = controller.getState()!;
    const parkedItem = state.snapshot.temporaryDrawer.filter(
      (item) => item.sourceNodeId === majorId
    ).at(-1);

    expect(state.snapshot.nodes).toHaveLength(0);
    expect(parkedItem).toBeTruthy();

    await controller.restoreDrawerItem(parkedItem!.id, 0);

    state = controller.getState()!;

    expect(state.snapshot.temporaryDrawer).toHaveLength(0);
    expect(state.snapshot.nodes.map((node) => node.id)).toEqual([majorId, minorId]);
    expect(state.snapshot.nodes.find((node) => node.id === majorId)?.keywords).toEqual([
      "meeting",
      "pressure",
      "hesitation"
    ]);
    expect(state.snapshot.nodes.find((node) => node.id === minorId)?.keywords).toEqual([
      "aftermath",
      "silence"
    ]);
    expect(state.snapshot.nodes.find((node) => node.id === minorId)?.parentId).toBe(
      majorId
    );

    controller.dispose();
  });
});
