import { describe, expect, it, vi } from "vitest";
import type {
  CloudSyncOperation,
  ProjectLinkageMetadata,
  StoryWorkspaceSnapshot
} from "@ariad/shared";

import { PersistenceFlushQueue, sortCloudOperations } from "./flushQueue";

function createSnapshot(): StoryWorkspaceSnapshot {
  return {
    episodes: [
      {
        createdAt: "2026-04-15T00:00:00.000Z",
        endpoint: "The mother forces the lead away.",
        id: "episode_alpha",
        objective: "Bridge the cafe scene to the ultimatum.",
        projectId: "project_alpha",
        title: "Episode 12",
        updatedAt: "2026-04-15T00:00:00.000Z"
      }
    ],
    nodes: [],
    objects: [],
    project: {
      activeEpisodeId: "episode_alpha",
      createdAt: "2026-04-15T00:00:00.000Z",
      id: "project_alpha",
      summary: "Persistence queue baseline.",
      title: "Queue Baseline",
      updatedAt: "2026-04-15T00:00:00.000Z"
    },
    temporaryDrawer: []
  };
}

describe("persistence flush queue", () => {
  it("prioritizes dependency ordering before the default flush ranking", () => {
    const baseSnapshot = createSnapshot();
    const baseEpisode = baseSnapshot.episodes[0]!;
    const operations: CloudSyncOperation[] = [
      {
        action: "upsert",
        kind: "temporary_drawer",
        payload: {
          createdAt: "2026-04-15T00:04:00.000Z",
          episodeId: "episode_alpha",
          id: "drawer_alpha",
          label: "Hold this beat",
          note: "Drawer baseline",
          projectId: "project_alpha",
          sourceNodeId: "node_alpha",
          updatedAt: "2026-04-15T00:04:00.000Z"
        }
      },
      {
        action: "upsert",
        kind: "node",
        payload: {
          contentMode: "keywords",
          createdAt: "2026-04-15T00:03:00.000Z",
          episodeId: "episode_alpha",
          id: "node_alpha",
          keywords: ["pressure"],
          level: "minor",
          objectIds: ["object_alpha"],
          orderIndex: 1,
          parentId: null,
          projectId: "project_alpha",
          text: "",
          updatedAt: "2026-04-15T00:03:00.000Z"
        }
      },
      {
        action: "upsert",
        kind: "object",
        payload: {
          category: "person",
          createdAt: "2026-04-15T00:02:00.000Z",
          episodeId: "episode_alpha",
          id: "object_alpha",
          name: "Heroine's Mother",
          projectId: "project_alpha",
          summary: "Escalates the scene.",
          updatedAt: "2026-04-15T00:02:00.000Z"
        }
      },
      {
        action: "upsert",
        kind: "episode",
        payload: baseEpisode
      },
      {
        action: "upsert",
        kind: "project",
        payload: baseSnapshot.project
      }
    ];

    const sortedKinds = sortCloudOperations(operations, null).map(
      (operation) => operation.kind
    );

    expect(sortedKinds.indexOf("project")).toBeLessThan(sortedKinds.indexOf("episode"));
    expect(sortedKinds.indexOf("project")).toBeLessThan(sortedKinds.indexOf("object"));
    expect(sortedKinds.indexOf("episode")).toBeLessThan(sortedKinds.indexOf("node"));
    expect(sortedKinds.indexOf("object")).toBeLessThan(sortedKinds.indexOf("node"));
    expect(sortedKinds.indexOf("node")).toBeLessThan(
      sortedKinds.indexOf("temporary_drawer")
    );
  });

  it("requeues failed operations for a later retry", async () => {
    const snapshot = createSnapshot();
    const linkage: ProjectLinkageMetadata = {
      cloudLinked: true,
      entityId: snapshot.project.id,
      lastImportedAt: "2026-04-15T00:00:00.000Z",
      lastSyncedAt: "2026-04-15T00:00:00.000Z",
      linkedAccountId: "demo-account"
    };
    const onError = vi.fn();
    const onSynced = vi.fn();
    let attemptCount = 0;

    const queue = new PersistenceFlushQueue({
      debounceMs: 0,
      getRemoteSnapshot: () => snapshot,
      onError,
      onSynced,
      onSyncing: vi.fn(),
      syncProject: async () => {
        attemptCount += 1;

        if (attemptCount === 1) {
          throw new Error("transient_sync_failure");
        }

        return {
          linkage,
          snapshot
        };
      }
    });

    queue.schedule([
      {
        action: "upsert",
        kind: "node",
        payload: {
          contentMode: "keywords",
          createdAt: "2026-04-15T00:01:00.000Z",
          episodeId: "episode_alpha",
          id: "node_alpha",
          keywords: ["pressure"],
          level: "major",
          objectIds: [],
          orderIndex: 1,
          parentId: null,
          projectId: "project_alpha",
          text: "",
          updatedAt: "2026-04-15T00:01:00.000Z"
        }
      }
    ]);

    await queue.flushNow();
    await queue.flushNow();

    expect(onError).toHaveBeenCalledTimes(1);
    expect(onSynced).toHaveBeenCalledTimes(1);
    expect(attemptCount).toBe(2);

    queue.dispose();
  });
});
