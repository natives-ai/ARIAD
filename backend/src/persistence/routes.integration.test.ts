// 이 파일은 퍼시스턴스 라우트의 통합 동작을 검증합니다.
import { mkdtemp, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";

import { afterEach, beforeEach, describe, expect, it } from "vitest";
import type {
  CloudSyncOperation,
  ImportProjectRequest,
  SyncProjectRequest
} from "@scenaairo/shared";
import type {
  StoryWorkspaceSnapshot
} from "@scenaairo/shared";

import { buildApp } from "../app.js";

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
        id: "node_alpha",
        keywords: ["meeting", "suspicion"],
        level: "major",
        objectIds: ["object_alpha"],
        orderIndex: 1,
        parentId: null,
        projectId: "project_alpha",
        text: "",
        updatedAt: now
      }
    ],
    objects: [
      {
        category: "person",
        createdAt: now,
        episodeId: "episode_alpha",
        id: "object_alpha",
        name: "Her Mother's Warning",
        projectId: "project_alpha",
        summary: "A steady authority figure who raises the stakes.",
        updatedAt: now
      }
    ],
    project: {
      activeEpisodeId: "episode_alpha",
      createdAt: now,
      id: "project_alpha",
      summary: "A serialization workspace focused on episode structure.",
      title: "Cafe Confrontation",
      updatedAt: now
    },
    temporaryDrawer: [
      {
        createdAt: now,
        episodeId: "episode_alpha",
        id: "drawer_alpha",
        label: "Unused accusation beat",
        note: "Keep this in reserve for a sharper second half.",
        projectId: "project_alpha",
        sourceNodeId: "node_alpha",
        updatedAt: now
      }
    ]
  };
}

describe("persistence routes integration", () => {
  let cloudDataDir: string;

  beforeEach(async () => {
    cloudDataDir = await mkdtemp(path.join(os.tmpdir(), "scenaairo-cloud-"));
  });

  afterEach(async () => {
    await rm(cloudDataDir, {
      force: true,
      recursive: true
    });
  });

  it("imports a guest project once and reconnects without duplication", async () => {
    const app = buildApp({ cloudDataDir });
    await app.ready();

    const requestBody: ImportProjectRequest = {
      linkage: null,
      snapshot: createSnapshot("2026-04-15T00:00:00.000Z")
    };

    const firstImport = await app.inject({
      method: "POST",
      payload: requestBody,
      url: "/api/persistence/accounts/demo-account/import"
    });
    const secondImport = await app.inject({
      method: "POST",
      payload: requestBody,
      url: "/api/persistence/accounts/demo-account/import"
    });
    const listProjects = await app.inject({
      method: "GET",
      url: "/api/persistence/accounts/demo-account/projects"
    });

    expect(firstImport.statusCode).toBe(200);
    expect(firstImport.json().created).toBe(true);
    expect(firstImport.headers.deprecation).toBe("true");
    expect(secondImport.statusCode).toBe(200);
    expect(secondImport.json().created).toBe(false);
    expect(secondImport.headers.deprecation).toBe("true");
    expect(listProjects.headers.deprecation).toBe("true");
    expect(listProjects.json().projects).toHaveLength(1);

    await app.close();
  });

  it("applies ordered sync operations and returns canonical project state", async () => {
    const app = buildApp({ cloudDataDir });
    await app.ready();

    await app.inject({
      method: "POST",
      payload: {
        linkage: null,
        snapshot: createSnapshot("2026-04-15T00:00:00.000Z")
      } satisfies ImportProjectRequest,
      url: "/api/persistence/accounts/demo-account/import"
    });

    const operations: CloudSyncOperation[] = [
      {
        action: "upsert",
        kind: "object",
        payload: {
          category: "place",
          createdAt: "2026-04-15T00:10:00.000Z",
          episodeId: "episode_alpha",
          id: "object_beta",
          name: "Cafe Exit",
          projectId: "project_alpha",
          summary: "A location cue for the walk-out beat.",
          updatedAt: "2026-04-15T00:10:00.000Z"
        }
      },
      {
        action: "upsert",
        kind: "node",
        payload: {
          contentMode: "text",
          createdAt: "2026-04-15T00:11:00.000Z",
          episodeId: "episode_alpha",
          id: "node_beta",
          keywords: [],
          level: "minor",
          objectIds: ["object_beta"],
          orderIndex: 2,
          parentId: "node_alpha",
          projectId: "project_alpha",
          text: "The lead follows her outside before the ultimatum lands.",
          updatedAt: "2026-04-15T00:11:00.000Z"
        }
      },
      {
        action: "upsert",
        kind: "temporary_drawer",
        payload: {
          createdAt: "2026-04-15T00:12:00.000Z",
          episodeId: "episode_alpha",
          id: "drawer_beta",
          label: "Alternative exit line",
          note: "Could be used if the confrontation needs one more beat.",
          projectId: "project_alpha",
          sourceNodeId: "node_beta",
          updatedAt: "2026-04-15T00:12:00.000Z"
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
    expect(syncResponse.json().snapshot.nodes).toHaveLength(2);
    expect(syncResponse.json().snapshot.temporaryDrawer).toHaveLength(2);
    expect(getResponse.statusCode).toBe(200);
    expect(getResponse.json().snapshot.objects).toHaveLength(2);
    expect(getResponse.json().linkage.lastSyncedAt).toBeTruthy();

    await app.close();
  });

  it("canonicalizes node order per episode when sync payload order is sparse or duplicated", async () => {
    const app = buildApp({ cloudDataDir });
    await app.ready();

    await app.inject({
      method: "POST",
      payload: {
        linkage: null,
        snapshot: createSnapshot("2026-04-15T00:00:00.000Z")
      } satisfies ImportProjectRequest,
      url: "/api/persistence/accounts/demo-account/import"
    });

    const operations: CloudSyncOperation[] = [
      {
        action: "upsert",
        kind: "episode",
        payload: {
          createdAt: "2026-04-15T01:00:00.000Z",
          endpoint: "The episode closes with an unresolved warning.",
          id: "episode_beta",
          objective: "Lay out the immediate aftermath of the ultimatum.",
          projectId: "project_alpha",
          title: "Episode 13",
          updatedAt: "2026-04-15T01:00:00.000Z"
        }
      },
      {
        action: "upsert",
        kind: "node",
        payload: {
          contentMode: "text",
          createdAt: "2026-04-15T01:10:00.000Z",
          episodeId: "episode_alpha",
          id: "node_beta",
          keywords: [],
          level: "minor",
          objectIds: [],
          orderIndex: 99,
          parentId: "node_alpha",
          projectId: "project_alpha",
          text: "The lead hesitates before replying.",
          updatedAt: "2026-04-15T01:10:00.000Z"
        }
      },
      {
        action: "upsert",
        kind: "node",
        payload: {
          contentMode: "text",
          createdAt: "2026-04-15T01:20:00.000Z",
          episodeId: "episode_alpha",
          id: "node_gamma",
          keywords: [],
          level: "minor",
          objectIds: [],
          orderIndex: 99,
          parentId: "node_alpha",
          projectId: "project_alpha",
          text: "A second beat keeps the tension unresolved.",
          updatedAt: "2026-04-15T01:20:00.000Z"
        }
      },
      {
        action: "upsert",
        kind: "node",
        payload: {
          contentMode: "text",
          createdAt: "2026-04-15T01:30:00.000Z",
          episodeId: "episode_beta",
          id: "node_delta",
          keywords: [],
          level: "major",
          objectIds: [],
          orderIndex: 500,
          parentId: null,
          projectId: "project_alpha",
          text: "The next episode opens with silent fallout.",
          updatedAt: "2026-04-15T01:30:00.000Z"
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
    const syncedEpisodeAlphaNodes = syncedSnapshot.nodes
      .filter((node) => node.episodeId === "episode_alpha")
      .sort((left, right) => left.orderIndex - right.orderIndex);
    const syncedEpisodeBetaNodes = syncedSnapshot.nodes
      .filter((node) => node.episodeId === "episode_beta")
      .sort((left, right) => left.orderIndex - right.orderIndex);
    const persistedEpisodeAlphaNodes = persistedSnapshot.nodes
      .filter((node) => node.episodeId === "episode_alpha")
      .sort((left, right) => left.orderIndex - right.orderIndex);
    const persistedEpisodeBetaNodes = persistedSnapshot.nodes
      .filter((node) => node.episodeId === "episode_beta")
      .sort((left, right) => left.orderIndex - right.orderIndex);

    expect(syncedEpisodeAlphaNodes.map((node) => node.id)).toEqual([
      "node_alpha",
      "node_beta",
      "node_gamma"
    ]);
    expect(syncedEpisodeAlphaNodes.map((node) => node.orderIndex)).toEqual([1, 2, 3]);
    expect(syncedEpisodeBetaNodes.map((node) => node.id)).toEqual(["node_delta"]);
    expect(syncedEpisodeBetaNodes.map((node) => node.orderIndex)).toEqual([1]);
    expect(persistedEpisodeAlphaNodes.map((node) => node.orderIndex)).toEqual([1, 2, 3]);
    expect(persistedEpisodeBetaNodes.map((node) => node.orderIndex)).toEqual([1]);

    await app.close();
  });

  it("preserves node canvas and visual fields when canonical order is recomputed", async () => {
    const app = buildApp({ cloudDataDir });
    await app.ready();

    const snapshot = createSnapshot("2026-04-15T00:00:00.000Z");
    const anchoredSnapshot: StoryWorkspaceSnapshot = {
      ...snapshot,
      nodes: [
        {
          ...snapshot.nodes[0]!,
          canvasX: 180,
          canvasY: 96,
          canvasHeight: 188,
          canvasWidth: 304,
          isCollapsed: false,
          isFixed: true,
          isImportant: true,
          orderIndex: 50
        }
      ]
    };

    await app.inject({
      method: "POST",
      payload: {
        linkage: null,
        snapshot: anchoredSnapshot
      } satisfies ImportProjectRequest,
      url: "/api/persistence/accounts/demo-account/import"
    });

    const syncResponse = await app.inject({
      method: "POST",
      payload: {
        operations: [
          {
            action: "upsert",
            kind: "node",
            payload: {
              canvasX: 420,
              canvasY: 244,
              canvasHeight: 144,
              canvasWidth: 292,
              contentMode: "text",
              createdAt: "2026-04-15T04:00:00.000Z",
              episodeId: "episode_alpha",
              id: "node_beta",
              isCollapsed: true,
              isFixed: false,
              isImportant: false,
              keywords: [],
              level: "minor",
              objectIds: [],
              orderIndex: 50,
              parentId: "node_alpha",
              projectId: "project_alpha",
              text: "A second node that triggers canonical reindexing.",
              updatedAt: "2026-04-15T04:00:00.000Z"
            }
          }
        ] satisfies CloudSyncOperation[]
      } satisfies SyncProjectRequest,
      url: "/api/persistence/accounts/demo-account/projects/project_alpha/sync"
    });
    const getResponse = await app.inject({
      method: "GET",
      url: "/api/persistence/accounts/demo-account/projects/project_alpha"
    });

    expect(syncResponse.statusCode).toBe(200);
    expect(getResponse.statusCode).toBe(200);

    const persistedSnapshot = getResponse.json().snapshot as StoryWorkspaceSnapshot;
    const nodeAlpha = persistedSnapshot.nodes.find((node) => node.id === "node_alpha");
    const nodeBeta = persistedSnapshot.nodes.find((node) => node.id === "node_beta");

    expect(nodeAlpha?.orderIndex).toBe(1);
    expect(nodeBeta?.orderIndex).toBe(2);

    expect(nodeAlpha?.canvasX).toBe(180);
    expect(nodeAlpha?.canvasY).toBe(96);
    expect(nodeAlpha?.canvasWidth).toBe(304);
    expect(nodeAlpha?.canvasHeight).toBe(188);
    expect(nodeAlpha?.isFixed).toBe(true);
    expect(nodeAlpha?.isImportant).toBe(true);
    expect(nodeAlpha?.isCollapsed).toBe(false);

    expect(nodeBeta?.canvasX).toBe(420);
    expect(nodeBeta?.canvasY).toBe(244);
    expect(nodeBeta?.canvasWidth).toBe(292);
    expect(nodeBeta?.canvasHeight).toBe(144);
    expect(nodeBeta?.isFixed).toBe(false);
    expect(nodeBeta?.isImportant).toBe(false);
    expect(nodeBeta?.isCollapsed).toBe(true);

    await app.close();
  });

  it("rejects cross-episode parent linkage with validation error", async () => {
    const app = buildApp({ cloudDataDir });
    await app.ready();

    await app.inject({
      method: "POST",
      payload: {
        linkage: null,
        snapshot: createSnapshot("2026-04-15T00:00:00.000Z")
      } satisfies ImportProjectRequest,
      url: "/api/persistence/accounts/demo-account/import"
    });

    const response = await app.inject({
      method: "POST",
      payload: {
        operations: [
          {
            action: "upsert",
            kind: "episode",
            payload: {
              createdAt: "2026-04-15T02:00:00.000Z",
              endpoint: "Follow the branch where emotions cool down.",
              id: "episode_beta",
              objective: "Prepare the next conflict beat.",
              projectId: "project_alpha",
              title: "Episode 13",
              updatedAt: "2026-04-15T02:00:00.000Z"
            }
          },
          {
            action: "upsert",
            kind: "node",
            payload: {
              contentMode: "text",
              createdAt: "2026-04-15T02:01:00.000Z",
              episodeId: "episode_beta",
              id: "node_beta",
              keywords: [],
              level: "major",
              objectIds: [],
              orderIndex: 1,
              parentId: null,
              projectId: "project_alpha",
              text: "A new major beat in another episode.",
              updatedAt: "2026-04-15T02:01:00.000Z"
            }
          },
          {
            action: "upsert",
            kind: "node",
            payload: {
              contentMode: "text",
              createdAt: "2026-04-15T02:02:00.000Z",
              episodeId: "episode_alpha",
              id: "node_cross",
              keywords: [],
              level: "minor",
              objectIds: [],
              orderIndex: 2,
              parentId: "node_beta",
              projectId: "project_alpha",
              text: "This should not attach across episode boundaries.",
              updatedAt: "2026-04-15T02:02:00.000Z"
            }
          }
        ] satisfies CloudSyncOperation[]
      } satisfies SyncProjectRequest,
      url: "/api/persistence/accounts/demo-account/projects/project_alpha/sync"
    });

    expect(response.statusCode).toBe(422);
    expect(response.json().message).toBe("parent_episode_mismatch");

    await app.close();
  });

  it("rejects subtree move attempts that break parent-level integrity", async () => {
    const app = buildApp({ cloudDataDir });
    await app.ready();

    await app.inject({
      method: "POST",
      payload: {
        linkage: null,
        snapshot: createSnapshot("2026-04-15T00:00:00.000Z")
      } satisfies ImportProjectRequest,
      url: "/api/persistence/accounts/demo-account/import"
    });

    const response = await app.inject({
      method: "POST",
      payload: {
        operations: [
          {
            action: "upsert",
            kind: "node",
            payload: {
              contentMode: "text",
              createdAt: "2026-04-15T03:00:00.000Z",
              episodeId: "episode_alpha",
              id: "node_beta",
              keywords: [],
              level: "minor",
              objectIds: [],
              orderIndex: 2,
              parentId: "node_alpha",
              projectId: "project_alpha",
              text: "A child node under the major beat.",
              updatedAt: "2026-04-15T03:00:00.000Z"
            }
          },
          {
            action: "upsert",
            kind: "node",
            payload: {
              contentMode: "text",
              createdAt: "2026-04-15T03:01:00.000Z",
              episodeId: "episode_alpha",
              id: "node_gamma",
              keywords: [],
              level: "detail",
              objectIds: [],
              orderIndex: 3,
              parentId: "node_beta",
              projectId: "project_alpha",
              text: "A detail node under the minor beat.",
              updatedAt: "2026-04-15T03:01:00.000Z"
            }
          },
          {
            action: "upsert",
            kind: "node",
            payload: {
              contentMode: "text",
              createdAt: "2026-04-15T03:00:00.000Z",
              episodeId: "episode_alpha",
              id: "node_beta",
              keywords: [],
              level: "minor",
              objectIds: [],
              orderIndex: 2,
              parentId: "node_gamma",
              projectId: "project_alpha",
              text: "This minor node now points to its own descendant.",
              updatedAt: "2026-04-15T03:02:00.000Z"
            }
          }
        ] satisfies CloudSyncOperation[]
      } satisfies SyncProjectRequest,
      url: "/api/persistence/accounts/demo-account/projects/project_alpha/sync"
    });

    expect(response.statusCode).toBe(422);
    expect(response.json().message).toBe("invalid_parent_level");

    await app.close();
  });

  it("rejects stale node revisions with conflict status", async () => {
    const app = buildApp({ cloudDataDir });
    await app.ready();

    await app.inject({
      method: "POST",
      payload: {
        linkage: null,
        snapshot: createSnapshot("2026-04-15T00:00:00.000Z")
      } satisfies ImportProjectRequest,
      url: "/api/persistence/accounts/demo-account/import"
    });

    const response = await app.inject({
      method: "POST",
      payload: {
        operations: [
          {
            action: "upsert",
            kind: "node",
            payload: {
              contentMode: "text",
              createdAt: "2026-04-15T00:00:00.000Z",
              episodeId: "episode_alpha",
              id: "node_alpha",
              keywords: ["meeting", "suspicion"],
              level: "major",
              objectIds: ["object_alpha"],
              orderIndex: 1,
              parentId: null,
              projectId: "project_alpha",
              text: "This stale update should be rejected.",
              updatedAt: "2026-04-14T23:59:59.000Z"
            }
          }
        ] satisfies CloudSyncOperation[]
      } satisfies SyncProjectRequest,
      url: "/api/persistence/accounts/demo-account/projects/project_alpha/sync"
    });

    expect(response.statusCode).toBe(409);
    expect(response.json().message).toBe("stale_node_revision");

    await app.close();
  });
});

