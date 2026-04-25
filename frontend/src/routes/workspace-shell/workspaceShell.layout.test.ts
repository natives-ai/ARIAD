// 이 파일은 레인 세로 재배치 보정 로직을 검증합니다.
import { describe, expect, it } from "vitest";

import {
  applyLaneVerticalReflow,
  hasLaneNodeOverlap
} from "./workspaceShell.canvas";

describe("workspace shell lane vertical reflow", () => {
  it("pushes lower lane nodes down to keep the minimum vertical gap", () => {
    const nodePlacements = new Map<string, { x: number; y: number }>([
      ["minor-top", { x: 480, y: 120 }],
      ["minor-bottom", { x: 480, y: 180 }]
    ]);
    const nodeSizes = {
      "minor-bottom": {
        height: 102,
        width: 268
      },
      "minor-top": {
        height: 220,
        width: 268
      }
    };

    applyLaneVerticalReflow(["minor-top", "minor-bottom"], nodePlacements, nodeSizes, {
      gap: 8
    });

    expect(nodePlacements.get("minor-top")?.y).toBe(120);
    expect(nodePlacements.get("minor-bottom")?.y).toBe(348);
  });

  it("keeps locked nodes in place while reflowing the other lane nodes", () => {
    const nodePlacements = new Map<string, { x: number; y: number }>([
      ["minor-top", { x: 480, y: 120 }],
      ["minor-middle", { x: 480, y: 300 }],
      ["minor-bottom", { x: 480, y: 330 }]
    ]);
    const nodeSizes = {
      "minor-bottom": {
        height: 102,
        width: 268
      },
      "minor-middle": {
        height: 102,
        width: 268
      },
      "minor-top": {
        height: 220,
        width: 268
      }
    };

    applyLaneVerticalReflow(
      ["minor-top", "minor-middle", "minor-bottom"],
      nodePlacements,
      nodeSizes,
      {
        gap: 8,
        lockedNodeIds: new Set(["minor-middle"])
      }
    );

    expect(nodePlacements.get("minor-middle")?.y).toBe(300);
    expect(nodePlacements.get("minor-bottom")?.y).toBe(410);
  });

  it("preserves the provided lane order when node y positions are out of order", () => {
    const nodePlacements = new Map<string, { x: number; y: number }>([
      ["minor-first", { x: 480, y: 220 }],
      ["minor-second", { x: 480, y: 120 }]
    ]);
    const nodeSizes = {
      "minor-first": {
        height: 102,
        width: 268
      },
      "minor-second": {
        height: 102,
        width: 268
      }
    };

    applyLaneVerticalReflow(["minor-first", "minor-second"], nodePlacements, nodeSizes, {
      gap: 8
    });

    expect(nodePlacements.get("minor-first")?.y).toBe(220);
    expect(nodePlacements.get("minor-second")?.y).toBe(330);
  });

  it("detects overlap only when lane nodes are actually intersecting", () => {
    const separatedPlacements = new Map<string, { x: number; y: number }>([
      ["minor-a", { x: 480, y: 120 }],
      ["minor-b", { x: 480, y: 240 }]
    ]);
    const overlappingPlacements = new Map<string, { x: number; y: number }>([
      ["minor-a", { x: 480, y: 120 }],
      ["minor-b", { x: 480, y: 170 }]
    ]);
    const nodeSizes = {
      "minor-a": {
        height: 96,
        width: 268
      },
      "minor-b": {
        height: 96,
        width: 268
      }
    };

    expect(
      hasLaneNodeOverlap(["minor-a", "minor-b"], separatedPlacements, nodeSizes)
    ).toBe(false);
    expect(
      hasLaneNodeOverlap(["minor-a", "minor-b"], overlappingPlacements, nodeSizes)
    ).toBe(true);
  });
});
