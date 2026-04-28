// 이 파일은 WorkspaceShell 로컬 저장값 파싱 함수를 제공합니다.
import type { StoryNode } from "@scenaairo/shared";

import { nodeCardHeight, nodeCardWidth } from "./workspaceShell.constants";
import type { NodeSize } from "./workspaceShell.types";

export type EpisodeCanvasUiState = {
  laneDividerXs: {
    detailEdge: number;
    first: number;
    second: number;
  };
  timelineEndY: number;
  nodeSizes: Record<string, NodeSize>;
};

// 저장된 에피소드 캔버스 UI 상태를 기본값과 합쳐 파싱합니다.
export function parseStoredEpisodeCanvasUiState(
  value: string | null,
  fallback: Pick<EpisodeCanvasUiState, "laneDividerXs" | "timelineEndY">
) {
  if (!value) {
    return {
      laneDividerXs: { ...fallback.laneDividerXs },
      timelineEndY: fallback.timelineEndY,
      nodeSizes: {} as Record<string, NodeSize>
    } as EpisodeCanvasUiState;
  }

  try {
    const parsed = JSON.parse(value) as Partial<
      {
        laneDividerXs: {
          detailEdge?: unknown;
          first?: unknown;
          second?: unknown;
        };
        timelineEndY?: unknown;
        nodeSizes?: unknown;
      }
    >;
    const parsedLaneDivider = parsed.laneDividerXs;
    const parsedNodeSizes =
      parsed.nodeSizes && typeof parsed.nodeSizes === "object"
        ? parseStoredNodeSizeMap(JSON.stringify(parsed.nodeSizes))
        : ({} as Record<string, NodeSize>);

    const parseNumber = (candidate: unknown, fallbackValue: number) => {
      const numeric = Number(candidate);

      return Number.isFinite(numeric) ? numeric : fallbackValue;
    };

    return {
      laneDividerXs: {
        detailEdge: parseNumber(
          parsedLaneDivider?.detailEdge,
          fallback.laneDividerXs.detailEdge
        ),
        first: parseNumber(parsedLaneDivider?.first, fallback.laneDividerXs.first),
        second: parseNumber(parsedLaneDivider?.second, fallback.laneDividerXs.second)
      },
      timelineEndY: parseNumber(parsed.timelineEndY, fallback.timelineEndY),
      nodeSizes: parsedNodeSizes
    } as EpisodeCanvasUiState;
  } catch {
    return {
      laneDividerXs: { ...fallback.laneDividerXs },
      timelineEndY: fallback.timelineEndY,
      nodeSizes: {} as Record<string, NodeSize>
    } as EpisodeCanvasUiState;
  }
}

// 에피소드 노드 목록에 맞춰 저장된 캔버스 UI 상태를 정리합니다.
export function sanitizeEpisodeCanvasUiState(
  storedState: EpisodeCanvasUiState,
  nodes: StoryNode[],
  fallback: Pick<EpisodeCanvasUiState, "laneDividerXs" | "timelineEndY">
) {
  const clampNumber = (value: number, fallbackValue: number) => {
    return Number.isFinite(value) ? value : fallbackValue;
  };
  const hasMajorNodes = nodes.some((node) => node.level === "major");

  return {
    laneDividerXs: {
      detailEdge: clampNumber(storedState.laneDividerXs.detailEdge, fallback.laneDividerXs.detailEdge),
      first: clampNumber(storedState.laneDividerXs.first, fallback.laneDividerXs.first),
      second: clampNumber(storedState.laneDividerXs.second, fallback.laneDividerXs.second)
    },
    timelineEndY: hasMajorNodes
      ? clampNumber(storedState.timelineEndY, fallback.timelineEndY)
      : fallback.timelineEndY,
    nodeSizes: sanitizeNodeSizeMap(storedState.nodeSizes, nodes)
  } as EpisodeCanvasUiState;
}

// 문자열 배열을 파싱합니다.
export function parseStoredStringArray(value: string | null) {
  if (!value) {
    return [];
  }

  try {
    const parsed = JSON.parse(value) as unknown;

    return Array.isArray(parsed)
      ? parsed.filter((entry): entry is string => typeof entry === "string")
      : [];
  } catch {
    return [];
  }
}

// 화면 저장값 기준의 노드 크기를 안전하게 파싱합니다.
export function parseStoredNodeSizeMap(value: string | null) {
  if (!value) {
    return {} as Record<string, NodeSize>;
  }

  try {
    const parsed = JSON.parse(value) as Record<string, unknown>;

    return Object.fromEntries(
      Object.entries(parsed)
        .map(([nodeId, size]) => {
          if (!size || typeof size !== "object") {
            return null;
          }

          const width = Number((size as { width?: unknown }).width);
          const height = Number((size as { height?: unknown }).height);

          if (!Number.isFinite(width) || !Number.isFinite(height)) {
            return null;
          }

          return [
            nodeId,
            {
              height: Math.max(nodeCardHeight, height),
              width: Math.max(nodeCardWidth, width)
            } satisfies NodeSize
          ];
        })
        .filter((entry): entry is [string, NodeSize] => entry !== null)
    );
  } catch {
    return {} as Record<string, NodeSize>;
  }
}

// 현재 노드 목록에 존재하지 않는 항목은 제거하고 최소 크기를 보장합니다.
export function sanitizeNodeSizeMap(
  nodeSizes: Record<string, NodeSize>,
  nodes: StoryNode[]
) {
  const validNodeIds = new Set(nodes.map((node) => node.id));

  return Object.fromEntries(
    Object.entries(nodeSizes)
      .filter(([nodeId]) => validNodeIds.has(nodeId))
      .map(([nodeId, size]) => [
        nodeId,
        {
          height: Math.max(nodeCardHeight, size.height),
          width: Math.max(nodeCardWidth, size.width)
        } satisfies NodeSize
      ])
  );
}
