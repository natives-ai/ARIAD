// ???뚯씪? ?뚰겕?ㅽ럹?댁뒪 ?몃뱶 ?ъ젙???뚭? ?숈옉???꾩슜 ?ㅼ쐞?몃줈 寃利앺빀?덈떎.
import { describe, expect, it } from "vitest";
import type {
  CloudSyncOperation,
  GlobalProjectRegistryEntry,
  ImportProjectResponse,
  ProjectLinkageMetadata,
  StoryNode,
  StoryWorkspaceSnapshot
} from "@scenaairo/shared";

import { StubAuthBoundary, type StorageLike } from "../auth/stubAuthBoundary";
import { WorkspacePersistenceController } from "./controller";
import { LocalPersistenceStore } from "./localStore";

// ?ㅻ깄??媛앹껜瑜??뚯뒪???덉쟾?섍쾶 源딆? 蹂듭궗?⑸땲??
function cloneSnapshot(snapshot: StoryWorkspaceSnapshot): StoryWorkspaceSnapshot {
  return JSON.parse(JSON.stringify(snapshot)) as StoryWorkspaceSnapshot;
}

// ?숈씪 ID ?뷀떚?곕? 移섑솚?섍굅??異붽??⑸땲??
function upsertById<T extends { id: string }>(items: T[], item: T) {
  return [...items.filter((entry) => entry.id !== item.id), item];
}

// ?숈씪 ID ?뷀떚?곕? ?쒓굅?⑸땲??
function removeById<T extends { id: string }>(items: T[], id: string) {
  return items.filter((entry) => entry.id !== id);
}

// ?뚯뒪?몄슜 硫붾え由??ㅽ넗由ъ?瑜??쒓났?⑸땲??
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

interface ReorderCloudOptions {
  failSyncCount?: number;
}

// ?ъ젙???뚭? ?뚯뒪?몄슜 ?몃찓紐⑤━ ?대씪?곕뱶 寃뚯씠?몄썾?대? ?쒓났?⑸땲??
class ReorderCloudPersistenceGateway {
  private readonly accounts = new Map<string, Map<string, StoredProjectRecord>>();
  private remainingSyncFailures: number;

  constructor(
    private readonly now: () => string,
    options: ReorderCloudOptions = {}
  ) {
    this.remainingSyncFailures = options.failSyncCount ?? 0;
  }

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
  ): Promise<ImportProjectResponse> {
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
    if (this.remainingSyncFailures > 0) {
      this.remainingSyncFailures -= 1;
      throw new Error("transient_sync_failure");
    }

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

  // 怨꾩젙蹂??꾨줈?앺듃 ??μ냼瑜?蹂댁옣?⑸땲??
  private ensureAccount(accountId: string) {
    this.accounts.set(accountId, this.accounts.get(accountId) ?? new Map());
    return this.accounts.get(accountId)!;
  }
}

interface ReorderFixture {
  controller: WorkspacePersistenceController;
  ids: {
    detailA: string;
    detailB: string;
    majorA: string;
    majorB: string;
    minorA: string;
    minorB: string;
  };
}

// ?뚯뒪?몄뿉???ъ궗?⑺븷 ?쒓퀎 ?⑥닔瑜??앹꽦?⑸땲??
function createClock() {
  let tick = 0;

  return () => {
    const seconds = String(tick).padStart(2, "0");
    tick += 1;
    return `2026-04-22T00:00:${seconds}.000Z`;
  };
}

// ?쒖꽦 ?먰뵾?뚮뱶 ?몃뱶瑜?orderIndex ?쒖꽌濡?諛섑솚?⑸땲??
function getActiveEpisodeNodes(controller: WorkspacePersistenceController) {
  const state = controller.getState()!;
  return [...state.snapshot.nodes]
    .filter((node) => node.episodeId === state.snapshot.project.activeEpisodeId)
    .sort((left, right) => left.orderIndex - right.orderIndex);
}

// ?쒖꽦 ?먰뵾?뚮뱶???몃뱶 ID ?쒖꽌瑜?媛꾨떒??異붿텧?⑸땲??
function getActiveEpisodeNodeIds(controller: WorkspacePersistenceController) {
  return getActiveEpisodeNodes(controller).map((node) => node.id);
}

// ?뱀젙 ?몃뱶瑜?議고쉶?⑸땲??
function getNodeById(controller: WorkspacePersistenceController, nodeId: string): StoryNode {
  const node = controller.getState()!.snapshot.nodes.find((entry) => entry.id === nodeId);

  if (!node) {
    throw new Error(`missing_node:${nodeId}`);
  }

  return node;
}

// major/minor/detail ?몃━瑜?媛뽰텣 ?ъ젙???뚯뒪???쎌뒪泥섎? ?앹꽦?⑸땲??
async function createReorderFixture(): Promise<ReorderFixture> {
  const now = createClock();
  const storage = new MemoryStorage();
  const auth = new StubAuthBoundary(storage, "reorder-suite");
  const controller = new WorkspacePersistenceController({
    auth,
    cloud: new ReorderCloudPersistenceGateway(now),
    local: new LocalPersistenceStore(storage, "reorder-suite"),
    now
  });

  await controller.initialize();

  const majorA = controller.getState()!.snapshot.nodes[0]!.id;
  const majorB = (await controller.createNode("major", 1))!;
  const minorA = (await controller.createNode("minor", 1))!;
  const detailA = (await controller.createNode("detail", 2))!;
  const minorB = (await controller.createNode("minor", 4))!;
  const detailB = (await controller.createNode("detail", 5))!;

  return {
    controller,
    ids: {
      detailA,
      detailB,
      majorA,
      majorB,
      minorA,
      minorB
    }
  };
}

describe("workspace persistence controller reorder regression", () => {
  it("reorders a major subtree as a single block", async () => {
    const fixture = await createReorderFixture();

    try {
      await fixture.controller.moveNode(fixture.ids.majorB, 0);

      expect(getActiveEpisodeNodeIds(fixture.controller)).toEqual([
        fixture.ids.majorB,
        fixture.ids.minorB,
        fixture.ids.detailB,
        fixture.ids.majorA,
        fixture.ids.minorA,
        fixture.ids.detailA
      ]);
      expect(getNodeById(fixture.controller, fixture.ids.majorB).parentId).toBeNull();
      expect(getNodeById(fixture.controller, fixture.ids.minorB).parentId).toBe(
        fixture.ids.majorB
      );
      expect(getNodeById(fixture.controller, fixture.ids.detailB).parentId).toBe(
        fixture.ids.minorB
      );
    } finally {
      fixture.controller.dispose();
    }
  });

  it("reorders a minor subtree and rewires the moved root to the nearest major", async () => {
    const fixture = await createReorderFixture();

    try {
      await fixture.controller.moveNode(fixture.ids.minorB, 1);

      expect(getActiveEpisodeNodeIds(fixture.controller)).toEqual([
        fixture.ids.majorA,
        fixture.ids.minorB,
        fixture.ids.detailB,
        fixture.ids.minorA,
        fixture.ids.detailA,
        fixture.ids.majorB
      ]);
      expect(getNodeById(fixture.controller, fixture.ids.minorB).parentId).toBe(
        fixture.ids.majorA
      );
      expect(getNodeById(fixture.controller, fixture.ids.detailB).parentId).toBe(
        fixture.ids.minorB
      );
    } finally {
      fixture.controller.dispose();
    }
  });

  it("reorders a detail node and rewires it to the nearest minor", async () => {
    const fixture = await createReorderFixture();

    try {
      await fixture.controller.moveNode(fixture.ids.detailB, 2);

      expect(getActiveEpisodeNodeIds(fixture.controller)).toEqual([
        fixture.ids.majorA,
        fixture.ids.minorA,
        fixture.ids.detailB,
        fixture.ids.detailA,
        fixture.ids.majorB,
        fixture.ids.minorB
      ]);
      expect(getNodeById(fixture.controller, fixture.ids.detailB).parentId).toBe(
        fixture.ids.minorA
      );
    } finally {
      fixture.controller.dispose();
    }
  });

  it("restores and reapplies reorder state through undo and redo", async () => {
    const fixture = await createReorderFixture();

    try {
      const initialOrder = getActiveEpisodeNodeIds(fixture.controller);

      await fixture.controller.moveNode(fixture.ids.majorB, 0);

      const movedOrder = getActiveEpisodeNodeIds(fixture.controller);

      expect(movedOrder).toEqual([
        fixture.ids.majorB,
        fixture.ids.minorB,
        fixture.ids.detailB,
        fixture.ids.majorA,
        fixture.ids.minorA,
        fixture.ids.detailA
      ]);

      await fixture.controller.undo();
      expect(getActiveEpisodeNodeIds(fixture.controller)).toEqual(initialOrder);

      await fixture.controller.redo();
      expect(getActiveEpisodeNodeIds(fixture.controller)).toEqual(movedOrder);
    } finally {
      fixture.controller.dispose();
    }
  });

  it("restores pending queue and replays reorder operations after restart", async () => {
    const now = createClock();
    const storage = new MemoryStorage();
    const auth = new StubAuthBoundary(storage, "reorder-replay");
    const cloud = new ReorderCloudPersistenceGateway(now, {
      failSyncCount: 1
    });
    const localOne = new LocalPersistenceStore(storage, "reorder-replay");
    const controllerOne = new WorkspacePersistenceController({
      auth,
      cloud,
      flushDebounceMs: 0,
      local: localOne,
      now
    });

    await controllerOne.initialize();
    await controllerOne.signIn();

    const majorA = controllerOne.getState()!.snapshot.nodes[0]!.id;
    const majorB = (await controllerOne.createNode("major", 1))!;

    await controllerOne.moveNode(majorB, 0);
    await controllerOne.flushNow();

    expect(controllerOne.getState()!.syncStatus).toBe("error");
    expect(localOne.getPendingSyncOperations().length).toBeGreaterThan(0);

    controllerOne.dispose();

    const localTwo = new LocalPersistenceStore(storage, "reorder-replay");
    const controllerTwo = new WorkspacePersistenceController({
      auth,
      cloud,
      flushDebounceMs: 0,
      local: localTwo,
      now
    });

    try {
      await controllerTwo.initialize();

      const state = controllerTwo.getState()!;
      const remote = await cloud.getProject("demo-account", state.snapshot.project.id);
      const remoteNodeIds = [...(remote.snapshot?.nodes ?? [])]
        .filter((node) => node.episodeId === state.snapshot.project.activeEpisodeId)
        .sort((left, right) => left.orderIndex - right.orderIndex)
        .map((node) => node.id);

      expect(state.session.mode).toBe("authenticated");
      expect(state.syncStatus).toBe("synced");
      expect(remoteNodeIds).toEqual([majorB, majorA]);
      expect(localTwo.getPendingSyncOperations()).toHaveLength(0);
    } finally {
      controllerTwo.dispose();
    }
  });
});

