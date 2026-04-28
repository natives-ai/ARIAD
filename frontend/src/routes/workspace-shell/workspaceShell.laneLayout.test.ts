// 이 파일은 lane array와 spacer 계산을 검증합니다.
import { describe, expect, it } from "vitest";
import type { StoryNode } from "@scenaairo/shared";

import {
  buildLaneLayout,
  buildLaneLayoutsByLevel,
  getLaneLayoutNodePlacements,
  resolveLaneDropPlacement
} from "./workspaceShell.laneLayout";

// 테스트용 노드를 생성합니다.
function createNode(id: string, canvasY: number): StoryNode {
  return {
    canvasX: 420,
    canvasY,
    contentMode: "empty",
    createdAt: `2026-04-28T00:00:${id}.000Z`,
    episodeId: "episode_alpha",
    id: `node_${id}`,
    keywords: [],
    level: "minor",
    objectIds: [],
    orderIndex: Number(id),
    parentId: "major_parent",
    projectId: "project_alpha",
    text: "",
    updatedAt: `2026-04-28T00:00:${id}.000Z`
  };
}

describe("workspace shell lane layout", () => {
  it("converts saved y gaps into explicit spacer blocks", () => {
    const nodes = [createNode("01", 96), createNode("02", 284)];
    const basePlacements = new Map([
      ["node_01", { x: 420, y: 96 }],
      ["node_02", { x: 420, y: 284 }]
    ]);
    const layout = buildLaneLayout({
      basePlacements,
      level: "minor",
      nodeSizes: {
        node_01: { height: 100, width: 268 },
        node_02: { height: 100, width: 268 }
      },
      nodes
    });

    expect(layout.blocks.map((block) => block.kind)).toEqual([
      "spacer",
      "node",
      "spacer",
      "node"
    ]);
    expect(layout.blocks[0]?.height).toBe(60);
    expect(layout.blocks[2]?.height).toBe(88);
    expect(layout.nodePlacements.get("node_02")?.y).toBe(284);
  });

  it("repairs overlap with only the minimum spacer gap", () => {
    const nodes = [createNode("01", 96), createNode("02", 132)];
    const layout = buildLaneLayout({
      basePlacements: new Map([
        ["node_01", { x: 420, y: 96 }],
        ["node_02", { x: 420, y: 132 }]
      ]),
      gap: 8,
      level: "minor",
      nodeSizes: {
        node_01: { height: 100, width: 268 },
        node_02: { height: 100, width: 268 }
      },
      nodes
    });

    expect(layout.nodePlacements.get("node_01")?.y).toBe(96);
    expect(layout.nodePlacements.get("node_02")?.y).toBe(204);
    expect(layout.blocks.filter((block) => block.kind === "spacer").at(-1)?.height).toBe(8);
  });

  it("keeps priority nodes at the front of a lane layout", () => {
    const nodes = [createNode("01", 140), createNode("02", 80)];
    const layout = buildLaneLayout({
      basePlacements: new Map([
        ["node_01", { x: 420, y: 140 }],
        ["node_02", { x: 420, y: 80 }]
      ]),
      level: "minor",
      nodeSizes: {
        node_01: { height: 100, width: 268 },
        node_02: { height: 100, width: 268 }
      },
      nodes,
      priorityNodeIds: ["node_01"]
    });

    expect(layout.blocks.filter((block) => block.kind === "node")).toMatchObject([
      { nodeId: "node_01" },
      { nodeId: "node_02" }
    ]);
  });

  it("extracts node placements across all lanes", () => {
    const majorNode: StoryNode = {
      ...createNode("01", 96),
      id: "major_01",
      level: "major",
      parentId: null
    };
    const minorNode = createNode("02", 240);
    const layouts = buildLaneLayoutsByLevel({
      basePlacements: new Map([
        ["major_01", { x: 120, y: 96 }],
        ["node_02", { x: 420, y: 240 }]
      ]),
      nodeSizes: {
        major_01: { height: 100, width: 268 },
        node_02: { height: 100, width: 268 }
      },
      nodes: [majorNode, minorNode]
    });
    const placements = getLaneLayoutNodePlacements(layouts);

    expect(placements.get("major_01")).toEqual({ x: 120, y: 96 });
    expect(placements.get("node_02")).toEqual({ x: 420, y: 240 });
  });

  it("resolves drop placement without covering an existing sibling block", () => {
    const nodes = [
      createNode("01", 96),
      createNode("02", 240),
      createNode("03", 400)
    ];
    const layout = buildLaneLayout({
      basePlacements: new Map([
        ["node_01", { x: 420, y: 96 }],
        ["node_02", { x: 420, y: 240 }],
        ["node_03", { x: 420, y: 400 }]
      ]),
      gap: 8,
      level: "minor",
      nodeSizes: {
        node_01: { height: 100, width: 268 },
        node_02: { height: 100, width: 268 },
        node_03: { height: 100, width: 268 }
      },
      nodes
    });
    const placement = resolveLaneDropPlacement({
      gap: 8,
      layout,
      nodeId: "node_01",
      nodeSize: { height: 100, width: 268 },
      targetPlacement: { x: 420, y: 236 }
    });

    expect(placement.y + 100 + 8).toBeLessThanOrEqual(240);
  });
});
