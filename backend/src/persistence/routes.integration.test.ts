import { mkdtemp, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";

import { afterEach, beforeEach, describe, expect, it } from "vitest";
import type {
  CloudSyncOperation,
  ImportProjectRequest,
  SyncProjectRequest
} from "@ariad/shared";
import type {
  StoryWorkspaceSnapshot
} from "@ariad/shared";

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
    cloudDataDir = await mkdtemp(path.join(os.tmpdir(), "ARIAD-cloud-"));
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
    expect(secondImport.statusCode).toBe(200);
    expect(secondImport.json().created).toBe(false);
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
});
