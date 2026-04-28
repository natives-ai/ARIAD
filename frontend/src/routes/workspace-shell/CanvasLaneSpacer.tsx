// 이 파일은 캔버스 레인의 시각 전용 spacer를 렌더링합니다.
import type { CSSProperties } from "react";

interface CanvasLaneSpacerProps {
  height: number;
  role: "drop-preview" | "gap";
  y: number;
}

// 레이아웃 전용 빈공간을 표시합니다.
export function CanvasLaneSpacer({ height, role, y }: CanvasLaneSpacerProps) {
  return (
    <div
      aria-hidden="true"
      className={`canvas-lane-spacer canvas-lane-spacer-${role}`}
      data-testid="lane-spacer"
      style={
        {
          height: `${height}px`,
          top: `${y}px`
        } as CSSProperties
      }
    />
  );
}
