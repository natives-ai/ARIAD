// 이 파일은 노드 canonicalization 시 배치/시각 필드 보존을 검증합니다.
import { describe, expect, it } from "vitest";
import type { StoryNode, StoryWorkspaceSnapshot } from "@scenaairo/shared";

import { canonicalizeNodeOrderByEpisode } from "./node-order.js";

// 테스트용 스냅샷을 생성합니다.
function createSnapshot(): StoryWorkspaceSnapshot {
  return {
    episodes: [
      {
        createdAt: "2026-04-22T00:00:00.000Z",
        endpoint: "Episode alpha endpoint",
        id: "episode_alpha",
        objective: "Episode alpha objective",
        projectId: "project_alpha",
        title: "Episode Alpha",
        updatedAt: "2026-04-22T00:00:00.000Z"
      },
      {
        createdAt: "2026-04-22T00:00:01.000Z",
        endpoint: "Episode beta endpoint",
        id: "episode_beta",
        objective: "Episode beta objective",
        projectId: "project_alpha",
        title: "Episode Beta",
        updatedAt: "2026-04-22T00:00:01.000Z"
      }
    ],
    nodes: [
      {
        canvasX: 480,
        canvasY: 320,
        canvasHeight: 154,
        canvasWidth: 312,
        contentMode: "text",
        createdAt: "2026-04-22T00:01:00.000Z",
        episodeId: "episode_alpha",
        id: "node_alpha_2",
        isCollapsed: true,
        isFixed: false,
        isImportant: true,
        keywords: ["alpha-2"],
        level: "minor",
        objectIds: ["object_alpha"],
        orderIndex: 99,
        parentId: "node_alpha_1",
        projectId: "project_alpha",
        text: "Alpha node second",
        updatedAt: "2026-04-22T00:01:00.000Z"
      },
      {
        canvasX: 160,
        canvasY: 120,
        canvasHeight: 180,
        canvasWidth: 288,
        contentMode: "keywords",
        createdAt: "2026-04-22T00:00:30.000Z",
        episodeId: "episode_alpha",
        id: "node_alpha_1",
        isCollapsed: false,
        isFixed: true,
        isImportant: false,
        keywords: ["alpha-1"],
        level: "major",
        objectIds: [],
        orderIndex: 99,
        parentId: null,
        projectId: "project_alpha",
        text: "",
        updatedAt: "2026-04-22T00:00:30.000Z"
      },
      {
        canvasX: 180,
        canvasY: 220,
        contentMode: "text",
        createdAt: "2026-04-22T00:00:40.000Z",
        episodeId: "episode_beta",
        id: "node_beta_1",
        isCollapsed: false,
        isFixed: false,
        isImportant: true,
        keywords: [],
        level: "major",
        objectIds: ["object_beta"],
        orderIndex: 500,
        parentId: null,
        projectId: "project_alpha",
        text: "Beta first",
        updatedAt: "2026-04-22T00:00:40.000Z"
      }
    ],
    objects: [
      {
        category: "person",
        createdAt: "2026-04-22T00:00:00.000Z",
        episodeId: "episode_alpha",
        id: "object_alpha",
        name: "Object Alpha",
        projectId: "project_alpha",
        summary: "Alpha object",
        updatedAt: "2026-04-22T00:00:00.000Z"
      },
      {
        category: "place",
        createdAt: "2026-04-22T00:00:00.000Z",
        episodeId: "episode_beta",
        id: "object_beta",
        name: "Object Beta",
        projectId: "project_alpha",
        summary: "Beta object",
        updatedAt: "2026-04-22T00:00:00.000Z"
      }
    ],
    project: {
      activeEpisodeId: "episode_alpha",
      createdAt: "2026-04-22T00:00:00.000Z",
      id: "project_alpha",
      summary: "Project summary",
      title: "Project title",
      updatedAt: "2026-04-22T00:00:00.000Z"
    },
    temporaryDrawer: []
  };
}

// 노드의 orderIndex 외 필드가 그대로 유지되는지 검증합니다.
function expectNodeShapePreserved(previous: StoryNode, next: StoryNode) {
  expect(next.id).toBe(previous.id);
  expect(next.projectId).toBe(previous.projectId);
  expect(next.episodeId).toBe(previous.episodeId);
  expect(next.parentId).toBe(previous.parentId);
  expect(next.level).toBe(previous.level);
  expect(next.contentMode).toBe(previous.contentMode);
  expect(next.text).toBe(previous.text);
  expect(next.createdAt).toBe(previous.createdAt);
  expect(next.updatedAt).toBe(previous.updatedAt);
  expect(next.canvasX).toBe(previous.canvasX);
  expect(next.canvasY).toBe(previous.canvasY);
  expect(next.canvasWidth).toBe(previous.canvasWidth);
  expect(next.canvasHeight).toBe(previous.canvasHeight);
  expect(next.isCollapsed).toBe(previous.isCollapsed);
  expect(next.isFixed).toBe(previous.isFixed);
  expect(next.isImportant).toBe(previous.isImportant);
  expect(next.keywords).toEqual(previous.keywords);
  expect(next.objectIds).toEqual(previous.objectIds);
}

describe("node-order canonicalization", () => {
  it("keeps canvas/visual fields untouched while reindexing order per episode", () => {
    const snapshot = createSnapshot();
    const byIdBefore = new Map(snapshot.nodes.map((node) => [node.id, node]));

    const canonicalNodes = canonicalizeNodeOrderByEpisode(
      snapshot.nodes,
      snapshot.episodes
    );
    const alpha = canonicalNodes
      .filter((node) => node.episodeId === "episode_alpha")
      .sort((left, right) => left.orderIndex - right.orderIndex);
    const beta = canonicalNodes
      .filter((node) => node.episodeId === "episode_beta")
      .sort((left, right) => left.orderIndex - right.orderIndex);

    expect(alpha.map((node) => node.id)).toEqual(["node_alpha_1", "node_alpha_2"]);
    expect(alpha.map((node) => node.orderIndex)).toEqual([1, 2]);
    expect(beta.map((node) => node.id)).toEqual(["node_beta_1"]);
    expect(beta.map((node) => node.orderIndex)).toEqual([1]);

    for (const node of canonicalNodes) {
      const previous = byIdBefore.get(node.id);

      expect(previous).toBeTruthy();
      expectNodeShapePreserved(previous!, node);
    }
  });
});
