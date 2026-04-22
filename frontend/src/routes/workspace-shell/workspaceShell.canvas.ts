// 이 파일은 WorkspaceShell 캔버스 배치/연결 계산 함수를 제공합니다.
import type { StoryNode, StoryNodeLevel } from "@scenaairo/shared";

import { collectSubtreeNodes } from "../../persistence/nodeTree";
import {
  laneGap,
  laneContentStartY,
  stageInnerLeft,
  stageTopPadding,
  maxCanvasContentBottom,
  nodeCardWidth,
  nodeCardHeight,
  nodeVerticalSpacing,
  minCanvasZoom,
  maxCanvasZoom,
  timelineStartY,
  timelineNodeSnapThreshold
} from "./workspaceShell.constants";
import type { NodeSize } from "./workspaceShell.types";

// 레인 중앙 기준 X 좌표를 계산합니다.
function resolveLaneCenteredNodeX(
  bounds: { left: number; right: number },
  nodeSize: NodeSize
) {
  const laneCenterX = bounds.left + (bounds.right - bounds.left) / 2;
  const centeredX = laneCenterX - nodeSize.width / 2;
  const maxX = bounds.right - nodeSize.width;

  if (maxX < bounds.left) {
    return centeredX;
  }

  return Math.max(bounds.left, Math.min(centeredX, maxX));
}

export function computeLaneCanvasBounds(
  firstDividerX: number,
  secondDividerX: number,
  detailEdgeX: number
) {
  return {
    detail: {
      left: secondDividerX + laneGap / 2,
      right: detailEdgeX,
      startY: laneContentStartY
    },
    major: {
      left: stageInnerLeft,
      right: firstDividerX - laneGap / 2,
      startY: laneContentStartY
    },
    minor: {
      left: firstDividerX + laneGap / 2,
      right: secondDividerX - laneGap / 2,
      startY: laneContentStartY
    }
  } satisfies Record<StoryNodeLevel, { left: number; right: number; startY: number }>;
}

export function getNodeSize(
  nodeSizes: Record<string, NodeSize>,
  nodeId: string
): NodeSize {
  return nodeSizes[nodeId] ?? {
    height: nodeCardHeight,
    width: nodeCardWidth
  };
}

export function getFallbackNodePlacementWithinBounds(
  node: StoryNode,
  orderedNodes: StoryNode[],
  laneCanvasBounds: Record<StoryNodeLevel, { left: number; right: number; startY: number }>,
  nodeSize: NodeSize
) {
  const laneNodes = orderedNodes.filter((entry) => entry.level === node.level);
  const laneIndex = laneNodes.findIndex((entry) => entry.id === node.id);
  const bounds = laneCanvasBounds[node.level];
  const defaultX =
    node.level === "major"
      ? getMajorLaneTimelineCenterX(laneCanvasBounds.major) - nodeSize.width / 2
      : resolveLaneCenteredNodeX(bounds, nodeSize);

  return {
    x:
      node.level === "major"
        ? Math.max(bounds.left, Math.min(node.canvasX ?? defaultX, bounds.right - nodeSize.width))
        : defaultX,
    y: Math.max(
      stageTopPadding,
      Math.min(
        node.canvasY ?? bounds.startY + Math.max(0, laneIndex) * nodeVerticalSpacing,
        maxCanvasContentBottom - nodeSize.height
      )
    )
  };
}

export function clampNodePlacement(
  level: StoryNodeLevel,
  placement: {
    x: number;
    y: number;
  },
  stageHeight: number,
  laneCanvasBounds: Record<StoryNodeLevel, { left: number; right: number; startY: number }>,
  nodeSize: NodeSize
) {
  const bounds = laneCanvasBounds[level];

  return {
    x:
      level === "major"
        ? Math.max(bounds.left, Math.min(placement.x, bounds.right - nodeSize.width))
        : resolveLaneCenteredNodeX(bounds, nodeSize),
    y: Math.max(stageTopPadding, Math.min(placement.y, maxCanvasContentBottom - nodeSize.height))
  };
}

export function getMajorLaneTimelineCenterX(majorLaneBounds: {
  left: number;
  right: number;
}) {
  return majorLaneBounds.left + (majorLaneBounds.right - majorLaneBounds.left) / 2;
}

export function clampCanvasZoom(value: number) {
  return Math.min(maxCanvasZoom, Math.max(minCanvasZoom, Number(value.toFixed(2))));
}
export function rectanglesOverlap(
  leftPlacement: { x: number; y: number },
  leftSize: NodeSize,
  rightPlacement: { x: number; y: number },
  rightSize: NodeSize,
  gap = 18
) {
  return !(
    leftPlacement.x + leftSize.width + gap <= rightPlacement.x ||
    rightPlacement.x + rightSize.width + gap <= leftPlacement.x ||
    leftPlacement.y + leftSize.height + gap <= rightPlacement.y ||
    rightPlacement.y + rightSize.height + gap <= leftPlacement.y
  );
}

export function resolveNodeOverlapPlacement(
  nodeId: string | null,
  placement: { x: number; y: number },
  nodeSize: NodeSize,
  resolvedPlacements: Map<string, { x: number; y: number }>,
  nodeSizes: Record<string, NodeSize>,
  existingNodeIds?: Iterable<string>
) {
  const minY = stageTopPadding;
  const maxY = maxCanvasContentBottom - nodeSize.height;
  const nextPlacement = {
    ...placement,
    y: Math.max(minY, Math.min(placement.y, maxY))
  };
  const candidateNodeIds =
    existingNodeIds !== undefined ? [...existingNodeIds] : [...resolvedPlacements.keys()];
  const testedY = new Set<number>();
  const offsetStep = 18;

  // 가장 가까운 위/아래 슬롯을 탐색해 충돌 해소 시 점프를 줄입니다.
  function isCollidingAt(targetY: number) {
    const targetPlacement = {
      ...nextPlacement,
      y: targetY
    };

    return candidateNodeIds.some((otherId) => {
      if (nodeId !== null && otherId === nodeId) {
        return false;
      }

      const otherPlacement = resolvedPlacements.get(otherId);

      if (!otherPlacement) {
        return false;
      }

      return rectanglesOverlap(
        targetPlacement,
        nodeSize,
        otherPlacement,
        getNodeSize(nodeSizes, otherId)
      );
    });
  }

  for (let step = 0; step < 240; step += 1) {
    const offsets = step === 0 ? [0] : [-step * offsetStep, step * offsetStep];

    for (const offset of offsets) {
      const candidateY = Math.max(minY, Math.min(nextPlacement.y + offset, maxY));
      const normalizedY = Number(candidateY.toFixed(2));

      if (testedY.has(normalizedY)) {
        continue;
      }

      testedY.add(normalizedY);

      if (!isCollidingAt(candidateY)) {
        return {
          ...nextPlacement,
          y: candidateY
        };
      }
    }
  }

  return nextPlacement;
}

// 이 함수는 같은 레인 노드를 세로 간격 규칙으로 순차 재배치합니다.
export function applyLaneVerticalReflow(
  nodeIds: string[],
  nodePlacements: Map<string, { x: number; y: number }>,
  nodeSizes: Record<string, NodeSize>,
  options?: {
    gap?: number;
    lockedNodeIds?: Set<string>;
  }
) {
  const gap = options?.gap ?? 8;
  const lockedNodeIds = options?.lockedNodeIds ?? new Set<string>();
  // 입력 nodeIds 순서를 유지해 리사이즈 중 노드 시각 순서가 뒤바뀌지 않도록 합니다.
  const laneEntries = nodeIds
    .map((nodeId) => {
      const placement = nodePlacements.get(nodeId);

      if (!placement) {
        return null;
      }

      return {
        nodeId,
        placement,
        size: getNodeSize(nodeSizes, nodeId)
      };
    })
    .filter((entry): entry is { nodeId: string; placement: { x: number; y: number }; size: NodeSize } => {
      return entry !== null;
    });
  let previousBottom: number | null = null;

  for (const entry of laneEntries) {
    const isLocked = lockedNodeIds.has(entry.nodeId);
    const currentPlacement = nodePlacements.get(entry.nodeId) ?? entry.placement;
    const maxY = maxCanvasContentBottom - entry.size.height;
    const minimumY: number =
      previousBottom === null ? stageTopPadding : previousBottom + gap;
    const nextY: number = isLocked
      ? currentPlacement.y
      : Math.min(maxY, Math.max(currentPlacement.y, minimumY));

    if (nextY !== currentPlacement.y) {
      nodePlacements.set(entry.nodeId, {
        ...currentPlacement,
        y: nextY
      });
    }

    previousBottom = (nodePlacements.get(entry.nodeId)?.y ?? nextY) + entry.size.height;
  }
}

export function getMentionPopoverPosition(rect: DOMRect) {
  const maxLeft = Math.max(16, window.innerWidth - 280);
  const maxTop = Math.max(16, window.innerHeight - 220);

  return {
    left: Math.min(Math.max(12, rect.left), maxLeft),
    top: Math.min(rect.bottom + 10, maxTop)
  };
}

export function canStartCanvasPan(target: EventTarget | null) {
  return (
    target instanceof Element &&
    target.closest(
      "button, input, textarea, select, a, [role='button'], .node-card, .recommendation-panel, .detail-editor"
    ) === null
  );
}
export function hasCollapsedAncestor(node: StoryNode, nodesById: Map<string, StoryNode>) {
  let parentId = node.parentId;

  while (parentId) {
    const parentNode = nodesById.get(parentId);

    if (!parentNode) {
      return false;
    }

    if (parentNode.isCollapsed) {
      return true;
    }

    parentId = parentNode.parentId;
  }

  return false;
}

export function buildConnectionLines(
  nodes: StoryNode[],
  nodePlacements: Map<string, { x: number; y: number }>,
  nodeSizes: Record<string, NodeSize>
) {
  const nodesById = new Map(nodes.map((node) => [node.id, node]));

  return nodes.flatMap((node) => {
    if (node.parentId === null) {
      return [];
    }

    const parentNode = nodesById.get(node.parentId);
    const parentPlacement = nodePlacements.get(node.parentId);
    const childPlacement = nodePlacements.get(node.id);

    if (!parentNode || !parentPlacement || !childPlacement) {
      return [];
    }

    const parentSize = getNodeSize(nodeSizes, parentNode.id);
    const childSize = getNodeSize(nodeSizes, node.id);
    const startX = parentPlacement.x + parentSize.width / 2;
    const endX = childPlacement.x + childSize.width / 2;
    const startY = parentPlacement.y + parentSize.height / 2;
    const endY = childPlacement.y + childSize.height / 2;
    const bendDistance = Math.max(34, Math.abs(endX - startX) * 0.36);
    const curveDirection = endX >= startX ? 1 : -1;
    const firstCurveX = startX + bendDistance * curveDirection;
    const secondCurveX = endX - bendDistance * curveDirection;

    return [
      {
        childId: node.id,
        id: `${parentNode.id}-${node.id}`,
        endX,
        endY,
        path: `M ${startX} ${startY} C ${firstCurveX} ${startY}, ${secondCurveX} ${endY}, ${endX} ${endY}`,
        startX,
        startY
      }
    ];
  });
}
export function isEditableTarget(target: EventTarget | null) {
  return (
    target instanceof HTMLElement &&
    (target.isContentEditable ||
      target.tagName === "INPUT" ||
      target.tagName === "TEXTAREA" ||
      target.tagName === "SELECT")
  );
}

export function isInteractiveTarget(target: EventTarget | null) {
  return (
    target instanceof HTMLElement &&
    target.closest("button, input, textarea, select, a, [role='button']") !== null
  );
}

export function hasTextSelection(target: HTMLTextAreaElement | HTMLInputElement) {
  return (target.selectionStart ?? 0) !== (target.selectionEnd ?? 0);
}

export function getPasteInsertIndex(nodes: StoryNode[], selectedNodeId: string | null) {
  if (!selectedNodeId) {
    return nodes.length;
  }

  const subtreeNodes = collectSubtreeNodes(nodes, selectedNodeId);
  const lastSubtreeNodeId = subtreeNodes.at(-1)?.id ?? selectedNodeId;
  const lastSubtreeIndex = nodes.findIndex((node) => node.id === lastSubtreeNodeId);

  return lastSubtreeIndex === -1 ? nodes.length : lastSubtreeIndex + 1;
}
export function getTimelineAnchorPositions(
  timelineEndY: number,
  majorLaneBounds: {
    left: number;
    right: number;
  },
  majorNodeSize: NodeSize
) {
  const startNodeY = Math.max(stageTopPadding, timelineStartY);
  const endNodeY = Math.max(startNodeY + 48, timelineEndY - majorNodeSize.height);
  const railCenterX = getMajorLaneTimelineCenterX(majorLaneBounds);

  return {
    endNodeBottomY: timelineEndY,
    endNodeY,
    railCenterX,
    snappedNodeX: railCenterX - majorNodeSize.width / 2,
    startNodeY
  };
}

export function snapMajorNodePlacementToTimelineAnchors(
  level: StoryNodeLevel,
  placement: { x: number; y: number },
  timelineAnchors: ReturnType<typeof getTimelineAnchorPositions>,
  nodeSize: NodeSize
) {
  if (level !== "major") {
    return placement;
  }

  const alignedPlacement = {
    ...placement,
    x: timelineAnchors.railCenterX - nodeSize.width / 2
  };
  const dynamicEndNodeY = Math.max(
    timelineAnchors.startNodeY + 48,
    timelineAnchors.endNodeBottomY - nodeSize.height
  );
  const clampedY = Math.max(
    timelineAnchors.startNodeY,
    Math.min(alignedPlacement.y, dynamicEndNodeY)
  );
  const startDistance = Math.abs(clampedY - timelineAnchors.startNodeY);
  const endDistance = Math.abs(
    clampedY + nodeSize.height - timelineAnchors.endNodeBottomY
  );

  if (startDistance <= timelineNodeSnapThreshold && startDistance <= endDistance) {
    return {
      ...alignedPlacement,
      y: timelineAnchors.startNodeY
    };
  }

  if (endDistance <= timelineNodeSnapThreshold) {
    return {
      ...alignedPlacement,
      y: dynamicEndNodeY
    };
  }

  return {
    ...alignedPlacement,
    y: clampedY
  };
}
