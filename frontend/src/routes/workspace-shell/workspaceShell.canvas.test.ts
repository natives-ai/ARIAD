// 이 파일은 캔버스 노드 배치 충돌 해소 로직의 경계 동작을 검증합니다.
import { describe, expect, it } from "vitest";

import { maxCanvasContentBottom } from "./workspaceShell.constants";
import { resolveNodeOverlapPlacement } from "./workspaceShell.canvas";

describe("workspace shell canvas placement", () => {
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
});
