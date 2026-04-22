// ???뚯씪? ?곸냽???쇱슦?몄쓽 ?ъ젙???뚭? ?숈옉???듯빀 ?뚯뒪?몃줈 寃利앺빀?덈떎.
import { mkdtemp, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";

import { afterEach, beforeEach, describe, expect, it } from "vitest";
import type {
  CloudSyncOperation,
  ImportProjectRequest,
  SyncProjectRequest
} from "@scenaairo/shared";
import type { StoryWorkspaceSnapshot } from "@scenaairo/shared";

import { buildApp } from "../app.js";

// ?ъ젙???뚯뒪?몄슜 湲곕낯 ?ㅻ깄?룹쓣 ?앹꽦?⑸땲??
function createSnapshot(now: string): StoryWorkspaceSnapshot {
  return {
    episodes: [
      {
        createdAt: now,
        endpoint: "The heroine's mother orders the lead to leave.",
        id: "episode_alpha",
        objective: "Bridge the cafe meeting to the family confrontation.",
        projectId: "project_alpha",
        title: "Episode 12",
        updatedAt: now
      }
    ],
    nodes: [
      {
        contentMode: "keywords",
        createdAt: now,
        episodeId: "episode_alpha",
        id: "node_major_alpha",
        keywords: ["meeting", "suspicion"],
        level: "major",
        objectIds: [],
        orderIndex: 1,
        parentId: null,
        projectId: "project_alpha",
        text: "",
        updatedAt: now
      }
    ],
    objects: [],
    project: {
      activeEpisodeId: "episode_alpha",
      createdAt: now,
      id: "project_alpha",
      summary: "Reorder regression baseline.",
      title: "Cafe Confrontation",
      updatedAt: now
    },
    temporaryDrawer: []
  };
}

describe("persistence routes reorder integration", () => {
  let cloudDataDir: string;

  beforeEach(async () => {
    cloudDataDir = await mkdtemp(path.join(os.tmpdir(), "scenaairo-cloud-reorder-"));
  });

  afterEach(async () => {
    await rm(cloudDataDir, {
      force: true,
      recursive: true
    });
  });

  it("canonicalizes sparse major/minor/detail reorder payloads into contiguous order", async () => {
    const app = buildApp({ cloudDataDir });
    await app.ready();

    await app.inject({
      method: "POST",
      payload: {
        linkage: null,
        snapshot: createSnapshot("2026-04-22T00:00:00.000Z")
      } satisfies ImportProjectRequest,
      url: "/api/persistence/accounts/demo-account/import"
    });

    const operations: CloudSyncOperation[] = [
      {
        action: "upsert",
        kind: "node",
        payload: {
          contentMode: "text",
          createdAt: "2026-04-22T00:10:00.000Z",
          episodeId: "episode_alpha",
          id: "node_major_beta",
          keywords: [],
          level: "major",
          objectIds: [],
          orderIndex: 90,
          parentId: null,
          projectId: "project_alpha",
          text: "A second major beat lands later.",
          updatedAt: "2026-04-22T00:10:00.000Z"
        }
      },
      {
        action: "upsert",
        kind: "node",
        payload: {
          contentMode: "text",
          createdAt: "2026-04-22T00:11:00.000Z",
          episodeId: "episode_alpha",
          id: "node_minor_alpha",
          keywords: [],
          level: "minor",
          objectIds: [],
          orderIndex: 20,
          parentId: "node_major_alpha",
          projectId: "project_alpha",
          text: "The heroine notices the tension.",
          updatedAt: "2026-04-22T00:11:00.000Z"
        }
      },
      {
        action: "upsert",
        kind: "node",
        payload: {
          contentMode: "text",
          createdAt: "2026-04-22T00:12:00.000Z",
          episodeId: "episode_alpha",
          id: "node_minor_beta",
          keywords: [],
          level: "minor",
          objectIds: [],
          orderIndex: 20,
          parentId: "node_major_beta",
          projectId: "project_alpha",
          text: "A parallel minor beat shifts the blame.",
          updatedAt: "2026-04-22T00:12:00.000Z"
        }
      },
      {
        action: "upsert",
        kind: "node",
        payload: {
          contentMode: "text",
          createdAt: "2026-04-22T00:13:00.000Z",
          episodeId: "episode_alpha",
          id: "node_detail_alpha",
          keywords: [],
          level: "detail",
          objectIds: [],
          orderIndex: 30,
          parentId: "node_minor_alpha",
          projectId: "project_alpha",
          text: "She avoids eye contact for one beat.",
          updatedAt: "2026-04-22T00:13:00.000Z"
        }
      },
      {
        action: "upsert",
        kind: "node",
        payload: {
          contentMode: "text",
          createdAt: "2026-04-22T00:14:00.000Z",
          episodeId: "episode_alpha",
          id: "node_detail_beta",
          keywords: [],
          level: "detail",
          objectIds: [],
          orderIndex: 30,
          parentId: "node_minor_beta",
          projectId: "project_alpha",
          text: "A breath pause reframes the mood.",
          updatedAt: "2026-04-22T00:14:00.000Z"
        }
      }
    ];

    const syncResponse = await app.inject({
      method: "POST",
      payload: {
        operations
      } satisfies SyncProjectRequest,
      url: "/api/persistence/accounts/demo-account/projects/project_alpha/sync"
    });
    const getResponse = await app.inject({
      method: "GET",
      url: "/api/persistence/accounts/demo-account/projects/project_alpha"
    });

    expect(syncResponse.statusCode).toBe(200);
    expect(getResponse.statusCode).toBe(200);

    const syncedSnapshot = syncResponse.json().snapshot as StoryWorkspaceSnapshot;
    const persistedSnapshot = getResponse.json().snapshot as StoryWorkspaceSnapshot;
    const syncedNodes = [...syncedSnapshot.nodes].sort(
      (left, right) => left.orderIndex - right.orderIndex
    );
    const persistedNodes = [...persistedSnapshot.nodes].sort(
      (left, right) => left.orderIndex - right.orderIndex
    );

    expect(syncedNodes.map((node) => node.id)).toEqual([
      "node_major_alpha",
      "node_minor_alpha",
      "node_minor_beta",
      "node_detail_alpha",
      "node_detail_beta",
      "node_major_beta"
    ]);
    expect(syncedNodes.map((node) => node.orderIndex)).toEqual([1, 2, 3, 4, 5, 6]);
    expect(
      syncedNodes.find((node) => node.id === "node_detail_beta")?.parentId
    ).toBe("node_minor_beta");
    expect(persistedNodes.map((node) => node.orderIndex)).toEqual([1, 2, 3, 4, 5, 6]);

    await app.close();
  });

  it("rejects stale reorder updates when node revision timestamp does not advance", async () => {
    const app = buildApp({ cloudDataDir });
    await app.ready();

    await app.inject({
      method: "POST",
      payload: {
        linkage: null,
        snapshot: createSnapshot("2026-04-22T00:00:00.000Z")
      } satisfies ImportProjectRequest,
      url: "/api/persistence/accounts/demo-account/import"
    });

    const staleReorderPayload: CloudSyncOperation[] = [
      {
        action: "upsert",
        kind: "node",
        payload: {
          contentMode: "text",
          createdAt: "2026-04-22T00:00:00.000Z",
          episodeId: "episode_alpha",
          id: "node_major_alpha",
          keywords: [],
          level: "major",
          objectIds: [],
          orderIndex: 2,
          parentId: null,
          projectId: "project_alpha",
          text: "This stale reorder should be rejected.",
          updatedAt: "2026-04-22T00:00:00.000Z"
        }
      }
    ];

    const staleSyncResponse = await app.inject({
      method: "POST",
      payload: {
        operations: staleReorderPayload
      } satisfies SyncProjectRequest,
      url: "/api/persistence/accounts/demo-account/projects/project_alpha/sync"
    });
    const getResponse = await app.inject({
      method: "GET",
      url: "/api/persistence/accounts/demo-account/projects/project_alpha"
    });

    expect(staleSyncResponse.statusCode).toBe(409);
    expect(staleSyncResponse.json().message).toBe("stale_node_revision");

    const persistedSnapshot = getResponse.json().snapshot as StoryWorkspaceSnapshot;
    const majorNode = persistedSnapshot.nodes.find((node) => node.id === "node_major_alpha");

    expect(majorNode?.orderIndex).toBe(1);
    expect(majorNode?.text).toBe("");

    await app.close();
  });
});

