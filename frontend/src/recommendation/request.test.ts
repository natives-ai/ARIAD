// 이 파일은 추천 요청 structured context 조립을 검증합니다.
import { describe, expect, it } from "vitest";
import type { StoryWorkspaceSnapshot } from "@scenaairo/shared";

import { createKeywordRecommendationRequest } from "./request";

// 테스트용 워크스페이스 스냅샷을 생성합니다.
function createSnapshot(): StoryWorkspaceSnapshot {
  return {
    episodes: [
      {
        createdAt: "2026-04-28T00:00:00.000Z",
        endpoint: "Mother asks the lead to leave.",
        id: "episode-1",
        objective: "Bridge the cafe meeting to the rejection endpoint.",
        projectId: "project-1",
        title: "Episode 7",
        updatedAt: "2026-04-28T00:00:00.000Z"
      }
    ],
    nodes: [
      {
        canvasY: 420,
        contentMode: "text",
        createdAt: "2026-04-28T00:00:01.000Z",
        episodeId: "episode-1",
        id: "major-bottom",
        keywords: ["refusal"],
        level: "major",
        objectIds: [],
        orderIndex: 2,
        parentId: null,
        projectId: "project-1",
        text: "Doorway refusal",
        updatedAt: "2026-04-28T00:00:01.000Z"
      },
      {
        canvasY: 120,
        contentMode: "text",
        createdAt: "2026-04-28T00:00:02.000Z",
        episodeId: "episode-1",
        id: "major-top",
        keywords: ["meeting"],
        level: "major",
        objectIds: [],
        orderIndex: 1,
        parentId: null,
        projectId: "project-1",
        text: "Cafe meeting",
        updatedAt: "2026-04-28T00:00:02.000Z"
      },
      {
        canvasY: 180,
        contentMode: "text",
        createdAt: "2026-04-28T00:00:03.000Z",
        episodeId: "episode-1",
        id: "minor-current",
        keywords: ["pressure"],
        level: "minor",
        objectIds: ["object-mother"],
        orderIndex: 3,
        parentId: "major-top",
        projectId: "project-1",
        text: "Mother notices the hesitation",
        updatedAt: "2026-04-28T00:00:03.000Z"
      },
      {
        canvasY: 190,
        contentMode: "text",
        createdAt: "2026-04-28T00:00:04.000Z",
        episodeId: "episode-1",
        id: "detail-child",
        keywords: ["glance"],
        level: "detail",
        objectIds: [],
        orderIndex: 4,
        parentId: "minor-current",
        projectId: "project-1",
        text: "A held glance",
        updatedAt: "2026-04-28T00:00:04.000Z"
      },
      {
        canvasY: 360,
        contentMode: "text",
        createdAt: "2026-04-28T00:00:05.000Z",
        episodeId: "episode-1",
        id: "minor-after",
        keywords: ["delay"],
        level: "minor",
        objectIds: [],
        orderIndex: 5,
        parentId: "major-top",
        projectId: "project-1",
        text: "A delayed answer",
        updatedAt: "2026-04-28T00:00:05.000Z"
      }
    ],
    objects: [
      {
        category: "person",
        createdAt: "2026-04-28T00:00:00.000Z",
        episodeId: "episode-1",
        id: "object-mother",
        name: "Mother",
        projectId: "project-1",
        summary: "Authority pressure in the cafe.",
        updatedAt: "2026-04-28T00:00:00.000Z"
      }
    ],
    project: {
      activeEpisodeId: "episode-1",
      createdAt: "2026-04-28T00:00:00.000Z",
      id: "project-1",
      summary: "Weekly webtoon structure workspace.",
      title: "Cafe Confrontation",
      updatedAt: "2026-04-28T00:00:00.000Z"
    },
    temporaryDrawer: []
  };
}

describe("recommendation request structured context", () => {
  it("includes current, direct, flow, object, selected keyword, and open slot context", () => {
    const snapshot = createSnapshot();
    const currentNode = snapshot.nodes.find((node) => node.id === "minor-current")!;
    const parentNode = snapshot.nodes.find((node) => node.id === "major-top")!;
    const request = createKeywordRecommendationRequest(snapshot, currentNode, parentNode, {
      maxSuggestions: 7,
      selectedKeywords: ["pressure", "held breath"]
    });

    expect(request.maxSuggestions).toBe(7);
    expect(request.selectedKeywords).toEqual(["pressure", "held breath"]);
    expect(request.structuredContext?.currentNode.text).toBe(
      "Mother notices the hesitation"
    );
    expect(request.structuredContext?.directConnections.map((node) => node.role)).toEqual([
      "parent",
      "child"
    ]);
    expect(request.structuredContext?.majorLaneFlow.map((item) => item.id)).toEqual([
      "major-top",
      "major-bottom"
    ]);
    expect(request.structuredContext?.objectContext[0]).toMatchObject({
      name: "Mother",
      summary: "Authority pressure in the cafe."
    });
    const rankedItems = request.structuredContext?.rankedItems ?? [];
    const parentItem = rankedItems.find((item) => item.role === "parent");
    const sameLaneItem = rankedItems.find((item) => item.role === "same-lane-after");
    const attachedObjectItem = rankedItems.find((item) => item.role === "attached-object");
    const majorFlowItems = rankedItems.filter((item) => item.role === "major-flow");

    expect(rankedItems[0]).toMatchObject({
      priorityScore: 1,
      role: "current",
      source: "node"
    });
    expect(attachedObjectItem?.priorityScore).toBeGreaterThan(parentItem?.priorityScore ?? 0);
    expect(parentItem?.priorityScore).toBeGreaterThan(sameLaneItem?.priorityScore ?? 0);
    expect(rankedItems.some((item) => item.role === "episode-endpoint")).toBe(true);
    expect(majorFlowItems.map((item) => item.canvasY)).toEqual([120, 420]);
    expect(request.structuredContext?.maxSuggestions).toBe(7);
  });

  it("omits missing major lane neighbors without failing request creation", () => {
    const snapshot = createSnapshot();
    const currentNode = snapshot.nodes.find((node) => node.id === "major-bottom")!;
    const request = createKeywordRecommendationRequest(snapshot, currentNode, null, {
      maxSuggestions: 9,
      selectedKeywords: []
    });

    expect(request.structuredContext?.currentNode.id).toBe("major-bottom");
    expect(request.structuredContext?.directConnections).toEqual([
      expect.objectContaining({
        id: "major-top",
        role: "major-lane-neighbor"
      })
    ]);
  });

  it("marks refresh keyword requests as cache bypass", () => {
    const snapshot = createSnapshot();
    const currentNode = snapshot.nodes.find((node) => node.id === "minor-current")!;
    const parentNode = snapshot.nodes.find((node) => node.id === "major-top")!;
    const normalRequest = createKeywordRecommendationRequest(snapshot, currentNode, parentNode);
    const refreshRequest = createKeywordRecommendationRequest(snapshot, currentNode, parentNode, {
      cacheBypass: true
    });

    expect(normalRequest.cacheBypass).toBeUndefined();
    expect(refreshRequest.cacheBypass).toBe(true);
  });
});
