// 이 파일은 캔버스 레인을 node/spacer 배열로 변환합니다.
import type { StoryNode, StoryNodeLevel } from "@scenaairo/shared";

import {
  maxCanvasContentBottom,
  stageTopPadding
} from "./workspaceShell.constants";
import type { NodeSize } from "./workspaceShell.types";

export type LaneLayoutBlock =
  | {
      height: number;
      id: string;
      kind: "node";
      nodeId: string;
      top: number;
    }
  | {
      height: number;
      id: string;
      kind: "spacer";
      role: "drop-preview" | "gap";
      top: number;
    };

export interface LaneLayout {
  blocks: LaneLayoutBlock[];
  level: StoryNodeLevel;
  nodePlacements: Map<string, { x: number; y: number }>;
  totalHeight: number;
}

interface BuildLaneLayoutOptions {
  basePlacements: Map<string, { x: number; y: number }>;
  gap?: number;
  level: StoryNodeLevel;
  maxBottom?: number;
  minY?: number;
  nodeSizes: Record<string, NodeSize>;
  nodes: StoryNode[];
  priorityNodeIds?: Iterable<string | null>;
}

interface BuildLaneLayoutsByLevelOptions {
  basePlacements: Map<string, { x: number; y: number }>;
  gap?: number;
  maxBottom?: number;
  minY?: number;
  nodeSizes: Record<string, NodeSize>;
  nodes: StoryNode[];
  priorityNodeIdsByLevel?: Partial<Record<StoryNodeLevel, Iterable<string | null>>>;
}

interface ResolveLaneDropPlacementOptions {
  gap?: number;
  layout: LaneLayout;
  maxBottom?: number;
  minY?: number;
  nodeId: string;
  nodeSize: NodeSize;
  targetPlacement: { x: number; y: number };
}

// 노드 크기 기본값을 조회합니다.
function getSizedNodeHeight(nodeSizes: Record<string, NodeSize>, nodeId: string) {
  return nodeSizes[nodeId]?.height ?? 102;
}

// 우선 배치할 노드 순서를 맵으로 변환합니다.
function buildPriorityOrder(priorityNodeIds: Iterable<string | null> | undefined) {
  const priorityOrder = new Map<string, number>();

  if (!priorityNodeIds) {
    return priorityOrder;
  }

  for (const nodeId of priorityNodeIds) {
    if (nodeId !== null && !priorityOrder.has(nodeId)) {
      priorityOrder.set(nodeId, priorityOrder.size);
    }
  }

  return priorityOrder;
}

// 레인 하나를 node/spacer block 배열로 계산합니다.
export function buildLaneLayout(options: BuildLaneLayoutOptions): LaneLayout {
  const gap = options.gap ?? 8;
  const minY = options.minY ?? stageTopPadding;
  const maxBottom = options.maxBottom ?? maxCanvasContentBottom;
  const priorityOrder = buildPriorityOrder(options.priorityNodeIds);
  const orderedEntries = options.nodes
    .map((node, sourceIndex) => {
      const placement = options.basePlacements.get(node.id);

      if (!placement) {
        return null;
      }

      const height = getSizedNodeHeight(options.nodeSizes, node.id);
      const maxTop = Math.max(minY, maxBottom - height);

      return {
        height,
        node,
        placement,
        priority: priorityOrder.get(node.id) ?? Number.MAX_SAFE_INTEGER,
        sourceIndex,
        top: Math.max(minY, Math.min(placement.y, maxTop))
      };
    })
    .filter(
      (
        entry
      ): entry is {
        height: number;
        node: StoryNode;
        placement: { x: number; y: number };
        priority: number;
        sourceIndex: number;
        top: number;
      } => entry !== null
    )
    .sort((left, right) => {
      const priorityDelta = left.priority - right.priority;

      if (priorityDelta !== 0) {
        return priorityDelta;
      }

      return (
        left.top - right.top ||
        left.sourceIndex - right.sourceIndex ||
        left.node.id.localeCompare(right.node.id)
      );
    });
  const blocks: LaneLayoutBlock[] = [];
  const nodePlacements = new Map<string, { x: number; y: number }>();
  let cursorY = minY;

  for (const entry of orderedEntries) {
    const minimumTop = blocks.length === 0 ? minY : cursorY + gap;
    const maxTop = Math.max(minY, maxBottom - entry.height);
    const top = Math.min(maxTop, Math.max(entry.top, minimumTop));
    const spacerHeight = Math.max(0, top - cursorY);

    if (spacerHeight > 0) {
      blocks.push({
        height: spacerHeight,
        id: `${options.level}-spacer-${blocks.length}-${entry.node.id}`,
        kind: "spacer",
        role: "gap",
        top: cursorY
      });
    }

    blocks.push({
      height: entry.height,
      id: `${options.level}-node-${entry.node.id}`,
      kind: "node",
      nodeId: entry.node.id,
      top
    });
    nodePlacements.set(entry.node.id, {
      x: entry.placement.x,
      y: top
    });
    cursorY = top + entry.height;
  }

  return {
    blocks,
    level: options.level,
    nodePlacements,
    totalHeight: cursorY
  };
}

// 모든 레인의 node/spacer layout을 계산합니다.
export function buildLaneLayoutsByLevel(
  options: BuildLaneLayoutsByLevelOptions
): Record<StoryNodeLevel, LaneLayout> {
  function buildForLevel(level: StoryNodeLevel) {
    return buildLaneLayout({
      basePlacements: options.basePlacements,
      level,
      nodeSizes: options.nodeSizes,
      nodes: options.nodes.filter((node) => node.level === level),
      ...(options.gap !== undefined ? { gap: options.gap } : {}),
      ...(options.maxBottom !== undefined ? { maxBottom: options.maxBottom } : {}),
      ...(options.minY !== undefined ? { minY: options.minY } : {}),
      ...(options.priorityNodeIdsByLevel?.[level] !== undefined
        ? { priorityNodeIds: options.priorityNodeIdsByLevel[level] }
        : {})
    });
  }

  return {
    detail: buildForLevel("detail"),
    major: buildForLevel("major"),
    minor: buildForLevel("minor")
  };
}

// 레인 layout에서 노드 배치 맵만 추출합니다.
export function getLaneLayoutNodePlacements(
  layouts: Record<StoryNodeLevel, LaneLayout>
) {
  const placements = new Map<string, { x: number; y: number }>();

  for (const layout of Object.values(layouts)) {
    for (const [nodeId, placement] of layout.nodePlacements.entries()) {
      placements.set(nodeId, placement);
    }
  }

  return placements;
}

// 레인 layout에서 형제 노드를 덮지 않는 드롭 위치를 계산합니다.
export function resolveLaneDropPlacement({
  gap = 8,
  layout,
  maxBottom = maxCanvasContentBottom,
  minY = stageTopPadding,
  nodeId,
  nodeSize,
  targetPlacement
}: ResolveLaneDropPlacementOptions) {
  const nodeBlocks = layout.blocks.filter(
    (
      block
    ): block is Extract<LaneLayoutBlock, { kind: "node" }> =>
      block.kind === "node" && block.nodeId !== nodeId
  );
  const targetCenterY = targetPlacement.y + nodeSize.height / 2;
  const nextIndex = nodeBlocks.findIndex((block) => {
    return targetCenterY <= block.top + block.height / 2;
  });
  const insertIndex = nextIndex === -1 ? nodeBlocks.length : nextIndex;
  const previousBlock = insertIndex > 0 ? (nodeBlocks[insertIndex - 1] ?? null) : null;
  const nextBlock = nodeBlocks[insertIndex] ?? null;
  const minimumY =
    previousBlock === null ? minY : previousBlock.top + previousBlock.height + gap;
  const maximumY =
    nextBlock === null ? maxBottom - nodeSize.height : nextBlock.top - gap - nodeSize.height;
  const resolvedY =
    maximumY >= minimumY
      ? Math.max(minimumY, Math.min(targetPlacement.y, maximumY))
      : minimumY;

  return {
    x: targetPlacement.x,
    y: Math.max(minY, Math.min(resolvedY, maxBottom - nodeSize.height))
  };
}
