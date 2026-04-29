// 이 파일은 캔버스 노드 배치와 연결 계산 동작을 검증합니다.
import type { StoryNode, StoryNodeLevel } from "@scenaairo/shared";
import { describe, expect, it } from "vitest";

import { maxCanvasContentBottom } from "./workspaceShell.constants";
import {
  buildConnectionLines,
  computeCanvasAutoScrollVelocity,
  resolveNearestParentIdByY,
  resolveNodeOverlapPlacement,
  resolveVisibleCanvasAutoScrollBounds
} from "./workspaceShell.canvas";

// 테스트용 노드 객체를 생성합니다.
function createNode(
  id: string,
  level: StoryNodeLevel,
  orderIndex: number,
  parentId: string | null = null
): StoryNode {
  return {
    canvasX: 0,
    canvasY: 0,
    contentMode: "empty",
    createdAt: `2026-04-28T00:00:0${orderIndex}.000Z`,
    episodeId: "episode-1",
    id,
    isCollapsed: false,
    isFixed: false,
    isImportant: false,
    keywords: [],
    level,
    objectIds: [],
    orderIndex,
    parentId,
    projectId: "project-1",
    text: "",
    updatedAt: `2026-04-28T00:00:0${orderIndex}.000Z`
  };
}

describe("workspace shell canvas placement", () => {
  it("computes vertical auto-scroll velocity from viewport edge proximity", () => {
    expect(
      computeCanvasAutoScrollVelocity({
        pointerClientY: 240,
        viewportBottom: 400,
        viewportTop: 0
      })
    ).toBe(0);
    expect(
      computeCanvasAutoScrollVelocity({
        pointerClientY: 20,
        viewportBottom: 400,
        viewportTop: 0
      })
    ).toBe(-18);
    expect(
      computeCanvasAutoScrollVelocity({
        pointerClientY: 392,
        viewportBottom: 400,
        viewportTop: 0
      })
    ).toBe(22);
    expect(
      computeCanvasAutoScrollVelocity({
        pointerClientY: 420,
        viewportBottom: 400,
        viewportTop: 0
      })
    ).toBe(24);
  });

  it("clips auto-scroll bounds to the visible browser viewport", () => {
    const bounds = resolveVisibleCanvasAutoScrollBounds({
      browserViewportBottom: 600,
      viewportBottom: 1200,
      viewportTop: 80
    });

    expect(bounds).toEqual({
      viewportBottom: 600,
      viewportTop: 80
    });
    expect(
      computeCanvasAutoScrollVelocity({
        pointerClientY: 592,
        viewportBottom: bounds.viewportBottom,
        viewportTop: bounds.viewportTop
      })
    ).toBe(22);
  });

  it("keeps overlap-resolved placement within the canvas bottom limit", () => {
    const targetSize = {
      height: 220,
      width: 268
    };
    const resolvedPlacement = resolveNodeOverlapPlacement(
      "node-b",
      {
        x: 120,
        y: maxCanvasContentBottom - 40
      },
      targetSize,
      new Map([
        [
          "node-a",
          {
            x: 120,
            y: maxCanvasContentBottom - 160
          }
        ]
      ]),
      {
        "node-a": {
          height: 180,
          width: 268
        }
      },
      ["node-a", "node-b"]
    );

    expect(resolvedPlacement.y).toBeLessThanOrEqual(maxCanvasContentBottom - targetSize.height);
    expect(resolvedPlacement.y + targetSize.height).toBeLessThanOrEqual(maxCanvasContentBottom);
  });

  it("prefers the upward slot when up/down escape distance is tied", () => {
    const resolvedPlacement = resolveNodeOverlapPlacement(
      "node-b",
      {
        x: 120,
        y: 200
      },
      {
        height: 100,
        width: 268
      },
      new Map([
        [
          "node-a",
          {
            x: 120,
            y: 200
          }
        ]
      ]),
      {
        "node-a": {
          height: 100,
          width: 268
        }
      },
      ["node-a", "node-b"]
    );

    expect(resolvedPlacement.y).toBeLessThan(200);
    expect(resolvedPlacement.y + 100 + 18).toBeLessThanOrEqual(200);
  });

  it("resolves the closest parent by visual Y center", () => {
    const nodes = [
      createNode("major-top", "major", 1),
      createNode("major-bottom", "major", 2),
      createNode("minor-draft", "minor", 3)
    ];
    const nodePlacements = new Map<string, { x: number; y: number }>([
      ["major-top", { x: 0, y: 80 }],
      ["major-bottom", { x: 0, y: 320 }]
    ]);
    const nodeSizes = {
      "major-bottom": { height: 100, width: 268 },
      "major-top": { height: 100, width: 268 }
    };

    expect(
      resolveNearestParentIdByY({
        level: "minor",
        nodePlacements,
        nodes,
        nodeSizes,
        targetCenterY: 355
      })
    ).toBe("major-bottom");
  });

  it("prefers the upper parent when Y distance is tied", () => {
    const nodes = [
      createNode("major-top", "major", 1),
      createNode("major-bottom", "major", 2)
    ];
    const nodePlacements = new Map<string, { x: number; y: number }>([
      ["major-top", { x: 0, y: 100 }],
      ["major-bottom", { x: 0, y: 300 }]
    ]);
    const nodeSizes = {
      "major-bottom": { height: 100, width: 268 },
      "major-top": { height: 100, width: 268 }
    };

    expect(
      resolveNearestParentIdByY({
        level: "minor",
        nodePlacements,
        nodes,
        nodeSizes,
        targetCenterY: 250
      })
    ).toBe("major-top");
  });

  it("uses visual placements for parent-child connection endpoints", () => {
    const nodes = [
      createNode("major", "major", 1),
      createNode("minor", "minor", 2, "major")
    ];
    const nodePlacements = new Map<string, { x: number; y: number }>([
      ["major", { x: 40, y: 100 }],
      ["minor", { x: 400, y: 260 }]
    ]);
    const lines = buildConnectionLines(nodes, nodePlacements, {
      major: { height: 120, width: 268 },
      minor: { height: 120, width: 268 }
    });

    expect(lines[0]?.startY).toBe(160);
    expect(lines[0]?.endY).toBe(320);
    expect(lines[0]?.parentId).toBe("major");
    expect(lines[0]?.childId).toBe("minor");
    expect(lines[0]?.hitPath).toBe(lines[0]?.path);
    expect(lines[0]?.midX).toBe((lines[0]!.startX + lines[0]!.endX) / 2);
    expect(lines[0]?.path).toContain("400 320");
  });

  it("uses vertical anchors when an explicit same-level connection exists", () => {
    const nodes = [
      createNode("minor-top", "minor", 1),
      createNode("minor-bottom", "minor", 2, "minor-top"),
      createNode("major", "major", 3)
    ];
    const nodePlacements = new Map<string, { x: number; y: number }>([
      ["minor-top", { x: 400, y: 120 }],
      ["minor-bottom", { x: 400, y: 320 }],
      ["major", { x: 40, y: 160 }]
    ]);
    const lines = buildConnectionLines(nodes, nodePlacements, {
      major: { height: 100, width: 268 },
      "minor-bottom": { height: 100, width: 268 },
      "minor-top": { height: 100, width: 268 }
    });

    expect(lines).toHaveLength(1);
    expect(lines[0]?.id).toBe("minor-top-minor-bottom");
    expect(lines[0]?.isSameLevel).toBe(true);
    expect(lines[0]?.startX).toBe(534);
    expect(lines[0]?.startY).toBe(220);
    expect(lines[0]?.endX).toBe(534);
    expect(lines[0]?.endY).toBe(320);
    expect(lines[0]?.path).toContain("M 534 220");
    expect(lines[0]?.path).toContain("534 320");
  });
});
