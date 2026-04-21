import { describe, expect, it } from "vitest";
import type {
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

interface StoredProjectRecord {
  linkage: ProjectLinkageMetadata;
  snapshot: StoryWorkspaceSnapshot;
}

class FakeCloudPersistenceGateway {
  private readonly accounts = new Map<string, Map<string, StoredProjectRecord>>();

  constructor(private readonly now: () => string) {}

  async getProject(accountId: string, projectId: string) {
    const project = this.accounts.get(accountId)?.get(projectId);

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
    accountId: string,
    payload: {
      linkage: ProjectLinkageMetadata | null;
      snapshot: StoryWorkspaceSnapshot;
    }
  ) {
    const account = this.ensureAccount(accountId);
    const projectId = payload.snapshot.project.id;
    const existing = account.get(projectId);

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

    account.set(projectId, {
      linkage,
      snapshot: cloneSnapshot(payload.snapshot)
    });

    return {
      created: true,
      linkage: { ...linkage },
      snapshot: cloneSnapshot(payload.snapshot)
    };
  }

  async listProjects(accountId: string) {
    const projects = [...(this.accounts.get(accountId)?.values() ?? [])].map(
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
    accountId: string,
    projectId: string,
    payload: {
      operations: CloudSyncOperation[];
    }
  ) {
    const account = this.ensureAccount(accountId);
    const current = account.get(projectId);

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

    account.set(projectId, {
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
    this.ensureAccount(accountId).set(snapshot.project.id, {
      linkage: { ...linkage },
      snapshot: cloneSnapshot(snapshot)
    });
  }

  private ensureAccount(accountId: string) {
    this.accounts.set(accountId, this.accounts.get(accountId) ?? new Map());
    return this.accounts.get(accountId)!;
  }
}

class ImportFailureCloudPersistenceGateway extends FakeCloudPersistenceGateway {
  override async importProject(
    _accountId: string,
    _payload: {
      linkage: ProjectLinkageMetadata | null;
      snapshot: StoryWorkspaceSnapshot;
    }
  ): Promise<ImportProjectResponse> {
    void _accountId;
    void _payload;
    throw new Error("import_failed");
  }
}

class SyncFailureOnceCloudPersistenceGateway extends FakeCloudPersistenceGateway {
  private shouldFailNextSync = true;

  override async syncProject(
    accountId: string,
    projectId: string,
    payload: {
      operations: CloudSyncOperation[];
    }
  ) {
    if (this.shouldFailNextSync) {
      this.shouldFailNextSync = false;
      throw new Error("transient_sync_failure");
    }

    return super.syncProject(accountId, projectId, payload);
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

describe("workspace persistence controller", () => {
  it("seeds a guest workspace with stable IDs and local registry metadata", async () => {
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
    expect(state?.snapshot.episodes[0]?.id).toMatch(/^episode_/);
    expect(state?.snapshot.objects[0]?.id).toMatch(/^object_/);
    expect(state?.snapshot.nodes[0]?.id).toMatch(/^node_/);
    expect(state?.snapshot.temporaryDrawer[0]?.id).toMatch(/^temporary_drawer_/);
    expect(state?.registry.activeProjectId).toBe(state?.snapshot.project.id);
    expect(state?.registry.projects).toHaveLength(1);
    expect(state?.linkage).toBeNull();

    controller.dispose();
  });

  it("imports on sign-in, syncs new nodes, and recovers from cloud state", async () => {
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

    const initialProjectId = controller.getState()!.snapshot.project.id;

    await controller.signIn();

    let state = controller.getState()!;

    expect(state.session.mode).toBe("authenticated");
    expect(state.linkage?.cloudLinked).toBe(true);
    expect(state.linkage?.linkedAccountId).toBe("demo-account");
    expect(state.cloudProjectCount).toBe(1);

    await controller.addSampleNode();
    await controller.flushNow();

    state = controller.getState()!;

    expect(state.snapshot.nodes).toHaveLength(2);
    expect(state.syncStatus).toBe("synced");

    const remoteAfterSync = await cloud.getProject("demo-account", initialProjectId);

    expect(remoteAfterSync.snapshot?.nodes).toHaveLength(2);

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
    cloud.seedProject("demo-account", recoveredSnapshot, remoteAfterSync.linkage!);

    await controller.recoverFromCloud();

    state = controller.getState()!;

    expect(state.snapshot.temporaryDrawer).toHaveLength(2);
    expect(state.snapshot.temporaryDrawer.at(-1)?.label).toBe("Recovered cloud beat");

    await controller.signOut();

    expect(controller.getState()?.session.mode).toBe("guest");

    controller.dispose();
  });

  it("keeps the local snapshot visible when sign-in import fails", async () => {
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

    const initialState = controller.getState()!;

    await controller.signIn();

    const state = controller.getState()!;

    expect(state.session.mode).toBe("authenticated");
    expect(state.syncStatus).toBe("error");
    expect(state.lastError).toBe("import_failed");
    expect(state.snapshot.project.id).toBe(initialState.snapshot.project.id);
    expect(state.snapshot.nodes).toHaveLength(initialState.snapshot.nodes.length);
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

    const initialMajorId = controller.getState()!.snapshot.nodes[0]!.id;
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

    const nextNodeId = await controller.createNode("minor", 1, {
      canvasX: 452,
      canvasY: 244
    });

    expect(nextNodeId).toBeTruthy();

    await controller.updateNodePlacement(nextNodeId!, {
      canvasX: 516,
      canvasY: 308
    });

    const movedNode = controller.getState()!.snapshot.nodes.find((node) => node.id === nextNodeId);

    expect(movedNode?.canvasX).toBe(516);
    expect(movedNode?.canvasY).toBe(308);

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

    const nodeId = controller.getState()!.snapshot.nodes[0]!.id;
    const initialNode = controller.getState()!.snapshot.nodes.find((node) => node.id === nodeId)!;

    await controller.updateNodeVisualState(nodeId, {
      isFixed: true
    });
    await controller.updateNodePlacement(nodeId, {
      canvasX: (initialNode.canvasX ?? 0) + 140,
      canvasY: (initialNode.canvasY ?? 0) + 88
    });

    const fixedNode = controller.getState()!.snapshot.nodes.find((node) => node.id === nodeId);

    expect(fixedNode?.canvasX).toBe(initialNode.canvasX);
    expect(fixedNode?.canvasY).toBe(initialNode.canvasY);

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

    const initialDrawerCount = controller.getState()!.snapshot.temporaryDrawer.length;
    const nodeId = controller.getState()!.snapshot.nodes[0]!.id;
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

    expect(state.snapshot.objects).toHaveLength(2);
    expect(state.snapshot.nodes.find((node) => node.id === nodeId)?.objectIds).toContain(
      objectId
    );
    expect(state.snapshot.temporaryDrawer).toHaveLength(initialDrawerCount);

    const remoteSnapshot = await cloud.getProject("demo-account", state.snapshot.project.id);

    expect(remoteSnapshot.snapshot?.objects.some((object) => object.id === objectId)).toBe(
      true
    );
    expect(
      remoteSnapshot.snapshot?.nodes.find((node) => node.id === nodeId)?.objectIds
    ).toContain(objectId);

    await controller.deleteObject(objectId!);
    await controller.flushNow();

    const deletedState = controller.getState()!;
    const remoteAfterDelete = await cloud.getProject(
      "demo-account",
      deletedState.snapshot.project.id
    );

    expect(deletedState.snapshot.objects).toHaveLength(1);
    expect(
      deletedState.snapshot.nodes.find((node) => node.id === nodeId)?.objectIds
    ).not.toContain(objectId);
    expect(
      remoteAfterDelete.snapshot?.objects.some((object) => object.id === objectId)
    ).toBe(false);

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

    const firstEpisodeId = controller.getState()!.snapshot.project.activeEpisodeId;
    const ownerObject = controller.getState()!.snapshot.objects[0]!;
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
    await controller.addSampleNode();
    await controller.flushNow();

    let state = controller.getState()!;

    expect(state.snapshot.nodes).toHaveLength(2);
    expect(state.syncStatus).toBe("error");
    expect(state.lastError).toBe("transient_sync_failure");

    await controller.flushNow();

    state = controller.getState()!;

    expect(state.snapshot.nodes).toHaveLength(2);
    expect(state.syncStatus).toBe("synced");
    expect(state.lastError).toBeNull();

    const remoteSnapshot = await cloud.getProject("demo-account", state.snapshot.project.id);

    expect(remoteSnapshot.snapshot?.nodes).toHaveLength(2);

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

    const initialState = controller.getState()!;
    const copiedRootId = initialState.snapshot.nodes[0]!.id;
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

    const majorId = controller.getState()!.snapshot.nodes[0]!.id;
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
    const remoteSnapshot = await cloud.getProject("demo-account", state.snapshot.project.id);

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

    const initialState = controller.getState()!;
    const initialEpisodeId = initialState.snapshot.project.activeEpisodeId;
    const initialNodeId = initialState.snapshot.nodes[0]!.id;
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

    const majorId = controller.getState()!.snapshot.nodes[0]!.id;
    const minorId = (await controller.createNode("minor", 1))!;

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

    expect(state.snapshot.temporaryDrawer).toHaveLength(1);
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
