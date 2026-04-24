import {
  useEffect,
  useRef,
  useState,
  type CSSProperties,
  type ChangeEvent,
  type DragEvent,
  type MouseEvent as ReactMouseEvent,
  type WheelEvent as ReactWheelEvent
} from "react";
import { createPortal } from "react-dom";
import type { ReactNode } from "react";
import type { KeywordSuggestion } from "@ariad/recommendation";
import type {
  StoryEpisode,
  StoryNode,
  StoryNodeLevel,
  StoryObjectCategory
} from "@ariad/shared";

import { StubAuthBoundary } from "../auth/stubAuthBoundary";
import { copy } from "../copy";
import { loadFrontendEnv } from "../config/env";
import { CloudPersistenceClient } from "../persistence/cloudClient";
import { getDrawerItemPreview, getNodeHeadline } from "../persistence/drawerPayload";
import {
  WorkspacePersistenceController,
  type StoryObjectDraft,
  type WorkspacePersistenceState
} from "../persistence/controller";
import { LocalPersistenceStore } from "../persistence/localStore";
import { StandaloneCloudPersistenceClient } from "../persistence/standaloneCloudClient";
import {
  collectSubtreeNodes,
  isDescendant,
  sortNodesByOrder
} from "../persistence/nodeTree";
import { RecommendationClient } from "../recommendation/client";
import { StandaloneRecommendationClient } from "../recommendation/standaloneClient";
import { createKeywordRecommendationRequest } from "../recommendation/request";

const laneDefinitions: Array<{
  description: string;
  level: StoryNodeLevel;
  title: string;
}> = [
  {
    description: "Start to end anchors live in this lane.",
    level: "major",
    title: copy.workspace.majorLane
  },
  {
    description: "Secondary beats inherit from the nearest major beat by default.",
    level: "minor",
    title: copy.workspace.minorLane
  },
  {
    description: "Detail notes stay attached to the nearest minor beat.",
    level: "detail",
    title: copy.workspace.detailLane
  }
];

const initialStageWidth = 1050;
const stageInnerLeft = 42;
const stageInnerRight = 1012;
const stageTopPadding = 36;
const laneGap = 56;
const laneDividerNodePadding = 40;
const initialLaneDividerXs = {
  first: 355,
  second: 700,
  detailEdge: stageInnerRight
};
const stageRightPadding = initialStageWidth - stageInnerRight;
const minLaneWidth = 220;
const maxCanvasContentRight = 2200;
const maxCanvasContentBottom = 2800;
const timelineRailWidth = 15;
const timelineStartY = 58;
const initialTimelineEndY = 450;
const timelineHandleHeight = 30;
const timelineNodeSnapThreshold = 28;
const nodeCardWidth = 268;
const nodeCardHeight = 102;
const nodeVerticalSpacing = 148;
const laneContentStartY = 56;
const canvasBottomPadding = 8;
const minimumCanvasHeight = 220;
const minCanvasZoom = 0.7;
const maxCanvasZoom = 1.8;
const keywordTokenStart = "\u2063";
const keywordTokenEnd = "\u2064";
const objectTokenStart = "\u2065";
const objectTokenEnd = "\u2066";
const emptyNodes: StoryNode[] = [];

type DragPayload =
  | {
      kind: "draft";
    }
  | {
      kind: "node";
      level: StoryNodeLevel;
      nodeId: string;
    };

type DetailEditorMode = "create-object" | "object";
type ObjectSortMode =
  | "name-asc"
  | "name-desc"
  | "oldest"
  | "recent"
  | "usage-asc"
  | "usage-desc";

interface SidebarFolder {
  createdAt: string;
  episodeIds: string[];
  id: string;
  isCollapsed: boolean;
  isPinned: boolean;
  name: string;
  updatedAt: string;
}

type EpisodePinMap = Record<string, string[]>;
type NodeResizeDirection =
  | "east"
  | "north"
  | "northeast"
  | "northwest"
  | "south"
  | "southeast"
  | "southwest"
  | "west";

interface NodeSize {
  height: number;
  width: number;
}

interface ObjectMentionQuery {
  end: number;
  mode: "mention" | "word";
  query: string;
  start: number;
}

const objectCategoryOptions: StoryObjectCategory[] = ["person", "place", "thing"];
const rootFolderScopeId = "__root__";

function toMessage(error: unknown) {
  return error instanceof Error ? error.message : "recommendation_failed";
}

function describeCloudStatus(state: WorkspacePersistenceState) {
  switch (state.syncStatus) {
    case "booting":
      return "Preparing the local cache and persistence registry.";
    case "guest-local":
      return state.linkage?.cloudLinked
        ? "Guest mode is using the local working cache. Sign in to reconnect to the linked cloud project."
        : copy.persistence.guestMode;
    case "importing":
      return "Importing local work into the account-backed canonical workspace.";
    case "syncing":
      return "Syncing the local working cache to the canonical cloud project.";
    case "synced":
      return `Synced to ${state.linkage?.linkedAccountId ?? state.session.accountId}. Local cache remains active for recovery.`;
    case "error":
      return `Local cache is still available, but cloud sync needs attention: ${state.lastError ?? "unknown_error"}.`;
  }
}

function computeLaneCanvasBounds(
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

function getNodeSize(
  nodeSizes: Record<string, NodeSize>,
  nodeId: string
): NodeSize {
  return nodeSizes[nodeId] ?? {
    height: nodeCardHeight,
    width: nodeCardWidth
  };
}

function getFallbackNodePlacementWithinBounds(
  node: StoryNode,
  orderedNodes: StoryNode[],
  laneCanvasBounds: Record<StoryNodeLevel, { left: number; right: number; startY: number }>,
  nodeSize: NodeSize
) {
  const laneNodes = orderedNodes.filter((entry) => entry.level === node.level);
  const laneIndex = laneNodes.findIndex((entry) => entry.id === node.id);
  const bounds = laneCanvasBounds[node.level];
  const laneWidth = Math.max(nodeSize.width, bounds.right - bounds.left);
  const defaultX =
    node.level === "major"
      ? getMajorLaneTimelineCenterX(laneCanvasBounds.major) - nodeSize.width / 2
      : bounds.left + Math.max(18, (laneWidth - nodeSize.width) / 2);

  return {
    x:
      node.level === "major"
        ? Math.max(bounds.left, Math.min(node.canvasX ?? defaultX, bounds.right - nodeSize.width))
        : Math.max(bounds.left, Math.min(node.canvasX ?? defaultX, maxCanvasContentRight - nodeSize.width)),
    y: Math.max(
      stageTopPadding,
      Math.min(
        node.canvasY ?? bounds.startY + Math.max(0, laneIndex) * nodeVerticalSpacing,
        maxCanvasContentBottom - nodeSize.height
      )
    )
  };
}

function clampNodePlacement(
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
        : Math.max(bounds.left, Math.min(placement.x, maxCanvasContentRight - nodeSize.width)),
    y: Math.max(stageTopPadding, Math.min(placement.y, maxCanvasContentBottom - nodeSize.height))
  };
}

function getMajorLaneTimelineCenterX(majorLaneBounds: {
  left: number;
  right: number;
}) {
  return majorLaneBounds.left + (majorLaneBounds.right - majorLaneBounds.left) / 2;
}

function formatObjectCategory(category: StoryObjectCategory) {
  return category.charAt(0).toUpperCase() + category.slice(1);
}

function clampCanvasZoom(value: number) {
  return Math.min(maxCanvasZoom, Math.max(minCanvasZoom, Number(value.toFixed(2))));
}

function escapeRegExp(value: string) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function getKeywordTokenPattern() {
  return new RegExp(
    `${escapeRegExp(keywordTokenStart)}([^${escapeRegExp(keywordTokenEnd)}\\n]+?)${escapeRegExp(keywordTokenEnd)}`,
    "g"
  );
}

function getInlineKeywordToken(keyword: string) {
  return `${keywordTokenStart}${keyword}${keywordTokenEnd}`;
}

function stripKeywordMarkers(value: string) {
  return value.replace(getKeywordTokenPattern(), "$1");
}

function stripObjectMentionMarkers(value: string) {
  return value
    .replace(
      new RegExp(
        `${escapeRegExp(objectTokenStart)}([^${escapeRegExp(objectTokenEnd)}\\n]+?)${escapeRegExp(objectTokenEnd)}`,
        "g"
      ),
      "$1"
    )
    .replace(/@([^@\n]+?)@/g, "$1");
}

function stripInlineFormattingMarkers(value: string) {
  return stripObjectMentionMarkers(stripKeywordMarkers(value));
}

function extractInlineKeywords(value: string) {
  const matches = value.matchAll(getKeywordTokenPattern());
  const seenKeywords = new Set<string>();
  const keywords: string[] = [];

  for (const match of matches) {
    const nextKeyword = match[1]?.trim();

    if (!nextKeyword || seenKeywords.has(nextKeyword)) {
      continue;
    }

    seenKeywords.add(nextKeyword);
    keywords.push(nextKeyword);
  }

  return keywords;
}

function buildInlineEditorText(text: string, keywords: string[]) {
  const normalizedText = normalizeInlineObjectMentions(text);

  if (extractInlineKeywords(normalizedText).length > 0 || keywords.length === 0) {
    return normalizedText;
  }

  const keywordPrefix = keywords.map(getInlineKeywordToken).join(" ");

  return normalizedText.trim() ? `${keywordPrefix} ${normalizedText}` : keywordPrefix;
}

function extractDisplayText(value: string) {
  return stripInlineFormattingMarkers(value).trim();
}

function extractObjectMentionNames(value: string) {
  const matches = value.matchAll(
    new RegExp(
      `${escapeRegExp(objectTokenStart)}([^${escapeRegExp(objectTokenEnd)}\\n]+?)${escapeRegExp(objectTokenEnd)}|@([^@\\n]+?)@`,
      "g"
    )
  );
  const uniqueNames = new Set<string>();
  const names: string[] = [];

  for (const match of matches) {
    const nextName = (match[1] ?? match[2])?.trim();

    if (!nextName) {
      continue;
    }

    const normalized = nextName.toLowerCase();

    if (uniqueNames.has(normalized)) {
      continue;
    }

    uniqueNames.add(normalized);
    names.push(nextName);
  }

  return names;
}

function getOpenObjectMentionQuery(value: string, caretIndex: number): ObjectMentionQuery | null {
  const beforeCaret = value.slice(0, caretIndex);
  const mentionDelimiterIndexes = [...beforeCaret.matchAll(/@/g)].map((match) => match.index ?? -1);

  if (mentionDelimiterIndexes.length === 0 || mentionDelimiterIndexes.length % 2 === 0) {
    return null;
  }

  const start = mentionDelimiterIndexes.at(-1);

  if (start === undefined || start < 0) {
    return null;
  }

  const query = value.slice(start + 1, caretIndex);

  if (query.includes("\n")) {
    return null;
  }

  return {
    end: caretIndex,
    mode: "mention",
    query,
    start
  };
}

function getObjectToken(name: string) {
  return `${objectTokenStart}${name}${objectTokenEnd}`;
}

function normalizeInlineObjectMentions(value: string) {
  return value.replace(/@([^@\n]+?)@/g, (_, name: string) => getObjectToken(name.trim()));
}

function getClosedObjectWordQuery(
  value: string,
  caretIndex: number,
  objects: Array<{ name: string }>
): ObjectMentionQuery | null {
  const beforeCaret = value.slice(0, caretIndex);
  const afterCaret = value.slice(caretIndex);
  const trailingWhitespace = beforeCaret.match(/\s+$/)?.[0] ?? "";
  const comparisonBefore = trailingWhitespace
    ? beforeCaret.slice(0, -trailingWhitespace.length)
    : beforeCaret;

  if (!comparisonBefore || getOpenObjectMentionQuery(value, caretIndex)) {
    return null;
  }

  const match = [...objects]
    .sort((left, right) => right.name.length - left.name.length)
    .find((object) => {
      const objectName = object.name.toLowerCase();
      const lowerBefore = comparisonBefore.toLowerCase();

      if (!lowerBefore.endsWith(objectName)) {
        return false;
      }

      const start = comparisonBefore.length - object.name.length;
      const prevChar = start > 0 ? (comparisonBefore[start - 1] ?? "") : "";
      const nextChar = afterCaret[0] ?? "";

      return !/[A-Za-z0-9]/.test(prevChar) && !/[A-Za-z0-9]/.test(nextChar);
    });

  if (!match) {
    return null;
  }

  return {
    end: comparisonBefore.length,
    mode: "word",
    query: match.name,
    start: comparisonBefore.length - match.name.length
  };
}

function renderTextWithObjectMentions(value: string) {
  const segments: ReactNode[] = [];
  const inlineTokenPattern = new RegExp(
    `${escapeRegExp(keywordTokenStart)}([^${escapeRegExp(keywordTokenEnd)}\\n]+?)${escapeRegExp(keywordTokenEnd)}|${escapeRegExp(objectTokenStart)}([^${escapeRegExp(objectTokenEnd)}\\n]+?)${escapeRegExp(objectTokenEnd)}|@([^@\\n]+?)@`,
    "g"
  );
  let lastIndex = 0;

  for (const match of value.matchAll(inlineTokenPattern)) {
    const matchIndex = match.index ?? 0;

    if (matchIndex > lastIndex) {
      segments.push(
        <span key={`text-${lastIndex}`}>{value.slice(lastIndex, matchIndex)}</span>
      );
    }

    if (match[1]) {
      segments.push(
        <span className="node-inline-keyword" key={`keyword-${matchIndex}`}>
          {match[1]}
        </span>
      );
    } else if (match[2] || match[3]) {
      segments.push(
        <span className="node-object-mention" key={`mention-${matchIndex}`}>
          {match[2] ?? match[3]}
        </span>
      );
    }

    lastIndex = matchIndex + match[0].length;
  }

  if (lastIndex < value.length) {
    segments.push(<span key={`text-${lastIndex}`}>{value.slice(lastIndex)}</span>);
  }

  return segments.length > 0 ? segments : stripInlineFormattingMarkers(value);
}

function buildDisplayedKeywordSuggestions(
  pinnedKeywords: string[],
  suggestions: KeywordSuggestion[],
  refreshCycle: number
) {
  const pinnedLookup = new Set(pinnedKeywords.map((keyword) => keyword.toLowerCase()));
  const pinnedSuggestions = pinnedKeywords.map((keyword) => {
    const existingSuggestion =
      suggestions.find(
        (suggestion) => suggestion.label.toLowerCase() === keyword.toLowerCase()
      ) ?? null;

    return (
      existingSuggestion ?? {
        label: keyword,
        reason: "Pinned from the current node selection."
      }
    );
  });
  const remainingSuggestions = suggestions.filter(
    (suggestion) => !pinnedLookup.has(suggestion.label.toLowerCase())
  );

  if (remainingSuggestions.length === 0) {
    return pinnedSuggestions.slice(0, 25);
  }

  const rotation = refreshCycle > 0 ? refreshCycle % remainingSuggestions.length : 0;
  const rotatedSuggestions =
    rotation === 0
      ? remainingSuggestions
      : [
          ...remainingSuggestions.slice(rotation),
          ...remainingSuggestions.slice(0, rotation)
        ];

  return [...pinnedSuggestions, ...rotatedSuggestions].slice(0, 25);
}

function toggleInlineKeywordToken(
  value: string,
  keyword: string,
  selectionStart: number,
  selectionEnd: number
) {
  const token = getInlineKeywordToken(keyword);

  if (value.includes(token)) {
    const tokenIndex = value.indexOf(token);

    if (tokenIndex === -1) {
      return {
        nextCaret: selectionStart,
        nextText: value
      };
    }

    let removeStart = tokenIndex;
    let removeEnd = tokenIndex + token.length;

    if (value[removeEnd] === " ") {
      removeEnd += 1;
    } else if (removeStart > 0 && value[removeStart - 1] === " ") {
      removeStart -= 1;
    }

    return {
      nextCaret: removeStart,
      nextText: `${value.slice(0, removeStart)}${value.slice(removeEnd)}`
    };
  }

  const prefix = value.slice(0, selectionStart);
  const suffix = value.slice(selectionEnd);
  const needsLeadingSpace = prefix.length > 0 && !/[\s\n]$/.test(prefix);
  const needsTrailingSpace = suffix.length > 0 && !/^[\s\n]/.test(suffix);
  const insertion = `${needsLeadingSpace ? " " : ""}${token}${needsTrailingSpace ? " " : ""}`;

  return {
    nextCaret: prefix.length + insertion.length,
    nextText: `${prefix}${insertion}${suffix}`
  };
}

function removeAdjacentInlineToken(
  value: string,
  caretIndex: number,
  direction: "backward" | "forward"
) {
  const tokenPattern = new RegExp(
    `${escapeRegExp(keywordTokenStart)}([^${escapeRegExp(keywordTokenEnd)}\\n]+?)${escapeRegExp(keywordTokenEnd)}|${escapeRegExp(objectTokenStart)}([^${escapeRegExp(objectTokenEnd)}\\n]+?)${escapeRegExp(objectTokenEnd)}|@([^@\\n]+?)@`,
    "g"
  );

  for (const match of value.matchAll(tokenPattern)) {
    const start = match.index ?? 0;
    const end = start + match[0].length;
    const touchesToken =
      direction === "backward" ? caretIndex === end : caretIndex === start;

    if (!touchesToken) {
      continue;
    }

    let removeStart = start;
    let removeEnd = end;

    if (value[removeEnd] === " ") {
      removeEnd += 1;
    } else if (removeStart > 0 && value[removeStart - 1] === " ") {
      removeStart -= 1;
    }

    return {
      nextCaret: removeStart,
      nextText: `${value.slice(0, removeStart)}${value.slice(removeEnd)}`
    };
  }

  return null;
}

function getObjectMentionSignature(value: string) {
  return extractObjectMentionNames(value)
    .map((name) => name.toLowerCase())
    .sort()
    .join("\u0001");
}

function rectanglesOverlap(
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

function resolveNodeOverlapPlacement(
  nodeId: string | null,
  placement: { x: number; y: number },
  nodeSize: NodeSize,
  resolvedPlacements: Map<string, { x: number; y: number }>,
  nodeSizes: Record<string, NodeSize>,
  existingNodeIds?: Iterable<string>
) {
  const nextPlacement = { ...placement };
  const candidateNodeIds =
    existingNodeIds !== undefined ? [...existingNodeIds] : [...resolvedPlacements.keys()];
  let guard = 0;

  while (guard < 200) {
    const collision = candidateNodeIds.find((otherId) => {
      if (nodeId !== null && otherId === nodeId) {
        return false;
      }

      const otherPlacement = resolvedPlacements.get(otherId);

      if (!otherPlacement) {
        return false;
      }

      return rectanglesOverlap(
        nextPlacement,
        nodeSize,
        otherPlacement,
        getNodeSize(nodeSizes, otherId)
      );
    });

    if (!collision) {
      return nextPlacement;
    }

    const otherPlacement = resolvedPlacements.get(collision);

    if (!otherPlacement) {
      return nextPlacement;
    }

    const otherSize = getNodeSize(nodeSizes, collision);
    nextPlacement.y = otherPlacement.y + otherSize.height + 18;
    guard += 1;
  }

  return nextPlacement;
}

function getMentionPopoverPosition(rect: DOMRect) {
  const maxLeft = Math.max(16, window.innerWidth - 280);
  const maxTop = Math.max(16, window.innerHeight - 220);

  return {
    left: Math.min(Math.max(12, rect.left), maxLeft),
    top: Math.min(rect.bottom + 10, maxTop)
  };
}

function canStartCanvasPan(target: EventTarget | null) {
  return (
    target instanceof Element &&
    target.closest(
      "button, input, textarea, select, a, [role='button'], .node-card, .recommendation-panel, .detail-editor"
    ) === null
  );
}

function cloneCopiedNodes(nodes: StoryNode[]) {
  return nodes.map((node) => ({
    ...node,
    keywords: [...node.keywords],
    objectIds: [...node.objectIds]
  }));
}

function deriveNodeContentMode(text: string, keywords: string[]) {
  if (stripInlineFormattingMarkers(text).trim()) {
    return "text";
  }

  if (keywords.length > 0) {
    return "keywords";
  }

  return "empty";
}

function hasCollapsedAncestor(node: StoryNode, nodesById: Map<string, StoryNode>) {
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

function buildConnectionLines(
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
    const startX = parentPlacement.x + parentSize.width;
    const endX = childPlacement.x;
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

function isEditableTarget(target: EventTarget | null) {
  return (
    target instanceof HTMLElement &&
    (target.isContentEditable ||
      target.tagName === "INPUT" ||
      target.tagName === "TEXTAREA" ||
      target.tagName === "SELECT")
  );
}

function isInteractiveTarget(target: EventTarget | null) {
  return (
    target instanceof HTMLElement &&
    target.closest("button, input, textarea, select, a, [role='button']") !== null
  );
}

function hasTextSelection(target: HTMLTextAreaElement | HTMLInputElement) {
  return (target.selectionStart ?? 0) !== (target.selectionEnd ?? 0);
}

function getPasteInsertIndex(nodes: StoryNode[], selectedNodeId: string | null) {
  if (!selectedNodeId) {
    return nodes.length;
  }

  const subtreeNodes = collectSubtreeNodes(nodes, selectedNodeId);
  const lastSubtreeNodeId = subtreeNodes.at(-1)?.id ?? selectedNodeId;
  const lastSubtreeIndex = nodes.findIndex((node) => node.id === lastSubtreeNodeId);

  return lastSubtreeIndex === -1 ? nodes.length : lastSubtreeIndex + 1;
}

function parseStoredStringArray(value: string | null) {
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

function parseStoredNodeSizeMap(value: string | null) {
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

function sanitizeNodeSizeMap(
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

function getTimelineAnchorPositions(
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

function snapMajorNodePlacementToTimelineAnchors(
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
  const clampedY = Math.max(
    timelineAnchors.startNodeY,
    Math.min(alignedPlacement.y, timelineAnchors.endNodeY)
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
      y: timelineAnchors.endNodeY
    };
  }

  return {
    ...alignedPlacement,
    y: clampedY
  };
}

function parseStoredFolderList(value: string | null) {
  if (!value) {
    return [];
  }

  try {
    const parsed = JSON.parse(value) as unknown;

    if (!Array.isArray(parsed)) {
      return [];
    }

    return parsed
      .filter((entry): entry is SidebarFolder => {
        if (!entry || typeof entry !== "object") {
          return false;
        }

        const candidate = entry as Partial<SidebarFolder>;

        return (
          typeof candidate.id === "string" &&
          typeof candidate.name === "string" &&
          Array.isArray(candidate.episodeIds) &&
          typeof candidate.createdAt === "string" &&
          typeof candidate.updatedAt === "string"
        );
      })
      .map((folder) => ({
        ...folder,
        episodeIds: folder.episodeIds.filter((entry): entry is string => typeof entry === "string"),
        isCollapsed: folder.isCollapsed ?? false,
        isPinned: folder.isPinned ?? false
      }));
  } catch {
    return [];
  }
}

function parseStoredEpisodePinMap(value: string | null) {
  if (!value) {
    return {} satisfies EpisodePinMap;
  }

  try {
    const parsed = JSON.parse(value) as unknown;

    if (!parsed || typeof parsed !== "object") {
      return {} satisfies EpisodePinMap;
    }

    return Object.fromEntries(
      Object.entries(parsed as Record<string, unknown>).map(([key, entry]) => [
        key,
        Array.isArray(entry)
          ? entry.filter((value): value is string => typeof value === "string")
          : []
      ])
    );
  } catch {
    return {} satisfies EpisodePinMap;
  }
}

function sanitizeSidebarFolders(folders: SidebarFolder[], episodes: StoryEpisode[]) {
  const validEpisodeIds = new Set(episodes.map((episode) => episode.id));
  const seenEpisodeIds = new Set<string>();

  return folders.map((folder) => {
    const episodeIds = folder.episodeIds.filter((episodeId) => {
      if (!validEpisodeIds.has(episodeId) || seenEpisodeIds.has(episodeId)) {
        return false;
      }

      seenEpisodeIds.add(episodeId);
      return true;
    });

    return {
      ...folder,
      episodeIds
    };
  });
}

function matchesEpisodeSearch(episode: StoryEpisode, query: string) {
  if (!query.trim()) {
    return true;
  }

  const normalizedQuery = query.trim().toLowerCase();

  return (
    episode.title.toLowerCase().includes(normalizedQuery) ||
    episode.objective.toLowerCase().includes(normalizedQuery) ||
    episode.endpoint.toLowerCase().includes(normalizedQuery)
  );
}

function SidebarItemIcon({ kind }: { kind: "episode" | "folder" }) {
  return (
    <span
      aria-hidden="true"
      className={`sidebar-item-icon sidebar-item-icon-${kind}`}
    />
  );
}

function renderViewportOverlay(content: ReactNode) {
  return createPortal(content, document.body);
}

export function WorkspaceShell() {
  const isDrawerUiEnabled = false;
  const [env] = useState(() => loadFrontendEnv());
  const [localStore] = useState(
    () => new LocalPersistenceStore(window.localStorage, env.storagePrefix)
  );
  const [controller] = useState(
    () =>
      new WorkspacePersistenceController({
        auth: new StubAuthBoundary(window.localStorage, env.storagePrefix),
        cloud:
          env.runtimeMode === "standalone"
            ? new StandaloneCloudPersistenceClient(window.localStorage, env.storagePrefix)
            : new CloudPersistenceClient(env.apiBaseUrl),
        local: localStore
      })
  );
  const [recommendationClient] = useState(
    () =>
      env.runtimeMode === "standalone"
        ? new StandaloneRecommendationClient()
        : new RecommendationClient(env.apiBaseUrl)
  );
  const [state, setState] = useState<WorkspacePersistenceState | null>(null);
  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null);
  const [draftVisible, setDraftVisible] = useState(false);
  const [dragPayload, setDragPayload] = useState<DragPayload | null>(null);
  const [rewireNodeId, setRewireNodeId] = useState<string | null>(null);
  const [deleteTargetId, setDeleteTargetId] = useState<string | null>(null);
  const [isDrawerOpen, setIsDrawerOpen] = useState(false);
  const [aiPanelNodeId, setAiPanelNodeId] = useState<string | null>(null);
  const [keywordSuggestions, setKeywordSuggestions] = useState<KeywordSuggestion[]>([]);
  const [keywordRefreshCycle, setKeywordRefreshCycle] = useState(0);
  const [selectedAiKeywords, setSelectedAiKeywords] = useState<string[]>([]);
  const [keywordCloudPinnedKeywords, setKeywordCloudPinnedKeywords] = useState<string[]>([]);
  const [recommendationError, setRecommendationError] = useState<string | null>(null);
  const [isLoadingKeywords, setIsLoadingKeywords] = useState(false);
  const [detailMode, setDetailMode] = useState<DetailEditorMode | null>(null);
  const [isNodeMoreMenuOpen, setIsNodeMoreMenuOpen] = useState(false);
  const [selectedObjectId, setSelectedObjectId] = useState<string | null>(null);
  const [objectSearchQuery, setObjectSearchQuery] = useState("");
  const [objectSortMode, setObjectSortMode] = useState<ObjectSortMode>("recent");
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(() => {
    return window.localStorage.getItem(`${env.storagePrefix}:sidebar-collapsed`) === "true";
  });
  const [isEpisodeSearchVisible, setIsEpisodeSearchVisible] = useState(false);
  const [episodeSearchQuery, setEpisodeSearchQuery] = useState("");
  const [isFolderCreatorVisible, setIsFolderCreatorVisible] = useState(false);
  const [folderNameDraft, setFolderNameDraft] = useState("");
  const [isMoreVisible, setIsMoreVisible] = useState(false);
  const [objectMenuId, setObjectMenuId] = useState<string | null>(null);
  const [objectMenuPosition, setObjectMenuPosition] = useState<{
    left: number;
    top: number;
  } | null>(null);
  const [episodeMenuId, setEpisodeMenuId] = useState<string | null>(null);
  const [episodeMenuPosition, setEpisodeMenuPosition] = useState<{
    left: number;
    top: number;
  } | null>(null);
  const [folderPickerEpisodeId, setFolderPickerEpisodeId] = useState<string | null>(null);
  const [folderPickerPosition, setFolderPickerPosition] = useState<{
    left: number;
    top: number;
  } | null>(null);
  const [folderMenuId, setFolderMenuId] = useState<string | null>(null);
  const [folderMenuPosition, setFolderMenuPosition] = useState<{
    left: number;
    top: number;
  } | null>(null);
  const [folderEpisodePickerFolderId, setFolderEpisodePickerFolderId] = useState<string | null>(
    null
  );
  const [folderEpisodePickerPosition, setFolderEpisodePickerPosition] = useState<{
    left: number;
    top: number;
  } | null>(null);
  const [renamingEpisodeId, setRenamingEpisodeId] = useState<string | null>(null);
  const [episodeRenameDraft, setEpisodeRenameDraft] = useState("");
  const [renamingFolderId, setRenamingFolderId] = useState<string | null>(null);
  const [folderRenameDraft, setFolderRenameDraft] = useState("");
  const [deleteEpisodeId, setDeleteEpisodeId] = useState<string | null>(null);
  const [sidebarFolders, setSidebarFolders] = useState<SidebarFolder[]>([]);
  const [folderEpisodePins, setFolderEpisodePins] = useState<EpisodePinMap>({});
  const [sortingFolderId, setSortingFolderId] = useState<string | null>(null);
  const [draggedSidebarEpisodeId, setDraggedSidebarEpisodeId] = useState<string | null>(null);
  const [pinnedObjectIds, setPinnedObjectIds] = useState<string[]>([]);
  const [detailError, setDetailError] = useState<string | null>(null);
  const [isCanvasFullscreen, setIsCanvasFullscreen] = useState(false);
  const [viewportWidth, setViewportWidth] = useState(() => window.innerWidth);
  const [canvasZoom, setCanvasZoom] = useState(1);
  const [isCanvasPanning, setIsCanvasPanning] = useState(false);
  const [laneDividerXs, setLaneDividerXs] = useState<{
    detailEdge: number;
    first: number;
    second: number;
  }>(() => ({
    detailEdge: initialLaneDividerXs.detailEdge,
    first: initialLaneDividerXs.first,
    second: initialLaneDividerXs.second
  }));
  const [timelineEndY, setTimelineEndY] = useState(initialTimelineEndY);
  const [nodeSizes, setNodeSizes] = useState<Record<string, NodeSize>>({});
  const [nodePlacementOverrides, setNodePlacementOverrides] = useState<
    Record<string, { x: number; y: number }>
  >({});
  const [inlineNodeTextDraft, setInlineNodeTextDraft] = useState("");
  const [rewirePreviewPoint, setRewirePreviewPoint] = useState<{
    x: number;
    y: number;
  } | null>(null);
  const [objectMentionQuery, setObjectMentionQuery] = useState<ObjectMentionQuery | null>(null);
  const [objectMentionMenuPosition, setObjectMentionMenuPosition] = useState<{
    left: number;
    top: number;
  } | null>(null);
  const [activeObjectMentionIndex, setActiveObjectMentionIndex] = useState(0);
  const [nodeMenuPosition, setNodeMenuPosition] = useState<{
    left: number;
    top: number;
  } | null>(null);
  const [rewireHoverTargetId, setRewireHoverTargetId] = useState<string | null>(null);
  const [objectEditorDraft, setObjectEditorDraft] = useState<StoryObjectDraft>({
    category: "person",
    name: "",
    summary: ""
  });
  const nodeCardRefs = useRef(new Map<string, HTMLElement>());
  const episodeMenuButtonRefs = useRef(new Map<string, HTMLButtonElement>());
  const folderMenuButtonRefs = useRef(new Map<string, HTMLButtonElement>());
  const objectMenuButtonRefs = useRef(new Map<string, HTMLButtonElement>());
  const nodeMenuButtonRefs = useRef(new Map<string, HTMLButtonElement>());
  const previousSelectedNodeIdentityRef = useRef<string | null>(null);
  const previousActiveEpisodeIdRef = useRef<string | null>(null);
  const copiedNodeTreeRef = useRef<{
    nodes: StoryNode[];
    rootId: string | null;
  } | null>(null);
  const shouldFocusSelectedNodeRef = useRef(false);
  const episodeSearchInputRef = useRef<HTMLInputElement | null>(null);
  const canvasPanelRef = useRef<HTMLElement | null>(null);
  const canvasViewportRef = useRef<HTMLElement | null>(null);
  const canvasStageRef = useRef<HTMLDivElement | null>(null);
  const selectedNodeInputRef = useRef<HTMLTextAreaElement | null>(null);
  const candidateParentIdsRef = useRef<Set<string>>(new Set());
  const effectiveFirstDividerXRef = useRef(initialLaneDividerXs.first);
  const rewireHoverTargetIdRef = useRef<string | null>(null);
  const inlineMentionSignatureRef = useRef<Record<string, string>>({});
  const pendingMentionObjectIdsRef = useRef(new Map<string, Promise<string | null>>());
  const nodePlacementsRef = useRef(new Map<string, { x: number; y: number }>());
  const visibleNodesRef = useRef<StoryNode[]>(emptyNodes);
  const nodeSizesRef = useRef<Record<string, NodeSize>>({});
  const endMajorNodeIdRef = useRef<string | null>(null);
  const selectedNodeIdRef = useRef<string | null>(null);
  const contentMinHeightsRef = useRef<Record<string, number>>({});
  const manuallySizedNodeIdsRef = useRef<Set<string>>(new Set());
  const canvasDragStateRef = useRef<
    | {
        kind: "divider";
        divider: "detail-edge" | "second";
        stageLeft: number;
      }
    | {
        kind: "timeline-end";
        stageTop: number;
      }
    | {
        currentX: number;
        currentY: number;
        direction: NodeResizeDirection;
        initialHeight: number;
        initialWidth: number;
        initialX: number;
        initialY: number;
        kind: "node-resize";
        nodeId: string;
        pointerStartX: number;
        pointerStartY: number;
      }
    | {
        kind: "rewire-drag";
        nodeId: string;
        stageLeft: number;
        stageTop: number;
      }
    | {
        kind: "pan";
        pointerStartX: number;
        pointerStartY: number;
        scrollLeft: number;
        scrollTop: number;
      }
    | null
  >(null);

  useEffect(() => {
    const unsubscribe = controller.subscribe(setState);

    void controller.initialize();

    return () => {
      unsubscribe();
      controller.dispose();
    };
  }, [controller]);

  useEffect(() => {
    if (!state) {
      return;
    }

    const activeEpisodeObjects = state.snapshot.objects.filter(
      (object) => object.episodeId === state.snapshot.project.activeEpisodeId
    );

    if (
      selectedObjectId === null ||
      !activeEpisodeObjects.some((object) => object.id === selectedObjectId)
    ) {
      setSelectedObjectId(activeEpisodeObjects[0]?.id ?? null);
    }
  }, [selectedObjectId, state]);

  useEffect(() => {
    window.localStorage.setItem(
      `${env.storagePrefix}:sidebar-collapsed`,
      String(isSidebarCollapsed)
    );
  }, [env.storagePrefix, isSidebarCollapsed]);

  const activeProjectId = state?.snapshot.project.id ?? null;
  const activeEpisodeId = state?.snapshot.project.activeEpisodeId ?? null;

  useEffect(() => {
    if (!activeProjectId) {
      return;
    }

    const foldersKey = `${env.storagePrefix}:sidebar-folders:${activeProjectId}`;
    const pinsKey = `${env.storagePrefix}:folder-episode-pins:${activeProjectId}`;
    setSidebarFolders(parseStoredFolderList(window.localStorage.getItem(foldersKey)));
    setFolderEpisodePins(parseStoredEpisodePinMap(window.localStorage.getItem(pinsKey)));
  }, [activeProjectId, env.storagePrefix]);

  useEffect(() => {
    if (!activeProjectId) {
      return;
    }

    const foldersKey = `${env.storagePrefix}:sidebar-folders:${activeProjectId}`;
    window.localStorage.setItem(foldersKey, JSON.stringify(sidebarFolders));
  }, [activeProjectId, env.storagePrefix, sidebarFolders]);

  useEffect(() => {
    if (!activeProjectId) {
      return;
    }

    const pinsKey = `${env.storagePrefix}:folder-episode-pins:${activeProjectId}`;
    window.localStorage.setItem(pinsKey, JSON.stringify(folderEpisodePins));
  }, [activeProjectId, env.storagePrefix, folderEpisodePins]);

  useEffect(() => {
    if (!activeProjectId) {
      return;
    }

    const key = `${env.storagePrefix}:pinned-objects:${activeProjectId}:${activeEpisodeId ?? "no-episode"}`;
    setPinnedObjectIds(parseStoredStringArray(window.localStorage.getItem(key)));
  }, [activeEpisodeId, activeProjectId, env.storagePrefix]);

  useEffect(() => {
    if (!activeProjectId) {
      return;
    }

    const key = `${env.storagePrefix}:pinned-objects:${activeProjectId}:${activeEpisodeId ?? "no-episode"}`;
    window.localStorage.setItem(key, JSON.stringify(pinnedObjectIds));
  }, [activeEpisodeId, activeProjectId, env.storagePrefix, pinnedObjectIds]);

  useEffect(() => {
    setNodePlacementOverrides({});

    if (!activeEpisodeId) {
      setNodeSizes({});
      return;
    }

    const key = `${env.storagePrefix}:node-sizes:${activeEpisodeId}`;
    setNodeSizes(parseStoredNodeSizeMap(window.localStorage.getItem(key)));
  }, [activeEpisodeId, env.storagePrefix]);

  useEffect(() => {
    if (!activeEpisodeId) {
      return;
    }

    const key = `${env.storagePrefix}:node-sizes:${activeEpisodeId}`;
    window.localStorage.setItem(key, JSON.stringify(nodeSizes));
  }, [activeEpisodeId, env.storagePrefix, nodeSizes]);

  useEffect(() => {
    if (!isEpisodeSearchVisible || isSidebarCollapsed) {
      return;
    }

    episodeSearchInputRef.current?.focus();
  }, [isEpisodeSearchVisible, isSidebarCollapsed]);

  useEffect(() => {
    if (!state) {
      return;
    }

    const sanitizedFolders = sanitizeSidebarFolders(sidebarFolders, state.snapshot.episodes);
    const changedFolders = JSON.stringify(sanitizedFolders) !== JSON.stringify(sidebarFolders);

    const validEpisodeIds = new Set(state.snapshot.episodes.map((episode) => episode.id));
    const sanitizedPins = Object.fromEntries(
      Object.entries(folderEpisodePins).map(([scopeId, episodeIds]) => [
        scopeId,
        episodeIds.filter((episodeId) => validEpisodeIds.has(episodeId))
      ])
    );
    const changedPins = JSON.stringify(sanitizedPins) !== JSON.stringify(folderEpisodePins);

    if (changedFolders) {
      setSidebarFolders(sanitizedFolders);
    }

    if (changedPins) {
      setFolderEpisodePins(sanitizedPins);
    }
  }, [folderEpisodePins, sidebarFolders, state]);

  useEffect(() => {
    if (!state || !activeEpisodeId) {
      return;
    }

    const episodeNodes = state.snapshot.nodes.filter((node) => node.episodeId === activeEpisodeId);
    const sanitizedNodeSizes = sanitizeNodeSizeMap(nodeSizes, episodeNodes);

    if (JSON.stringify(sanitizedNodeSizes) !== JSON.stringify(nodeSizes)) {
      setNodeSizes(sanitizedNodeSizes);
    }
  }, [activeEpisodeId, nodeSizes, state]);

  useEffect(() => {
    function handlePointerDown(event: PointerEvent) {
      const target = event.target;

      if (!(target instanceof HTMLElement)) {
        return;
      }

      if (
        episodeMenuId !== null &&
        !target.closest(".sidebar-episode-actions") &&
        !target.closest(".sidebar-episode-menu-overlay") &&
        !target.closest(".sidebar-folder-picker")
      ) {
        setEpisodeMenuId(null);
        setEpisodeMenuPosition(null);
        setFolderPickerEpisodeId(null);
        setFolderPickerPosition(null);
      }

      if (
        objectMenuId !== null &&
        !target.closest(".object-row-actions") &&
        !target.closest(".object-row-menu-overlay")
      ) {
        setObjectMenuId(null);
        setObjectMenuPosition(null);
      }

      if (
        folderMenuId !== null &&
        !target.closest(".sidebar-folder-actions") &&
        !target.closest(".sidebar-folder-menu-overlay") &&
        !target.closest(".sidebar-folder-picker")
      ) {
        setFolderMenuId(null);
        setFolderMenuPosition(null);
        setFolderEpisodePickerFolderId(null);
        setFolderEpisodePickerPosition(null);
      }

      if (
        isNodeMoreMenuOpen &&
        !target.closest(".node-menu-shell") &&
        !target.closest(".node-more-menu-overlay")
      ) {
        setIsNodeMoreMenuOpen(false);
        setNodeMenuPosition(null);
      }

      if (
        objectMentionQuery !== null &&
        !target.closest(".object-mention-menu") &&
        !target.closest(".node-inline-input")
      ) {
        setObjectMentionQuery(null);
        setObjectMentionMenuPosition(null);
        setActiveObjectMentionIndex(0);
      }

      if (aiPanelNodeId !== null && !target.closest(".recommendation-panel")) {
        setAiPanelNodeId(null);
        setRecommendationError(null);
      }

      if (
        selectedNodeInputRef.current &&
        document.activeElement === selectedNodeInputRef.current &&
        !target.closest(".node-inline-editor") &&
        !target.closest(".object-mention-menu")
      ) {
        selectedNodeInputRef.current.blur();
      }

      if (isMoreVisible && !target.closest(".sidebar-profile-shell")) {
        setIsMoreVisible(false);
      }
    }

    window.addEventListener("pointerdown", handlePointerDown);

    return () => {
      window.removeEventListener("pointerdown", handlePointerDown);
    };
  }, [
    aiPanelNodeId,
    episodeMenuId,
    folderMenuId,
    isMoreVisible,
    isNodeMoreMenuOpen,
    objectMentionQuery,
    objectMenuId
  ]);

  useEffect(() => {
    function syncAnchoredMenus() {
      const setIfChanged = (
        setter: typeof setEpisodeMenuPosition,
        nextPosition: { left: number; top: number } | null
      ) => {
        setter((current) => {
          if (!nextPosition) {
            return current;
          }

          return current &&
            Math.abs(current.left - nextPosition.left) < 0.5 &&
            Math.abs(current.top - nextPosition.top) < 0.5
            ? current
            : nextPosition;
        });
      };

      if (episodeMenuId !== null) {
        const anchor = episodeMenuButtonRefs.current.get(episodeMenuId) ?? null;
        setIfChanged(
          setEpisodeMenuPosition,
          anchor ? getViewportMenuPosition(anchor.getBoundingClientRect()) : null
        );
      }

      if (folderMenuId !== null) {
        const anchor = folderMenuButtonRefs.current.get(folderMenuId) ?? null;
        setIfChanged(
          setFolderMenuPosition,
          anchor ? getViewportMenuPosition(anchor.getBoundingClientRect()) : null
        );
      }

      if (objectMenuId !== null) {
        const anchor = objectMenuButtonRefs.current.get(objectMenuId) ?? null;
        setIfChanged(
          setObjectMenuPosition,
          anchor ? getViewportMenuPosition(anchor.getBoundingClientRect()) : null
        );
      }

      if (isNodeMoreMenuOpen && selectedNodeId !== null) {
        const anchor = nodeMenuButtonRefs.current.get(selectedNodeId) ?? null;
        setIfChanged(
          setNodeMenuPosition,
          anchor ? getViewportMenuPosition(anchor.getBoundingClientRect()) : null
        );
      }
    }

    if (
      episodeMenuId === null &&
      folderMenuId === null &&
      objectMenuId === null &&
      (!isNodeMoreMenuOpen || selectedNodeId === null)
    ) {
      return;
    }

    syncAnchoredMenus();
    window.addEventListener("resize", syncAnchoredMenus);
    document.addEventListener("scroll", syncAnchoredMenus, true);

    return () => {
      window.removeEventListener("resize", syncAnchoredMenus);
      document.removeEventListener("scroll", syncAnchoredMenus, true);
    };
  }, [episodeMenuId, folderMenuId, isNodeMoreMenuOpen, objectMenuId, selectedNodeId]);

  useEffect(() => {
    function handleFullscreenChange() {
      setIsCanvasFullscreen(document.fullscreenElement === canvasPanelRef.current);
    }

    document.addEventListener("fullscreenchange", handleFullscreenChange);

    return () => {
      document.removeEventListener("fullscreenchange", handleFullscreenChange);
    };
  }, []);

  useEffect(() => {
    function handleViewportResize() {
      setViewportWidth(window.innerWidth);
    }

    window.addEventListener("resize", handleViewportResize);

    return () => {
      window.removeEventListener("resize", handleViewportResize);
    };
  }, []);

  useEffect(() => {
    function handlePointerMove(event: PointerEvent) {
      const dragState = canvasDragStateRef.current;

      if (!dragState) {
        return;
      }

      if (dragState.kind === "pan") {
        const viewport = canvasViewportRef.current;

        if (!viewport) {
          return;
        }

        viewport.scrollLeft = dragState.scrollLeft - (event.clientX - dragState.pointerStartX);
        viewport.scrollTop = dragState.scrollTop - (event.clientY - dragState.pointerStartY);
        return;
      }

      if (dragState.kind === "divider") {
        const nextX = (event.clientX - dragState.stageLeft) / canvasZoom;

        setLaneDividerXs((current) => {
          if (dragState.divider === "second") {
            const minSecond = effectiveFirstDividerXRef.current + minLaneWidth + laneGap;
            const maxSecond = current.detailEdge - minLaneWidth - laneGap / 2;

            return {
              ...current,
              second: Math.max(minSecond, Math.min(nextX, maxSecond))
            };
          }

          const minDetailEdge = current.second + minLaneWidth + laneGap / 2;
          return {
            ...current,
            detailEdge: Math.max(
              minDetailEdge,
              Math.min(nextX, maxCanvasContentRight)
            )
          };
        });

        return;
      }

      if (dragState.kind === "rewire-drag") {
        const hoveredTargetId =
          [...candidateParentIdsRef.current].find((nodeId) => {
            const element = nodeCardRefs.current.get(nodeId);

            if (!element) {
              return false;
            }

            const rect = element.getBoundingClientRect();

            return (
              event.clientX >= rect.left &&
              event.clientX <= rect.right &&
              event.clientY >= rect.top &&
              event.clientY <= rect.bottom
            );
          }) ?? null;

        setRewirePreviewPoint({
          x: (event.clientX - dragState.stageLeft) / canvasZoom,
          y: (event.clientY - dragState.stageTop) / canvasZoom
        });
        rewireHoverTargetIdRef.current = hoveredTargetId;
        setRewireHoverTargetId(hoveredTargetId);
        return;
      }

      if (dragState.kind === "node-resize") {
        const deltaX = (event.clientX - dragState.pointerStartX) / canvasZoom;
        const deltaY = (event.clientY - dragState.pointerStartY) / canvasZoom;
        const minContentHeight =
          contentMinHeightsRef.current[dragState.nodeId] ?? nodeCardHeight;
        const resizesFromLeft =
          dragState.direction === "west" ||
          dragState.direction === "northwest" ||
          dragState.direction === "southwest";
        const resizesFromRight =
          dragState.direction === "east" ||
          dragState.direction === "northeast" ||
          dragState.direction === "southeast";
        const resizesFromTop =
          dragState.direction === "north" ||
          dragState.direction === "northeast" ||
          dragState.direction === "northwest";
        const resizesFromBottom =
          dragState.direction === "south" ||
          dragState.direction === "southeast" ||
          dragState.direction === "southwest";
        const nextWidth = resizesFromLeft
          ? Math.max(nodeCardWidth, dragState.initialWidth - deltaX)
          : resizesFromRight
            ? Math.max(nodeCardWidth, dragState.initialWidth + deltaX)
            : dragState.initialWidth;
        const nextHeight = resizesFromTop
          ? Math.max(minContentHeight, dragState.initialHeight - deltaY)
          : resizesFromBottom
            ? Math.max(minContentHeight, dragState.initialHeight + deltaY)
            : dragState.initialHeight;
        const nextPlacement = {
          x: resizesFromLeft
            ? dragState.initialX + dragState.initialWidth - nextWidth
            : dragState.initialX,
          y: resizesFromTop
            ? dragState.initialY + dragState.initialHeight - nextHeight
            : dragState.initialY
        };
        const nodePlacement = nodePlacementsRef.current.get(dragState.nodeId);

        manuallySizedNodeIdsRef.current.add(dragState.nodeId);
        dragState.currentX = nextPlacement.x;
        dragState.currentY = nextPlacement.y;

        setNodeSizes((current) => ({
          ...current,
          [dragState.nodeId]: {
            height: nextHeight,
            width: nextWidth
          }
        }));
        setNodePlacementOverrides((current) => ({
          ...current,
          [dragState.nodeId]: nextPlacement
        }));

        if (nodePlacement) {
          const nextLowestBottom = Math.max(
            0,
            ...visibleNodesRef.current.map((node) => {
              const placement =
                node.id === dragState.nodeId
                  ? nextPlacement
                  : nodePlacementsRef.current.get(node.id);
              const size =
                node.id === dragState.nodeId
                  ? {
                      height: nextHeight,
                      width: nextWidth
                    }
                  : getNodeSize(nodeSizesRef.current, node.id);

              return (placement?.y ?? 0) + size.height;
            })
          );
          const nextBottom = nextPlacement.y + nextHeight;
          const nextTimelineEnd =
            dragState.nodeId === endMajorNodeIdRef.current
              ? Math.max(nextLowestBottom, nextBottom)
              : nextLowestBottom;

          setTimelineEndY(Math.max(timelineStartY + 120, nextTimelineEnd));
        }

        return;
      }

      const nextTimelineEndY = (event.clientY - dragState.stageTop) / canvasZoom;
      setTimelineEndY(Math.max(timelineStartY + 120, nextTimelineEndY));
    }

    function clearPointerDrag() {
      const dragState = canvasDragStateRef.current;
      canvasDragStateRef.current = null;
      setIsCanvasPanning(false);

      if (dragState?.kind === "rewire-drag") {
        if (
          rewireHoverTargetIdRef.current &&
          rewireHoverTargetIdRef.current !== dragState.nodeId
        ) {
          void controller.rewireNode(dragState.nodeId, rewireHoverTargetIdRef.current);
          setSelectedNodeId(dragState.nodeId);
        }

        rewireHoverTargetIdRef.current = null;
        setRewireHoverTargetId(null);
        setRewirePreviewPoint(null);
        setRewireNodeId(null);
      }

      if (dragState?.kind === "node-resize" && selectedNodeIdRef.current === dragState.nodeId) {
        const placementChanged =
          dragState.currentX !== dragState.initialX || dragState.currentY !== dragState.initialY;

        if (placementChanged) {
          void controller.updateNodePlacement(dragState.nodeId, {
            canvasX: dragState.currentX,
            canvasY: dragState.currentY
          });
        }

        setNodePlacementOverrides((current) => {
          if (!(dragState.nodeId in current)) {
            return current;
          }

          const next = { ...current };
          delete next[dragState.nodeId];
          return next;
        });
        window.requestAnimationFrame(() => {
          syncSelectedNodeInputHeight(dragState.nodeId, selectedNodeInputRef.current);
        });
      }
    }

    window.addEventListener("pointermove", handlePointerMove);
    window.addEventListener("pointerup", clearPointerDrag);
    window.addEventListener("pointercancel", clearPointerDrag);

    return () => {
      window.removeEventListener("pointermove", handlePointerMove);
      window.removeEventListener("pointerup", clearPointerDrag);
      window.removeEventListener("pointercancel", clearPointerDrag);
    };
  }, [canvasZoom, controller]);

  const orderedNodes =
    state && activeEpisodeId
      ? sortNodesByOrder(
          state.snapshot.nodes.filter((node) => node.episodeId === activeEpisodeId)
        )
      : emptyNodes;
  const activeDrawerItems =
    state && activeEpisodeId
      ? state.snapshot.temporaryDrawer.filter((item) => item.episodeId === activeEpisodeId)
      : [];
  const nodesById = new Map(orderedNodes.map((node) => [node.id, node]));
  const selectedNode =
    (selectedNodeId ? nodesById.get(selectedNodeId) : null) ?? orderedNodes[0] ?? null;
  const selectedNodeIdentity = selectedNodeId ?? orderedNodes[0]?.id ?? null;
  const activeEpisodeObjects =
    state && activeEpisodeId
      ? state.snapshot.objects.filter((object) => object.episodeId === activeEpisodeId)
      : [];
  const objectsById = new Map(activeEpisodeObjects.map((object) => [object.id, object]));
  const selectedObject =
    state === null
      ? null
      : (selectedObjectId ? objectsById.get(selectedObjectId) ?? null : null) ||
        activeEpisodeObjects.at(0) ||
        null;
  const isAuthenticated = state ? state.session.mode === "authenticated" : false;
  const isBusy =
    state === null
      ? true
      : state.syncStatus === "booting" || state.syncStatus === "importing";

  useEffect(() => {
    if (previousActiveEpisodeIdRef.current === activeEpisodeId) {
      return;
    }

    previousActiveEpisodeIdRef.current = activeEpisodeId;
    setSelectedNodeId(orderedNodes[0]?.id ?? null);
    setAiPanelNodeId(null);
    setDeleteTargetId(null);
    setDetailMode(null);
    setDetailError(null);
    setDraftVisible(false);
    setEpisodeMenuId(null);
    setEpisodeMenuPosition(null);
    setFolderMenuId(null);
    setFolderMenuPosition(null);
    setFolderPickerEpisodeId(null);
    setFolderPickerPosition(null);
    setFolderEpisodePickerFolderId(null);
    setFolderEpisodePickerPosition(null);
    setIsNodeMoreMenuOpen(false);
    setNodeMenuPosition(null);
    setObjectMenuId(null);
    setObjectMenuPosition(null);
    setObjectSearchQuery("");
    setObjectMentionQuery(null);
    setObjectMentionMenuPosition(null);
    setActiveObjectMentionIndex(0);
    setRewireNodeId(null);
    setRenamingFolderId(null);
    setRenamingEpisodeId(null);
  }, [activeEpisodeId, orderedNodes]);

  useEffect(() => {
    if (previousSelectedNodeIdentityRef.current === selectedNodeIdentity) {
      return;
    }

    previousSelectedNodeIdentityRef.current = selectedNodeIdentity;

    const nextSelectedNode = selectedNodeId
      ? orderedNodes.find((node) => node.id === selectedNodeId) || orderedNodes[0] || null
      : orderedNodes[0] || null;

    if (nextSelectedNode) {
      const nextInlineText = buildInlineEditorText(
        nextSelectedNode.text,
        nextSelectedNode.keywords
      );
      setInlineNodeTextDraft(nextInlineText);
      setSelectedAiKeywords(extractInlineKeywords(nextInlineText));
      inlineMentionSignatureRef.current[nextSelectedNode.id] = getObjectMentionSignature(
        nextInlineText
      );
    } else {
      setInlineNodeTextDraft("");
      setSelectedAiKeywords([]);
    }

    setIsNodeMoreMenuOpen(false);
    setNodeMenuPosition(null);
    setObjectMentionQuery(null);
    setObjectMentionMenuPosition(null);
    setActiveObjectMentionIndex(0);
    setDetailError(null);
  }, [orderedNodes, selectedNodeId, selectedNodeIdentity]);

  useEffect(() => {
    if (!selectedNode || !shouldFocusSelectedNodeRef.current) {
      return;
    }

    const animationId = window.requestAnimationFrame(() => {
      selectedNodeInputRef.current?.focus();
      selectedNodeInputRef.current?.setSelectionRange?.(
        inlineNodeTextDraft.length,
        inlineNodeTextDraft.length
      );
      shouldFocusSelectedNodeRef.current = false;
    });

    return () => {
      window.cancelAnimationFrame(animationId);
    };
  }, [inlineNodeTextDraft.length, selectedNode, selectedNodeIdentity]);

  useEffect(() => {
    if (!selectedNode) {
      return;
    }

    const animationId = window.requestAnimationFrame(() => {
      syncSelectedNodeInputHeight(selectedNode.id, selectedNodeInputRef.current);
    });

    return () => {
      window.cancelAnimationFrame(animationId);
    };
  }, [selectedAiKeywords, inlineNodeTextDraft, selectedNode, selectedNodeIdentity]);

  useEffect(() => {
    if (detailMode === "object" && selectedObject) {
      setObjectEditorDraft({
        category: selectedObject.category,
        name: selectedObject.name,
        summary: selectedObject.summary
      });
      setDetailError(null);
    }
  }, [detailMode, selectedObject]);

  useEffect(() => {
    if (!state) {
      return;
    }

    function handleGlobalKeyDown(event: KeyboardEvent) {
      const key = event.key.toLowerCase();
      const usesModifier = event.ctrlKey || event.metaKey;

      if (event.key === "Escape") {
        if (deleteEpisodeId !== null) {
          event.preventDefault();
          setDeleteEpisodeId(null);
          return;
        }

        if (deleteTargetId !== null) {
          event.preventDefault();
          setDeleteTargetId(null);
          return;
        }

        if (aiPanelNodeId !== null) {
          event.preventDefault();
          setAiPanelNodeId(null);
          setRecommendationError(null);
          return;
        }

        if (detailMode !== null) {
          event.preventDefault();
          setDetailMode(null);
          setDetailError(null);
          return;
        }

        if (isNodeMoreMenuOpen) {
          event.preventDefault();
          closeNodeMenu();
          return;
        }

        if (episodeMenuId !== null) {
          event.preventDefault();
          setEpisodeMenuId(null);
          setEpisodeMenuPosition(null);
          setFolderPickerEpisodeId(null);
          setFolderPickerPosition(null);
          return;
        }

        if (folderMenuId !== null) {
          event.preventDefault();
          setFolderMenuId(null);
          setFolderMenuPosition(null);
          setFolderEpisodePickerFolderId(null);
          setFolderEpisodePickerPosition(null);
          return;
        }

        if (objectMenuId !== null) {
          event.preventDefault();
          setObjectMenuId(null);
          setObjectMenuPosition(null);
          return;
        }

        if (isMoreVisible) {
          event.preventDefault();
          setIsMoreVisible(false);
          return;
        }

        if (renamingEpisodeId !== null) {
          event.preventDefault();
          setRenamingEpisodeId(null);
          setEpisodeRenameDraft("");
          return;
        }

        if (renamingFolderId !== null) {
          event.preventDefault();
          setRenamingFolderId(null);
          setFolderRenameDraft("");
          return;
        }

        if (rewireNodeId !== null) {
          event.preventDefault();
          setRewireNodeId(null);
          return;
        }

        if (draftVisible) {
          event.preventDefault();
          setDraftVisible(false);
        }

        return;
      }

      const isSelectedNodeInputTarget =
        event.target instanceof HTMLTextAreaElement &&
        event.target.classList.contains("node-inline-input");
      const selectedNodeInputElement = isSelectedNodeInputTarget
        ? event.target
        : selectedNodeInputRef.current;
      const inlineEditorHasSelection =
        isSelectedNodeInputTarget &&
        selectedNodeInputElement !== null &&
        hasTextSelection(selectedNodeInputElement);
      const canUseNodeShortcutFromInlineEditor =
        isSelectedNodeInputTarget &&
        selectedNode !== null &&
        !inlineEditorHasSelection &&
        ((key === "c" && usesModifier) ||
          (key === "v" && usesModifier && copiedNodeTreeRef.current !== null) ||
          (key === "z" && usesModifier) ||
          (key === "y" && usesModifier));

      if ((isEditableTarget(event.target) && !canUseNodeShortcutFromInlineEditor) || isBusy) {
        return;
      }

      if (usesModifier && key === "z") {
        event.preventDefault();

        if (event.shiftKey) {
          void controller.redo();
        } else {
          void controller.undo();
        }

        return;
      }

      if (usesModifier && key === "y") {
        event.preventDefault();
        void controller.redo();
        return;
      }

      if (usesModifier && key === "c" && selectedNode) {
        event.preventDefault();
        copiedNodeTreeRef.current = {
          nodes: cloneCopiedNodes(collectSubtreeNodes(orderedNodes, selectedNode.id)),
          rootId: selectedNode.id
        };
        return;
      }

      if (usesModifier && key === "v" && copiedNodeTreeRef.current) {
        event.preventDefault();

        const clipboard = copiedNodeTreeRef.current;
        const clipboardRootNode =
          clipboard.nodes.find((node) => node.id === clipboard.rootId) ?? clipboard.nodes[0] ?? null;

        void controller
          .pasteNodeTree(
            clipboard.nodes,
            clipboard.rootId,
            getPasteInsertIndex(orderedNodes, selectedNode?.id ?? null)
          )
          .then((nextNodeId) => {
            if (!nextNodeId) {
              return;
            }

            shouldFocusSelectedNodeRef.current = true;
            setSelectedNodeId(nextNodeId);
            setInlineNodeTextDraft(
              clipboardRootNode
                ? buildInlineEditorText(clipboardRootNode.text, clipboardRootNode.keywords)
                : ""
            );
            setSelectedAiKeywords(clipboardRootNode?.keywords ?? []);
            setRewireNodeId(null);
            setDeleteTargetId(null);
          });

        return;
      }

      if (isInteractiveTarget(event.target)) {
        return;
      }

      if (
        (event.key === "Delete" || event.key === "Backspace") &&
        selectedNode &&
        deleteTargetId === null
      ) {
        event.preventDefault();
        setDeleteTargetId(selectedNode.id);
        setRewireNodeId(null);
        return;
      }

    }

    window.addEventListener("keydown", handleGlobalKeyDown);

    return () => {
      window.removeEventListener("keydown", handleGlobalKeyDown);
    };
  }, [
    aiPanelNodeId,
    controller,
    deleteEpisodeId,
    deleteTargetId,
    detailMode,
    draftVisible,
    episodeMenuId,
    folderMenuId,
    folderPickerEpisodeId,
    isMoreVisible,
    isNodeMoreMenuOpen,
    inlineNodeTextDraft,
    isBusy,
    objectMenuId,
    orderedNodes,
    renamingFolderId,
    renamingEpisodeId,
    rewireNodeId,
    selectedNode,
    state
  ]);

  if (!state) {
    return (
      <div className="workspace-shell workspace-shell-loading">
        <section className="panel panel-canvas">
          <span className="eyebrow">Center</span>
          <h1>{copy.workspace.title}</h1>
          <p>Loading the local persistence baseline for the active workspace.</p>
        </section>
      </div>
    );
  }

  const activeEpisode =
    state.snapshot.episodes.find((episode) => episode.id === activeEpisodeId) ??
    state.snapshot.episodes[0];
  const snapshot = state.snapshot;
  const fullscreenStageWidth = Math.max(initialStageWidth, viewportWidth - 120);
  const minimumVisibleDetailEdge = Math.max(
    laneDividerXs.detailEdge,
    (isCanvasFullscreen ? fullscreenStageWidth : initialStageWidth) - stageRightPadding
  );
  const visibleNodes = orderedNodes.filter((node) => !hasCollapsedAncestor(node, nodesById));
  const rewireNode = rewireNodeId ? nodesById.get(rewireNodeId) ?? null : null;
  const autoFirstDividerX = Math.max(
    initialLaneDividerXs.first,
    stageInnerLeft +
      Math.max(
        minLaneWidth,
        ...visibleNodes
          .filter((node) => node.level === "major")
          .map((node) => getNodeSize(nodeSizes, node.id).width + laneDividerNodePadding * 2)
      ) +
      laneGap / 2
  );
  const effectiveFirstDividerX = autoFirstDividerX;
  const baseLaneCanvasBounds = computeLaneCanvasBounds(
    effectiveFirstDividerX,
    laneDividerXs.second,
    minimumVisibleDetailEdge
  );
  const baseTimelineAnchors = getTimelineAnchorPositions(
    timelineEndY,
    baseLaneCanvasBounds.major,
    {
      height: nodeCardHeight,
      width: nodeCardWidth
    }
  );
  const baseNodePlacements = new Map(
    visibleNodes.map((node) => {
      const nodeSize = getNodeSize(nodeSizes, node.id);
      const placement = getFallbackNodePlacementWithinBounds(
        node,
        orderedNodes,
        baseLaneCanvasBounds,
        nodeSize
      );

      return [
        node.id,
        node.level === "major"
          ? snapMajorNodePlacementToTimelineAnchors(
              node.level,
              placement,
              baseTimelineAnchors,
              nodeSize
            )
          : placement
      ];
    })
  );
  const autoSecondDividerX = Math.min(
    maxCanvasContentRight - minLaneWidth - laneGap / 2,
    Math.max(
      effectiveFirstDividerX + minLaneWidth + laneGap,
      ...visibleNodes
        .filter((node) => node.level === "minor")
        .map((node) => {
          const placement = baseNodePlacements.get(node.id);
          const nodeSize = getNodeSize(nodeSizes, node.id);
          return (
            (placement?.x ?? baseLaneCanvasBounds.minor.left) +
            nodeSize.width +
            laneDividerNodePadding
          );
        })
    )
  );
  const effectiveSecondDividerX = Math.max(laneDividerXs.second, autoSecondDividerX);
  const autoDetailEdgeX = Math.min(
    maxCanvasContentRight,
    Math.max(
      minimumVisibleDetailEdge,
      effectiveSecondDividerX + minLaneWidth + laneGap / 2,
      ...visibleNodes
        .filter((node) => node.level === "detail")
        .map((node) => {
          const placement = baseNodePlacements.get(node.id);
          const nodeSize = getNodeSize(nodeSizes, node.id);
          return (
            (placement?.x ?? baseLaneCanvasBounds.detail.left) +
            nodeSize.width +
            laneDividerNodePadding
          );
        })
    )
  );
  const effectiveDetailEdgeX = Math.max(laneDividerXs.detailEdge, autoDetailEdgeX);
  const laneCanvasBounds = computeLaneCanvasBounds(
    effectiveFirstDividerX,
    effectiveSecondDividerX,
    effectiveDetailEdgeX
  );
  const stageWidth = effectiveDetailEdgeX + stageRightPadding;
  const laneWidths = {
    detail: laneCanvasBounds.detail.right - laneCanvasBounds.detail.left,
    major: laneCanvasBounds.major.right - laneCanvasBounds.major.left,
    minor: laneCanvasBounds.minor.right - laneCanvasBounds.minor.left
  };
  const timelineAnchors = getTimelineAnchorPositions(
    timelineEndY,
    laneCanvasBounds.major,
    {
      height: nodeCardHeight,
      width: nodeCardWidth
    }
  );
  const nodePlacements = new Map<string, { x: number; y: number }>();

  for (const node of visibleNodes) {
    const nodeSize = getNodeSize(nodeSizes, node.id);
    const overridePlacement = nodePlacementOverrides[node.id];
    const fallbackPlacement = getFallbackNodePlacementWithinBounds(
      node,
      orderedNodes,
      laneCanvasBounds,
      nodeSize
    );
    const snappedPlacement =
      node.level === "major"
        ? snapMajorNodePlacementToTimelineAnchors(
            node.level,
            fallbackPlacement,
            timelineAnchors,
            nodeSize
          )
        : fallbackPlacement;

    nodePlacements.set(
      node.id,
      overridePlacement ??
        resolveNodeOverlapPlacement(
          node.id,
          snappedPlacement,
          nodeSize,
          nodePlacements,
          nodeSizes,
          visibleNodes
            .filter((entry) => entry.level === node.level)
            .map((entry) => entry.id)
        )
    );
  }
  const majorLaneTimelineLocalCenterX =
    timelineAnchors.railCenterX - laneCanvasBounds.major.left;
  const connectionLines = buildConnectionLines(visibleNodes, nodePlacements, nodeSizes);
  const lowestNodeBottom = Math.max(
    0,
    ...visibleNodes.map((node) => {
      const placement = nodePlacements.get(node.id);
      const nodeSize = getNodeSize(nodeSizes, node.id);
      return (placement?.y ?? 0) + nodeSize.height;
    })
  );
  const effectiveTimelineEndY = Math.max(
    timelineEndY,
    lowestNodeBottom
  );
  const stageHeight = Math.max(
    minimumCanvasHeight,
    effectiveTimelineEndY + timelineHandleHeight + canvasBottomPadding,
    lowestNodeBottom + canvasBottomPadding
  );
  const candidateParentIds = new Set(
    !rewireNode
      ? []
      : orderedNodes
          .filter((node) => node.id !== rewireNode.id)
          .filter((node) => !isDescendant(orderedNodes, rewireNode.id, node.id))
          .map((node) => node.id)
  );
  candidateParentIdsRef.current = candidateParentIds;
  effectiveFirstDividerXRef.current = effectiveFirstDividerX;
  const deleteTarget =
    deleteTargetId !== null ? nodesById.get(deleteTargetId) ?? null : null;
  const aiPanelNode = aiPanelNodeId ? nodesById.get(aiPanelNodeId) ?? null : null;

  function getInsertIndexForCanvasY(targetY: number) {
    const sortedByCanvasY = [...visibleNodes].sort((left, right) => {
      const leftPlacement = nodePlacements.get(left.id);
      const rightPlacement = nodePlacements.get(right.id);

      return (leftPlacement?.y ?? 0) - (rightPlacement?.y ?? 0);
    });
    const anchorNode = sortedByCanvasY.find((node) => {
      const placement = nodePlacements.get(node.id);
      return (placement?.y ?? Number.MAX_SAFE_INTEGER) > targetY;
    });

    if (!anchorNode) {
      return orderedNodes.length;
    }

    const orderedIndex = orderedNodes.findIndex((node) => node.id === anchorNode.id);

    return orderedIndex === -1 ? orderedNodes.length : orderedIndex;
  }

  function getProjectedLowestNodeBottom(
    overrideNodeId?: string,
    overridePlacement?: { x: number; y: number },
    overrideSize?: NodeSize
  ) {
    return Math.max(
      0,
      ...visibleNodes.map((node) => {
        const placement =
          node.id === overrideNodeId && overridePlacement
            ? overridePlacement
            : nodePlacements.get(node.id);
        const nodeSize =
          node.id === overrideNodeId && overrideSize
            ? overrideSize
            : getNodeSize(nodeSizes, node.id);

        return (placement?.y ?? 0) + nodeSize.height;
      })
    );
  }

  function getStagePointFromClient(clientX: number, clientY: number) {
    const stageRect = canvasStageRef.current?.getBoundingClientRect();

    if (!stageRect) {
      return null;
    }

    return {
      stageRect,
      x: (clientX - stageRect.left) / canvasZoom,
      y: (clientY - stageRect.top) / canvasZoom
    };
  }

  function centerCanvasViewportOnRegion(
    region: { height: number; width: number; x: number; y: number },
    behavior: ScrollBehavior = "smooth"
  ) {
    const viewport = canvasViewportRef.current;

    if (!viewport) {
      return;
    }

    const nextLeft =
      region.x * canvasZoom + (region.width * canvasZoom) / 2 - viewport.clientWidth / 2;
    const nextTop =
      region.y * canvasZoom + (region.height * canvasZoom) / 2 - viewport.clientHeight / 2;
    const resolvedLeft = Math.max(0, nextLeft);
    const resolvedTop = Math.max(0, nextTop);

    if (typeof viewport.scrollTo === "function") {
      viewport.scrollTo({
        behavior,
        left: resolvedLeft,
        top: resolvedTop
      });
      return;
    }

    viewport.scrollLeft = resolvedLeft;
    viewport.scrollTop = resolvedTop;
  }

  function centerCanvasViewportOnNode(
    nodeId: string,
    behavior: ScrollBehavior = "smooth",
    extraHeight = 0
  ) {
    const placement = nodePlacementsRef.current.get(nodeId);

    if (!placement) {
      return;
    }

    const nodeSize = getNodeSize(nodeSizesRef.current, nodeId);

    centerCanvasViewportOnRegion(
      {
        height: nodeSize.height + extraHeight,
        width: nodeSize.width,
        x: placement.x,
        y: placement.y
      },
      behavior
    );
  }

  function getPlacementFromPointer(
    level: StoryNodeLevel,
    clientX: number,
    clientY: number,
    nodeSize: NodeSize = {
      height: nodeCardHeight,
      width: nodeCardWidth
    }
  ) {
    const stagePoint = getStagePointFromClient(clientX, clientY);

    if (!stagePoint) {
      return null;
    }

    return snapMajorNodePlacementToTimelineAnchors(
      level,
      clampNodePlacement(
        level,
        {
          x: stagePoint.x - nodeSize.width / 2,
          y: stagePoint.y - nodeSize.height / 2
        },
        stageHeight,
        laneCanvasBounds,
        nodeSize
      ),
      timelineAnchors,
      nodeSize
    );
  }

  function getFreePlacementFromPointer(
    level: StoryNodeLevel,
    clientX: number,
    clientY: number,
    nodeSize: NodeSize = {
      height: nodeCardHeight,
      width: nodeCardWidth
    }
  ) {
    const stagePoint = getStagePointFromClient(clientX, clientY);

    if (!stagePoint) {
      return null;
    }

    return clampNodePlacement(
      level,
      {
        x: stagePoint.x - nodeSize.width / 2,
        y: stagePoint.y - nodeSize.height / 2
      },
      stageHeight,
      laneCanvasBounds,
      nodeSize
    );
  }

  function getLaneLevelFromClientX(clientX: number) {
    const stageRect = canvasStageRef.current?.getBoundingClientRect();

    if (!stageRect) {
      return "major" satisfies StoryNodeLevel;
    }

    const stageX = (clientX - stageRect.left) / canvasZoom;

    if (stageX < effectiveFirstDividerX) {
      return "major" satisfies StoryNodeLevel;
    }

    if (stageX < effectiveSecondDividerX) {
      return "minor" satisfies StoryNodeLevel;
    }

    return "detail" satisfies StoryNodeLevel;
  }

  function beginCanvasPan(event: ReactMouseEvent<HTMLElement>) {
    const viewport = canvasViewportRef.current;

    if (
      !viewport ||
      draftVisible ||
      event.button !== 0 ||
      !canStartCanvasPan(event.target)
    ) {
      return;
    }

    event.preventDefault();
    canvasDragStateRef.current = {
      kind: "pan",
      pointerStartX: event.clientX,
      pointerStartY: event.clientY,
      scrollLeft: viewport.scrollLeft,
      scrollTop: viewport.scrollTop
    };
    setIsCanvasPanning(true);
  }

  function handleCanvasViewportWheel(event: ReactWheelEvent<HTMLElement>) {
    if (!(event.ctrlKey || event.metaKey)) {
      return;
    }

    const viewport = canvasViewportRef.current;

    if (!viewport) {
      return;
    }

    event.preventDefault();
    const viewportRect = viewport.getBoundingClientRect();
    const pointerOffsetX = event.clientX - viewportRect.left + viewport.scrollLeft;
    const pointerOffsetY = event.clientY - viewportRect.top + viewport.scrollTop;
    const stagePointX = pointerOffsetX / canvasZoom;
    const stagePointY = pointerOffsetY / canvasZoom;
    const nextZoom = clampCanvasZoom(canvasZoom - event.deltaY * 0.0015);

    if (nextZoom === canvasZoom) {
      return;
    }

    setCanvasZoom(nextZoom);

    window.requestAnimationFrame(() => {
      const nextPointerOffsetX = stagePointX * nextZoom;
      const nextPointerOffsetY = stagePointY * nextZoom;
      viewport.scrollLeft = Math.max(0, nextPointerOffsetX - (event.clientX - viewportRect.left));
      viewport.scrollTop = Math.max(0, nextPointerOffsetY - (event.clientY - viewportRect.top));
    });
  }

  function maybeExtendTimelineForDraggedNode(
    clientY: number,
    nodeSize: NodeSize
  ) {
    const stagePoint = getStagePointFromClient(0, clientY);

    if (!stagePoint) {
      return;
    }

    const nextBottom = stagePoint.y + nodeSize.height / 2;

    if (nextBottom > timelineEndY) {
      setTimelineEndY(Math.max(timelineStartY + 120, nextBottom));
    }
  }

  function beginLaneDividerDrag(
    divider: "detail-edge" | "second",
    event: ReactMouseEvent<HTMLButtonElement>
  ) {
    const stageRect = canvasStageRef.current?.getBoundingClientRect();

    if (!stageRect) {
      return;
    }

    event.preventDefault();
    event.stopPropagation();
    setLaneDividerXs((current) => ({
      ...current,
      first: effectiveFirstDividerX,
      detailEdge: Math.max(current.detailEdge, effectiveDetailEdgeX),
      second: Math.max(current.second, effectiveSecondDividerX)
    }));
    canvasDragStateRef.current = {
      divider,
      kind: "divider",
      stageLeft: stageRect.left
    };
  }

  function beginTimelineEndDrag(event: ReactMouseEvent<HTMLButtonElement>) {
    const stageRect = canvasStageRef.current?.getBoundingClientRect();

    if (!stageRect) {
      return;
    }

    event.preventDefault();
    event.stopPropagation();
    canvasDragStateRef.current = {
      kind: "timeline-end",
      stageTop: stageRect.top
    };
  }

  function beginNodeResize(
    nodeId: string,
    direction: NodeResizeDirection,
    event: ReactMouseEvent<HTMLButtonElement>
  ) {
    const nodeSize = getNodeSize(nodeSizes, nodeId);
    const nodePlacement = nodePlacements.get(nodeId);

    if (!nodePlacement) {
      return;
    }

    event.preventDefault();
    event.stopPropagation();
    setSelectedNodeId(nodeId);
    canvasDragStateRef.current = {
      currentX: nodePlacement.x,
      currentY: nodePlacement.y,
      direction,
      initialHeight: nodeSize.height,
      initialWidth: nodeSize.width,
      initialX: nodePlacement.x,
      initialY: nodePlacement.y,
      kind: "node-resize",
      nodeId,
      pointerStartX: event.clientX,
      pointerStartY: event.clientY
    };
  }

  function beginRewireDrag(nodeId: string, event: ReactMouseEvent<HTMLButtonElement>) {
    const stagePoint = getStagePointFromClient(event.clientX, event.clientY);

    if (!stagePoint) {
      return;
    }

    event.preventDefault();
    event.stopPropagation();
    setSelectedNodeId(nodeId);
    setRewireNodeId(nodeId);
    rewireHoverTargetIdRef.current = null;
    setRewireHoverTargetId(null);
    setRewirePreviewPoint({
      x: stagePoint.x,
      y: stagePoint.y
    });
    canvasDragStateRef.current = {
      kind: "rewire-drag",
      nodeId,
      stageLeft: stagePoint.stageRect.left,
      stageTop: stagePoint.stageRect.top
    };
  }

  async function syncObjectMentionsForNode(nodeId: string, rawText: string) {
    const mentionNames = extractObjectMentionNames(rawText);
    const liveSnapshot = controller.getState()?.snapshot ?? snapshot;
    const currentNode =
      liveSnapshot.nodes.find((node) => node.id === nodeId) ?? nodesById.get(nodeId) ?? null;
    const mentionEpisodeId = currentNode?.episodeId ?? activeEpisodeId;
    const existingObjectIdsByName = new Map(
      liveSnapshot.objects
        .filter((object) => object.episodeId === mentionEpisodeId)
        .map((object) => [object.name.toLowerCase(), object.id])
    );
    const nextObjectIds: string[] = [];

    for (const mentionName of mentionNames) {
      const normalizedName = mentionName.toLowerCase();
      let objectId = existingObjectIdsByName.get(normalizedName) ?? null;

      if (!objectId) {
        const pendingKey = `${mentionEpisodeId ?? "no-episode"}:${normalizedName}`;
        const pendingObjectPromise = pendingMentionObjectIdsRef.current.get(pendingKey);

        if (pendingObjectPromise) {
          objectId = await pendingObjectPromise;
        } else {
          const createObjectPromise = controller
            .createObject({
              category: "thing",
              name: mentionName,
              summary: ""
            })
            .finally(() => {
              pendingMentionObjectIdsRef.current.delete(pendingKey);
            });

          pendingMentionObjectIdsRef.current.set(pendingKey, createObjectPromise);
          objectId = await createObjectPromise;
        }

        if (objectId) {
          existingObjectIdsByName.set(normalizedName, objectId);
        }
      }

      if (objectId && !nextObjectIds.includes(objectId)) {
        nextObjectIds.push(objectId);
      }
    }

    const currentObjectIds = currentNode?.objectIds ?? [];

    for (const objectId of currentObjectIds) {
      if (!nextObjectIds.includes(objectId)) {
        await controller.detachObjectFromNode(nodeId, objectId);
      }
    }

    for (const objectId of nextObjectIds) {
      if (!currentObjectIds.includes(objectId)) {
        await controller.attachObjectToNode(nodeId, objectId);
      }
    }
  }

  function syncInlineObjectMentions(nodeId: string, rawText: string) {
    const nextSignature = getObjectMentionSignature(rawText);

    if (inlineMentionSignatureRef.current[nodeId] === nextSignature) {
      return;
    }

    inlineMentionSignatureRef.current[nodeId] = nextSignature;
    void syncObjectMentionsForNode(nodeId, rawText);
  }

  function updateObjectMentionQueryFromInput(
    input: HTMLTextAreaElement,
    value = input.value
  ) {
    const caretIndex = input.selectionStart ?? value.length;
    const nextQuery =
      getOpenObjectMentionQuery(value, caretIndex) ??
      getClosedObjectWordQuery(value, caretIndex, activeEpisodeObjects);

    setObjectMentionQuery(nextQuery);

    if (!nextQuery) {
      setObjectMentionMenuPosition(null);
      setActiveObjectMentionIndex(0);
      return;
    }

    setObjectMentionMenuPosition(getMentionPopoverPosition(input.getBoundingClientRect()));
    setActiveObjectMentionIndex(0);
  }

  function syncTimelineEndAfterEndNodeResize(
    nodeId: string,
    nextSize: NodeSize
  ) {
    if (nodeId !== endMajorNodeIdRef.current) {
      return;
    }

    const nextLowestBottom = Math.max(
      0,
      ...visibleNodesRef.current.map((node) => {
        const placement = nodePlacementsRef.current.get(node.id);
        const size = node.id === nodeId ? nextSize : getNodeSize(nodeSizesRef.current, node.id);

        return (placement?.y ?? 0) + size.height;
      })
    );

    setTimelineEndY(Math.max(timelineStartY + 120, nextLowestBottom));
  }

  function syncSelectedNodeInputHeight(
    nodeId: string,
    input: HTMLTextAreaElement | null
  ) {
    if (!input) {
      return;
    }

    input.style.height = "0px";
    input.style.height = `${Math.max(28, input.scrollHeight)}px`;

    const requiredHeight = Math.max(nodeCardHeight, Math.ceil(input.scrollHeight + 30));
    contentMinHeightsRef.current[nodeId] = requiredHeight;
    let syncedEndNodeSize: NodeSize | null = null;

    setNodeSizes((current) => {
      const existing = getNodeSize(current, nodeId);
      const isManuallySized = manuallySizedNodeIdsRef.current.has(nodeId);

      if (isManuallySized && requiredHeight <= existing.height) {
        return current;
      }

      const nextHeight = Math.max(requiredHeight, isManuallySized ? existing.height : requiredHeight);

      if (nextHeight === existing.height) {
        return current;
      }

      syncedEndNodeSize = {
        ...existing,
        height: nextHeight
      };

      return {
        ...current,
        [nodeId]: syncedEndNodeSize
      };
    });

    if (syncedEndNodeSize) {
      syncTimelineEndAfterEndNodeResize(nodeId, syncedEndNodeSize);
    }
  }

  function applyObjectMentionSelection(
    objectName: string,
    trailingText = ""
  ) {
    if (!objectMentionQuery || !selectedNode) {
      return;
    }

    const mentionText = `${getObjectToken(objectName)}${trailingText}`;
    const nextText = `${inlineNodeTextDraft.slice(0, objectMentionQuery.start)}${mentionText}${inlineNodeTextDraft.slice(objectMentionQuery.end)}`;
    const nextCaret = objectMentionQuery.start + mentionText.length;

    setInlineNodeTextDraft(nextText);
    setObjectMentionQuery(null);
    setObjectMentionMenuPosition(null);
    setActiveObjectMentionIndex(0);
    syncInlineObjectMentions(selectedNode.id, nextText);

    window.requestAnimationFrame(() => {
      selectedNodeInputRef.current?.focus();
      selectedNodeInputRef.current?.setSelectionRange(nextCaret, nextCaret);
      syncSelectedNodeInputHeight(selectedNode.id, selectedNodeInputRef.current);
    });
  }

  function finalizeOpenObjectMention(trailingText: string) {
    if (!objectMentionQuery || objectMentionQuery.mode !== "mention" || !selectedNode) {
      return false;
    }

    const mentionName =
      objectMentionSuggestions[activeObjectMentionIndex]?.name ??
      objectMentionQuery.query.trim();

    if (!mentionName) {
      return false;
    }

    applyObjectMentionSelection(mentionName, trailingText);
    return true;
  }

  async function placeDraft(
    level: StoryNodeLevel,
    placement: {
      x: number;
      y: number;
    }
  ) {
    if (isBusy) {
      return;
    }

    const resolvedPlacement = resolveNodeOverlapPlacement(
      null,
      placement,
      {
        height: nodeCardHeight,
        width: nodeCardWidth
      },
      nodePlacements,
      nodeSizes,
      orderedNodes.filter((entry) => entry.level === level).map((entry) => entry.id)
    );

    const createdNodeId = await controller.createNode(
      level,
      getInsertIndexForCanvasY(resolvedPlacement.y),
      {
        canvasX: resolvedPlacement.x,
        canvasY: resolvedPlacement.y
      }
    );

    if (createdNodeId) {
      shouldFocusSelectedNodeRef.current = true;
      setSelectedNodeId(createdNodeId);
      setInlineNodeTextDraft("");
      setRewireNodeId(level === "major" ? null : createdNodeId);
    }

    setDraftVisible(false);
  }

  async function moveNodeFreely(
    nodeId: string,
    level: StoryNodeLevel,
    placement: {
      x: number;
      y: number;
    }
  ) {
    if (isBusy) {
      return;
    }

    if (nodesById.get(nodeId)?.isFixed) {
      return;
    }

    const resolvedPlacement = resolveNodeOverlapPlacement(
      nodeId,
      placement,
      getNodeSize(nodeSizes, nodeId),
      nodePlacements,
      nodeSizes,
      visibleNodes.filter((entry) => entry.level === level).map((entry) => entry.id)
    );
    const nodeSize = getNodeSize(nodeSizes, nodeId);

    if (level === "major") {
      const requiredTimelineEndY =
        nodeId === endMajorNodeId
          ? Math.max(timelineStartY + 120, resolvedPlacement.y + nodeSize.height)
          : timelineEndY;
      const dynamicTimelineAnchors = getTimelineAnchorPositions(
        requiredTimelineEndY,
        laneCanvasBounds.major,
        nodeSize
      );
      const snappedPlacement = snapMajorNodePlacementToTimelineAnchors(
        level,
        resolvedPlacement,
        dynamicTimelineAnchors,
        nodeSize
      );

      if (nodeId === endMajorNodeId) {
        const nextLowestBottom = getProjectedLowestNodeBottom(
          nodeId,
          snappedPlacement,
          nodeSize
        );

        setTimelineEndY(
          Math.max(
            timelineStartY + 120,
            Math.max(nextLowestBottom, snappedPlacement.y + nodeSize.height)
          )
        );
      }

      await controller.updateNodePlacement(nodeId, {
        canvasX: snappedPlacement.x,
        canvasY: snappedPlacement.y
      });
      setSelectedNodeId(nodeId);
      setRewireNodeId(null);
      return;
    }

    const nextLowestBottom = getProjectedLowestNodeBottom(nodeId, resolvedPlacement, nodeSize);
    setTimelineEndY(Math.max(timelineStartY + 120, nextLowestBottom));

    await controller.updateNodePlacement(nodeId, {
      canvasX: resolvedPlacement.x,
      canvasY: resolvedPlacement.y
    });
    setSelectedNodeId(nodeId);
    setRewireNodeId(null);
  }

  async function handleLaneClick(
    level: StoryNodeLevel,
    event: ReactMouseEvent<HTMLElement>
  ) {
    if (!draftVisible) {
      if (event.target === event.currentTarget && !isInteractiveTarget(event.target)) {
        setSelectedNodeId(null);
        setRewireNodeId(null);
        closeNodeMenu();
        setObjectMentionQuery(null);
        setObjectMentionMenuPosition(null);
      }

      return;
    }

    const placement = getPlacementFromPointer(level, event.clientX, event.clientY);

    if (!placement) {
      return;
    }

    await placeDraft(level, placement);
  }

  async function handleCanvasStageDrop(event: DragEvent<HTMLElement>) {
    if (!dragPayload) {
      return;
    }

    event.preventDefault();

    if (dragPayload.kind === "draft") {
      const draftLevel = getLaneLevelFromClientX(event.clientX);
      const placement = getPlacementFromPointer(draftLevel, event.clientX, event.clientY);

      if (!placement) {
        return;
      }

      await placeDraft(draftLevel, placement);
      setDragPayload(null);
      return;
    }

    const placement = getFreePlacementFromPointer(
      dragPayload.level,
      event.clientX,
      event.clientY,
      getNodeSize(nodeSizes, dragPayload.nodeId)
    );

    if (!placement) {
      return;
    }

    await moveNodeFreely(dragPayload.nodeId, dragPayload.level, placement);
    setDragPayload(null);
  }

  async function persistInlineNodeContent(
    node: StoryNode,
    nextText: string,
    nextKeywords: string[]
  ) {
    const resolvedText = normalizeInlineObjectMentions(nextText).trim();
    const resolvedKeywords = extractInlineKeywords(resolvedText).length
      ? extractInlineKeywords(resolvedText)
      : nextKeywords;
    const currentNode = nodesById.get(node.id) ?? node;
    const hasKeywordChange =
      currentNode.keywords.length !== resolvedKeywords.length ||
      currentNode.keywords.some((keyword, index) => keyword !== resolvedKeywords[index]);

    if (resolvedText === currentNode.text.trim() && !hasKeywordChange) {
      setInlineNodeTextDraft(resolvedText);
      setSelectedAiKeywords(resolvedKeywords);
      return;
    }

    await controller.updateNodeContent(node.id, {
      contentMode: deriveNodeContentMode(resolvedText, resolvedKeywords),
      keywords: resolvedKeywords,
      text: resolvedText
    });
    await syncObjectMentionsForNode(node.id, resolvedText);
    setInlineNodeTextDraft(resolvedText);
    setSelectedAiKeywords(resolvedKeywords);
    setObjectMentionQuery(null);
    setObjectMentionMenuPosition(null);
    setActiveObjectMentionIndex(0);
  }

  async function openKeywordSuggestions(
    node: StoryNode,
    options?: { refresh?: boolean }
  ) {
    const parentNode = node.parentId ? nodesById.get(node.parentId) ?? null : null;
    const inlineDraft = buildInlineEditorText(node.text, node.keywords);
    const nextSelectedKeywords = extractInlineKeywords(inlineDraft);
    const liveSelectedKeywords =
      options?.refresh && aiPanelNodeId === node.id ? selectedAiKeywords : nextSelectedKeywords;

    setAiPanelNodeId(node.id);
    setKeywordSuggestions([]);
    setSelectedAiKeywords(liveSelectedKeywords);
    setKeywordCloudPinnedKeywords(liveSelectedKeywords);
    setKeywordRefreshCycle((current) => (options?.refresh ? current + 1 : 0));
    setRecommendationError(null);
    setIsLoadingKeywords(true);
    window.requestAnimationFrame(() => {
      centerCanvasViewportOnNode(node.id, "smooth", 240);
    });

    try {
      const response = await recommendationClient.getKeywordSuggestions(
        createKeywordRecommendationRequest(snapshot, node, parentNode)
      );

      setKeywordSuggestions(response.suggestions);
    } catch (error) {
      setRecommendationError(toMessage(error));
    } finally {
      setIsLoadingKeywords(false);
    }
  }

  async function toggleAiKeyword(node: StoryNode, keyword: string) {
    const baseText =
      selectedNode?.id === node.id
        ? inlineNodeTextDraft
        : buildInlineEditorText(node.text, node.keywords);
    const selectionStart = selectedNodeInputRef.current?.selectionStart ?? baseText.length;
    const selectionEnd = selectedNodeInputRef.current?.selectionEnd ?? selectionStart;
    const { nextText } = toggleInlineKeywordToken(
      baseText,
      keyword,
      selectionStart,
      selectionEnd
    );
    const nextKeywords = extractInlineKeywords(nextText);

    setInlineNodeTextDraft(nextText);
    setSelectedAiKeywords(nextKeywords);
    setRecommendationError(null);
    await persistInlineNodeContent(node, nextText, nextKeywords);

    if (selectedNode?.id === node.id) {
      window.requestAnimationFrame(() => {
        syncSelectedNodeInputHeight(node.id, selectedNodeInputRef.current);
      });
    }
  }
  const objectUsageCounts = new Map(
    activeEpisodeObjects.map((object) => [
      object.id,
      orderedNodes.filter((node) => node.objectIds.includes(object.id)).length
    ])
  );
  const filteredObjects = activeEpisodeObjects.filter((object) => {
    const query = objectSearchQuery.trim().toLowerCase();

    if (!query) {
      return true;
    }

    return (
      object.name.toLowerCase().includes(query) ||
      object.summary.toLowerCase().includes(query) ||
      object.category.toLowerCase().includes(query)
    );
  });
  const sortedObjects = [...filteredObjects].sort((left, right) => {
    const leftPinned = pinnedObjectIds.includes(left.id);
    const rightPinned = pinnedObjectIds.includes(right.id);

    if (leftPinned !== rightPinned) {
      return leftPinned ? -1 : 1;
    }

    const leftUsage = objectUsageCounts.get(left.id) ?? 0;
    const rightUsage = objectUsageCounts.get(right.id) ?? 0;

    switch (objectSortMode) {
      case "oldest":
        return left.createdAt.localeCompare(right.createdAt);
      case "name-asc":
        return left.name.localeCompare(right.name);
      case "name-desc":
        return right.name.localeCompare(left.name);
      case "usage-asc":
        return leftUsage === rightUsage
          ? left.name.localeCompare(right.name)
          : leftUsage - rightUsage;
      case "usage-desc":
        return leftUsage === rightUsage
          ? left.name.localeCompare(right.name)
          : rightUsage - leftUsage;
      case "recent":
      default:
        return right.createdAt.localeCompare(left.createdAt);
    }
  });
  const objectMentionSuggestions =
    objectMentionQuery === null
      ? []
      : activeEpisodeObjects
          .filter((object) =>
            objectMentionQuery.mode === "word"
              ? object.name.toLowerCase() === objectMentionQuery.query.trim().toLowerCase()
              : objectMentionQuery.query.trim()
                ? object.name
                    .toLowerCase()
                    .startsWith(objectMentionQuery.query.trim().toLowerCase())
                : true
          )
          .sort((left, right) => left.name.localeCompare(right.name))
          .slice(0, 8);
  const displayedKeywordSuggestions = buildDisplayedKeywordSuggestions(
    keywordCloudPinnedKeywords,
    keywordSuggestions,
    keywordRefreshCycle
  );
  const orderedMajorNodes = orderedNodes.filter((node) => node.level === "major");
  const startMajorNodeId =
    orderedMajorNodes.find((node) => {
      const placement = nodePlacements.get(node.id);

      return placement ? Math.abs(placement.y - timelineAnchors.startNodeY) <= 0.5 : false;
    })?.id ?? null;
  const endMajorNodeId =
    [...orderedMajorNodes]
      .reverse()
      .find((node) => {
        const placement = nodePlacements.get(node.id);
        const nodeSize = getNodeSize(nodeSizes, node.id);

        return placement
          ? Math.abs(
              placement.y + nodeSize.height - effectiveTimelineEndY
            ) <= 0.5
          : false;
      })?.id ?? null;

  nodePlacementsRef.current = nodePlacements;
  visibleNodesRef.current = visibleNodes;
  nodeSizesRef.current = nodeSizes;
  endMajorNodeIdRef.current = endMajorNodeId;
  selectedNodeIdRef.current = selectedNodeId;

  const renderedNodes = visibleNodes.map((node) => {
    const nodeSize = getNodeSize(nodeSizes, node.id);
    const isSelected = selectedNode?.id === node.id;
    const isRewireSource = rewireNode?.id === node.id;
    const isRewireTarget = candidateParentIds.has(node.id);
    const isHoveredRewireTarget = rewireHoverTargetId === node.id;
    const isStartMajorNode = node.id === startMajorNodeId;
    const isEndMajorNode = node.id === endMajorNodeId;
    const placement =
      nodePlacements.get(node.id) ??
      getFallbackNodePlacementWithinBounds(node, orderedNodes, laneCanvasBounds, nodeSize);
    const activeKeywords = isSelected ? selectedAiKeywords : node.keywords;
    const displayText = isSelected ? inlineNodeTextDraft : node.text;
    const hasVisibleKeywords = activeKeywords.length > 0;
    const displayBodyText = extractDisplayText(displayText);
    const shouldShowPlaceholder = !isSelected && !displayBodyText && !hasVisibleKeywords;
    const selectedNodeTitle =
      extractDisplayText(displayText) || activeKeywords.join(" ") || getNodeHeadline(node);

    return (
      <article
        className={`node-card node-card-level-${node.level} node-card-${node.contentMode}${isSelected ? " is-selected" : ""}${isRewireSource ? " is-rewire-source" : ""}${isRewireTarget ? " is-rewire-target" : ""}${isHoveredRewireTarget ? " is-rewire-hover-target" : ""}${node.isImportant ? " is-important" : ""}${node.isFixed ? " is-fixed" : ""}${node.isCollapsed ? " is-collapsed" : ""}${isStartMajorNode ? " is-start-node" : ""}${isEndMajorNode ? " is-end-node" : ""}${aiPanelNode?.id === node.id ? " has-keyword-cloud" : ""}`}
        data-testid={`node-${node.id}`}
        draggable={!isBusy && !node.isFixed}
        key={node.id}
        onClick={() => {
          if (isRewireTarget && rewireNode) {
            void controller.rewireNode(rewireNode.id, node.id);
            setSelectedNodeId(rewireNode.id);
            setRewireNodeId(null);
            rewireHoverTargetIdRef.current = null;
            setRewireHoverTargetId(null);
            setRewirePreviewPoint(null);
            return;
          }

          shouldFocusSelectedNodeRef.current = true;
          setSelectedNodeId(node.id);
        }}
        onDoubleClick={(event) => {
          if (isInteractiveTarget(event.target)) {
            return;
          }

          shouldFocusSelectedNodeRef.current = true;
          setSelectedNodeId(node.id);
          centerCanvasViewportOnNode(node.id);
        }}
        onDragEnd={() => {
          setDragPayload(null);
        }}
        onDragStart={(event) => {
          if (node.isFixed) {
            event.preventDefault();
            return;
          }

          event.dataTransfer.effectAllowed = "move";
          event.dataTransfer.setData("text/plain", node.id);
          setSelectedNodeId(node.id);
          rewireHoverTargetIdRef.current = null;
          setRewireHoverTargetId(null);
          setRewirePreviewPoint(null);
          setRewireNodeId(null);
          setDragPayload({
            kind: "node",
            level: node.level,
            nodeId: node.id
          });
        }}
        ref={(element) => {
          if (element) {
            nodeCardRefs.current.set(node.id, element);
          } else {
            nodeCardRefs.current.delete(node.id);
          }
        }}
        style={{
          left: `${placement.x}px`,
          top: `${placement.y}px`,
          height: `${nodeSize.height}px`,
          width: `${nodeSize.width}px`
        } as CSSProperties}
      >
        <div className="node-card-header">
          <span className="visually-hidden">{node.level} node</span>
          <div className="node-header-actions">
            <button
              aria-label={node.isCollapsed ? copy.persistence.unfold : copy.persistence.fold}
              className="button-secondary node-header-button"
              disabled={isBusy}
              onClick={(event) => {
                event.stopPropagation();
                void controller.updateNodeVisualState(node.id, {
                  isCollapsed: !(node.isCollapsed ?? false)
                });
              }}
              type="button"
            >
              {node.isCollapsed ? ">" : "<"}
            </button>
            <div className="node-menu-shell">
              <button
                aria-expanded={isSelected && isNodeMoreMenuOpen}
                aria-label={`${copy.persistence.more} ${getNodeHeadline(node)}`}
                className="button-secondary node-header-button node-more-button"
                onClick={(event) => {
                  event.stopPropagation();
                  const nextOpen = !(isSelected && isNodeMoreMenuOpen);
                  setSelectedNodeId(node.id);
                  setIsNodeMoreMenuOpen(nextOpen);
                  setNodeMenuPosition(
                    nextOpen
                      ? getViewportMenuPosition(
                          (event.currentTarget as HTMLButtonElement).getBoundingClientRect()
                        )
                      : null
                  );
                }}
                ref={(element) => {
                  if (element) {
                    nodeMenuButtonRefs.current.set(node.id, element);
                  } else {
                    nodeMenuButtonRefs.current.delete(node.id);
                  }
                }}
                type="button"
              >
                ...
              </button>
            </div>
          </div>
        </div>

        <div className="node-card-body">
          {node.contentMode === "text" && activeKeywords.length > 0 ? (
            <span aria-label="AI-assisted node" className="visually-hidden" />
          ) : null}
          <span
            className="visually-hidden"
            data-testid={isSelected ? "selected-node-title" : undefined}
          >
            {selectedNodeTitle}
          </span>
          {isSelected ? (
            <div
              className="node-inline-editor"
              onClick={(event) => {
                event.stopPropagation();
                selectedNodeInputRef.current?.focus();
              }}
            >
              <div className="node-inline-input-shell">
                <div
                  aria-hidden="true"
                  className={`node-inline-preview${
                    !displayBodyText && activeKeywords.length === 0 ? " is-placeholder" : ""
                  }`}
                >
                  {displayText
                    ? renderTextWithObjectMentions(displayText)
                    : activeKeywords.length === 0
                      ? "Type the beat"
                      : "\u200b"}
                </div>
                <textarea
                  className="node-inline-input"
                  onBlur={() => {
                    void persistInlineNodeContent(node, inlineNodeTextDraft, activeKeywords);
                  }}
                  onChange={(event) => {
                    const nextValue = normalizeInlineObjectMentions(event.target.value);
                    const nextCaret = event.target.selectionStart ?? nextValue.length;

                    setInlineNodeTextDraft(nextValue);
                    setSelectedAiKeywords(extractInlineKeywords(nextValue));
                    updateObjectMentionQueryFromInput(event.currentTarget, nextValue);
                    syncSelectedNodeInputHeight(node.id, event.currentTarget);
                    syncInlineObjectMentions(node.id, nextValue);

                    window.requestAnimationFrame(() => {
                      syncSelectedNodeInputHeight(node.id, selectedNodeInputRef.current);
                    });

                    if (nextValue !== event.target.value) {
                      window.requestAnimationFrame(() => {
                        selectedNodeInputRef.current?.setSelectionRange(nextCaret, nextCaret);
                      });
                    }
                  }}
                  onClick={(event) => {
                    event.stopPropagation();
                    updateObjectMentionQueryFromInput(event.currentTarget);
                  }}
                  onKeyDown={(event) => {
                    const selectionStart = event.currentTarget.selectionStart ?? 0;
                    const selectionEnd = event.currentTarget.selectionEnd ?? 0;
                    const activeMentionSuggestion =
                      objectMentionSuggestions[activeObjectMentionIndex] ?? null;

                    if (selectionStart === selectionEnd) {
                      const removableToken =
                        event.key === "Backspace"
                          ? removeAdjacentInlineToken(inlineNodeTextDraft, selectionStart, "backward")
                          : event.key === "Delete"
                            ? removeAdjacentInlineToken(inlineNodeTextDraft, selectionStart, "forward")
                            : null;

                      if (removableToken) {
                        event.preventDefault();
                        setInlineNodeTextDraft(removableToken.nextText);
                        setSelectedAiKeywords(extractInlineKeywords(removableToken.nextText));
                        syncInlineObjectMentions(node.id, removableToken.nextText);

                        window.requestAnimationFrame(() => {
                          selectedNodeInputRef.current?.focus();
                          selectedNodeInputRef.current?.setSelectionRange(
                            removableToken.nextCaret,
                            removableToken.nextCaret
                          );
                          syncSelectedNodeInputHeight(node.id, selectedNodeInputRef.current);
                        });
                        return;
                      }
                    }

                    if (
                      activeMentionSuggestion &&
                      (event.key === "Enter" ||
                        event.key === "Tab")
                    ) {
                      event.preventDefault();
                      applyObjectMentionSelection(
                        activeMentionSuggestion.name,
                        event.key === "Enter" && objectMentionQuery?.mode === "mention" ? "\n" : ""
                      );
                      return;
                    }

                    if (
                      objectMentionQuery?.mode === "mention" &&
                      (event.key === " " || event.key === "Enter")
                    ) {
                      if (finalizeOpenObjectMention(event.key === "Enter" ? "\n" : " ")) {
                        event.preventDefault();
                        return;
                      }
                    }

                    if (objectMentionSuggestions.length > 0 && event.key === "ArrowDown") {
                      event.preventDefault();
                      setActiveObjectMentionIndex((current) =>
                        Math.min(current + 1, objectMentionSuggestions.length - 1)
                      );
                      return;
                    }

                    if (objectMentionSuggestions.length > 0 && event.key === "ArrowUp") {
                      event.preventDefault();
                      setActiveObjectMentionIndex((current) => Math.max(current - 1, 0));
                      return;
                    }

                    if (objectMentionQuery !== null && event.key === "Escape") {
                      event.preventDefault();
                      setObjectMentionQuery(null);
                      setObjectMentionMenuPosition(null);
                      setActiveObjectMentionIndex(0);
                    }
                  }}
                  onKeyUp={(event) => {
                    updateObjectMentionQueryFromInput(event.currentTarget);
                    syncSelectedNodeInputHeight(node.id, event.currentTarget);
                  }}
                  placeholder={activeKeywords.length > 0 ? undefined : "Type the beat"}
                  ref={selectedNodeInputRef}
                  rows={1}
                  value={inlineNodeTextDraft}
                />
              </div>
            </div>
          ) : displayBodyText || hasVisibleKeywords ? (
            <div className="node-text-flow">
              {displayText ? (
                <span className="node-inline-text">{renderTextWithObjectMentions(displayText)}</span>
              ) : null}
            </div>
          ) : null}
          {shouldShowPlaceholder ? (
            <p className="node-simple-text is-placeholder">{displayText}</p>
          ) : null}
        </div>
        {isSelected ? (
          <>
            {(
              [
                ["northwest", "Resize from top left"],
                ["north", "Resize from top"],
                ["northeast", "Resize from top right"],
                ["east", "Resize from right"],
                ["southeast", "Resize from bottom right"],
                ["south", "Resize from bottom"],
                ["southwest", "Resize from bottom left"],
                ["west", "Resize from left"]
              ] satisfies Array<[NodeResizeDirection, string]>
            ).map(([direction, label]) => (
              <button
                aria-label={label}
                className={`node-resize-handle node-resize-handle-${direction}`}
                key={direction}
                onMouseDown={(event) => {
                  beginNodeResize(node.id, direction, event);
                }}
                type="button"
              />
            ))}
          </>
        ) : null}

        {aiPanelNode?.id === node.id ? (
          <section
            className="recommendation-panel"
            data-testid="keyword-cloud"
            onClick={(event) => {
              event.stopPropagation();
            }}
          >
            <div className="recommendation-panel-header">
              <strong>{copy.persistence.keywordSuggestions}</strong>
              <div className="recommendation-panel-actions">
                <button
                  className="button-secondary"
                  disabled={isLoadingKeywords}
                  onClick={() => {
                    void openKeywordSuggestions(node, { refresh: true });
                  }}
                  type="button"
                >
                  {copy.persistence.keywordRefresh}
                </button>
                <button
                  className="button-secondary"
                  onClick={() => {
                    setAiPanelNodeId(null);
                    setRecommendationError(null);
                  }}
                  type="button"
                >
                  {copy.persistence.cancel}
                </button>
              </div>
            </div>

            {recommendationError ? (
              <p className="recommendation-error">
                {copy.persistence.recommendationFailed}: {recommendationError}
              </p>
            ) : null}

            {isLoadingKeywords ? (
              <p className="support-copy">Loading keyword suggestions...</p>
            ) : displayedKeywordSuggestions.length > 0 ? (
              <div className="keyword-suggestion-grid">
                {displayedKeywordSuggestions.map((suggestion, suggestionIndex) => {
                  const isSelectedKeyword = selectedAiKeywords.includes(suggestion.label);

                  return (
                    <button
                      aria-pressed={isSelectedKeyword}
                      className={`keyword-suggestion${isSelectedKeyword ? " is-selected" : ""}`}
                      data-testid={`keyword-suggestion-${suggestionIndex}`}
                      key={suggestion.label}
                      onClick={() => {
                        void toggleAiKeyword(node, suggestion.label);
                      }}
                      type="button"
                    >
                      <span>{suggestion.label}</span>
                    </button>
                  );
                })}
              </div>
            ) : (
              <p className="support-copy">{copy.persistence.keywordCloudEmpty}</p>
            )}
          </section>
        ) : null}

      </article>
    );
  });
  const rewirePreviewLine =
    rewireNode && rewirePreviewPoint
      ? (() => {
          const sourcePlacement = nodePlacements.get(rewireNode.id);
          const sourceSize = getNodeSize(nodeSizes, rewireNode.id);

          if (!sourcePlacement) {
            return null;
          }

          const hoveredTarget =
            rewireHoverTargetId !== null ? nodesById.get(rewireHoverTargetId) ?? null : null;
          const hoveredPlacement =
            hoveredTarget !== null ? nodePlacements.get(hoveredTarget.id) ?? null : null;
          const hoveredSize =
            hoveredTarget !== null ? getNodeSize(nodeSizes, hoveredTarget.id) : null;
          const startX =
            hoveredPlacement && hoveredSize
              ? hoveredPlacement.x + hoveredSize.width
              : rewirePreviewPoint.x;
          const startY =
            hoveredPlacement && hoveredSize
              ? hoveredPlacement.y + hoveredSize.height / 2
              : rewirePreviewPoint.y;
          const endX = sourcePlacement.x;
          const endY = sourcePlacement.y + sourceSize.height / 2;
          const bendDistance = Math.max(34, Math.abs(endX - startX) * 0.36);
          const curveDirection = endX >= startX ? 1 : -1;
          const firstCurveX = startX + bendDistance * curveDirection;
          const secondCurveX = endX - bendDistance * curveDirection;

          return `M ${startX} ${startY} C ${firstCurveX} ${startY}, ${secondCurveX} ${endY}, ${endX} ${endY}`;
        })()
      : null;
  const deleteEpisodeTarget =
    deleteEpisodeId !== null
      ? snapshot.episodes.find((episode) => episode.id === deleteEpisodeId) ?? null
      : null;
  const profileName =
    state.session.displayName ??
    state.session.accountId ??
    `${copy.workspace.brand} User`;
  const episodeSearchNormalized = episodeSearchQuery.trim().toLowerCase();
  const folderIdByEpisodeId = new Map<string, string>();

  for (const folder of sidebarFolders) {
    for (const episodeId of folder.episodeIds) {
      folderIdByEpisodeId.set(episodeId, folder.id);
    }
  }

  function getScopedPinnedEpisodes(scopeId: string) {
    return folderEpisodePins[scopeId] ?? [];
  }

  function sortEpisodesForScope(episodes: StoryEpisode[], scopeId: string) {
    const pinnedIds = getScopedPinnedEpisodes(scopeId);

    return [...episodes].sort((left, right) => {
      const leftPinned = pinnedIds.includes(left.id);
      const rightPinned = pinnedIds.includes(right.id);

      if (leftPinned !== rightPinned) {
        return leftPinned ? -1 : 1;
      }

      return right.updatedAt.localeCompare(left.updatedAt);
    });
  }

  function sortEpisodesForFolder(
    episodes: StoryEpisode[],
    scopeId: string,
    orderedEpisodeIds: string[]
  ) {
    const pinnedIds = getScopedPinnedEpisodes(scopeId);
    const orderIndexById = new Map(
      orderedEpisodeIds.map((episodeId, index) => [episodeId, index])
    );

    return [...episodes].sort((left, right) => {
      const leftPinned = pinnedIds.includes(left.id);
      const rightPinned = pinnedIds.includes(right.id);

      if (leftPinned !== rightPinned) {
        return leftPinned ? -1 : 1;
      }

      return (orderIndexById.get(left.id) ?? Number.MAX_SAFE_INTEGER) -
        (orderIndexById.get(right.id) ?? Number.MAX_SAFE_INTEGER);
    });
  }

  const rootEpisodes = sortEpisodesForScope(
    snapshot.episodes.filter((episode) => !folderIdByEpisodeId.has(episode.id)),
    rootFolderScopeId
  ).filter((episode) => matchesEpisodeSearch(episode, episodeSearchQuery));

  const visibleFolders = sidebarFolders
    .map((folder) => {
      const folderEpisodes = folder.episodeIds
        .map((episodeId) => snapshot.episodes.find((episode) => episode.id === episodeId) ?? null)
        .filter((episode): episode is StoryEpisode => episode !== null);
      const folderMatches = episodeSearchNormalized
        ? folder.name.toLowerCase().includes(episodeSearchNormalized)
        : true;
      const filteredFolderEpisodes = folderMatches
        ? folderEpisodes
        : folderEpisodes.filter((episode) => matchesEpisodeSearch(episode, episodeSearchQuery));
      const visibleFolderEpisodes = sortEpisodesForFolder(
        filteredFolderEpisodes,
        folder.id,
        folder.episodeIds
      );

      return {
        ...folder,
        visibleEpisodes: visibleFolderEpisodes,
        visibleInSearch:
          !episodeSearchNormalized || folderMatches || visibleFolderEpisodes.length > 0
      };
    })
    .filter((folder) => folder.visibleInSearch)
    .sort((left, right) => {
      if (left.isPinned !== right.isPinned) {
        return left.isPinned ? -1 : 1;
      }

      return right.updatedAt.localeCompare(left.updatedAt);
    });

  function openObjectDetails(objectId: string) {
    setSelectedObjectId(objectId);
    setObjectMenuId(null);
    setObjectMenuPosition(null);
    setDetailMode("object");
    setDetailError(null);
  }

  function openCreateObjectEditor() {
    setObjectMenuId(null);
    setObjectMenuPosition(null);
    setDetailMode("create-object");
    setDetailError(null);
    setObjectEditorDraft({
      category: "person",
      name: "",
      summary: ""
    });
  }

  async function saveObjectDetails() {
    const name = objectEditorDraft.name.trim();

    if (!name) {
      setDetailError("Object name is required.");
      return;
    }

    if (detailMode === "create-object") {
      const nextObjectId = await controller.createObject({
        ...objectEditorDraft,
        name,
        summary: objectEditorDraft.summary.trim()
      });

      if (nextObjectId) {
        setSelectedObjectId(nextObjectId);
        setDetailMode("object");
        setDetailError(null);
      }

      return;
    }

    if (!selectedObject) {
      return;
    }

    await controller.updateObject(selectedObject.id, {
      ...objectEditorDraft,
      name,
      summary: objectEditorDraft.summary.trim()
    });
    setDetailError(null);
  }

  function selectObjectFromLibrary(objectId: string) {
    openObjectDetails(objectId);
  }

  async function restoreDrawerItemToCanvas(itemId: string) {
    await controller.restoreDrawerItem(itemId, orderedNodes.length);
    setIsDrawerOpen(false);
  }

  function handleObjectDraftChange(
    field: keyof StoryObjectDraft,
    value: StoryObjectDraft[keyof StoryObjectDraft]
  ) {
    setObjectEditorDraft((current) => ({
      ...current,
      [field]: value
    }));
  }

  function toggleObjectPin(objectId: string) {
    setObjectMenuId(null);
    setObjectMenuPosition(null);
    setPinnedObjectIds((current) =>
      current.includes(objectId)
        ? current.filter((entry) => entry !== objectId)
        : [...current, objectId]
    );
  }

  async function deleteObjectFromLibrary(objectId: string) {
    const deleted = await controller.deleteObject(objectId);

    if (!deleted) {
      return;
    }

    setPinnedObjectIds((current) => current.filter((entry) => entry !== objectId));

    if (selectedObjectId === objectId) {
      setSelectedObjectId(null);
    }

    setObjectMenuId(null);
    setObjectMenuPosition(null);

    if (detailMode === "object") {
      setDetailMode(null);
    }
  }

  function beginObjectRename(objectId: string) {
    setObjectMenuId(null);
    setObjectMenuPosition(null);
    openObjectDetails(objectId);
  }

  function toggleProfileMenu() {
    setIsFolderCreatorVisible(false);
    setIsEpisodeSearchVisible(false);
    setIsMoreVisible((current) => !current);
  }

  function toggleSidebar() {
    setIsSidebarCollapsed((current) => !current);
  }

  function closeDetailPanel() {
    setDetailMode(null);
    setDetailError(null);
  }

  function closeNodeMenu() {
    setIsNodeMoreMenuOpen(false);
    setNodeMenuPosition(null);
  }

  function getViewportMenuPosition(
    rect: DOMRect,
    direction: "adjacent-inline" | "right-start" = "adjacent-inline"
  ) {
    if (direction === "right-start") {
      return {
        left: Math.min(rect.right, window.innerWidth - 196),
        top: Math.min(Math.max(12, rect.top), window.innerHeight - 220)
      };
    }

    const menuWidth = 176;
    const preferredRight = rect.right;
    const fallbackLeft = rect.left - menuWidth;

    return {
      left:
        preferredRight + menuWidth <= window.innerWidth - 12
          ? preferredRight
          : Math.max(12, fallbackLeft),
      top: Math.min(Math.max(12, rect.top), window.innerHeight - 260)
    };
  }

  async function toggleCanvasFullscreen() {
    const canvasPanel = canvasPanelRef.current;

    if (!canvasPanel) {
      return;
    }

    if (document.fullscreenElement === canvasPanel) {
      await document.exitFullscreen();
      return;
    }

    await canvasPanel.requestFullscreen();
  }

  const nodeMoreMenuOverlay =
    isNodeMoreMenuOpen && selectedNode && nodeMenuPosition
      ? renderViewportOverlay(
          <div
            className="node-more-menu node-more-menu-overlay"
            style={
              {
                left: `${nodeMenuPosition.left}px`,
                top: `${nodeMenuPosition.top}px`
              } as CSSProperties
            }
          >
            {selectedNode.level !== "major" ? (
              <button
                className="button-secondary"
                disabled={isBusy}
                onClick={() => {
                  setRewireNodeId((current) => (current === selectedNode.id ? null : selectedNode.id));
                  closeNodeMenu();
                }}
                type="button"
              >
                {copy.persistence.rewire}
              </button>
            ) : null}
            <button
              className="button-secondary"
              disabled={isBusy}
              onClick={() => {
                void openKeywordSuggestions(selectedNode);
                closeNodeMenu();
              }}
              type="button"
            >
              {copy.persistence.keywordSuggestions}
            </button>
            <button
              aria-pressed={selectedNode.isImportant ?? false}
              className="button-secondary"
              onClick={() => {
                void controller.updateNodeVisualState(selectedNode.id, {
                  isImportant: !(selectedNode.isImportant ?? false)
                });
                closeNodeMenu();
              }}
              type="button"
            >
              {copy.persistence.important}
            </button>
            <button
              aria-pressed={selectedNode.isFixed ?? false}
              className="button-secondary"
              onClick={() => {
                void controller.updateNodeVisualState(selectedNode.id, {
                  isFixed: !(selectedNode.isFixed ?? false)
                });
                closeNodeMenu();
              }}
              type="button"
            >
              {selectedNode.isFixed ? copy.persistence.unfix : copy.persistence.fixed}
            </button>
            <button
              className="button-secondary"
              disabled={isBusy}
              onClick={() => {
                setDeleteTargetId(selectedNode.id);
                setRewireNodeId(null);
                closeNodeMenu();
              }}
              type="button"
            >
              {copy.persistence.delete}
            </button>
          </div>
        )
      : null;

  const objectMentionOverlay =
    selectedNode &&
    objectMentionQuery &&
    objectMentionMenuPosition &&
    objectMentionSuggestions.length > 0
      ? renderViewportOverlay(
          <section
            className="object-mention-menu"
            style={
              {
                left: `${objectMentionMenuPosition.left}px`,
                top: `${objectMentionMenuPosition.top}px`
              } as CSSProperties
            }
          >
            {objectMentionSuggestions.map((object, index) => (
              <button
                aria-selected={activeObjectMentionIndex === index}
                className={`button-secondary object-mention-option${
                  activeObjectMentionIndex === index ? " is-active" : ""
                }`}
                key={object.id}
                onMouseDown={(event) => {
                  event.preventDefault();
                  applyObjectMentionSelection(object.name);
                }}
                type="button"
              >
                {objectMentionQuery.mode === "word"
                  ? `Use "${object.name}" as object`
                  : object.name}
              </button>
            ))}
          </section>
        )
      : null;

  const detailPanel =
    detailMode !== null ? (
      <aside
        className={`panel panel-details${isCanvasFullscreen ? " panel-details-floating" : ""}`}
      >
        <div className="detail-panel-header">
          <span className="visually-hidden">{copy.workspace.details}</span>
          <button
            aria-label={copy.persistence.closeDetails}
            className="button-secondary detail-close-button"
            onClick={closeDetailPanel}
            type="button"
          >
            x
          </button>
        </div>

        {detailError ? <p className="recommendation-error">{detailError}</p> : null}

        {detailMode === "object" && selectedObject ? (
          <form
            className="detail-editor"
            data-testid="detail-editor"
            onSubmit={(event) => {
              event.preventDefault();
              void saveObjectDetails();
            }}
          >
            <label className="field-stack">
              <span>{copy.workspace.objectName}</span>
              <input
                onChange={(event) => {
                  handleObjectDraftChange("name", event.target.value);
                }}
                type="text"
                value={objectEditorDraft.name}
              />
            </label>
            <label className="field-stack">
              <span>{copy.workspace.objectCategory}</span>
              <select
                onChange={(event) => {
                  handleObjectDraftChange(
                    "category",
                    event.target.value as StoryObjectCategory
                  );
                }}
                value={objectEditorDraft.category}
              >
                {objectCategoryOptions.map((category) => (
                  <option key={category} value={category}>
                    {formatObjectCategory(category)}
                  </option>
                ))}
              </select>
            </label>
            <label className="field-stack">
              <span>{copy.workspace.objectSummary}</span>
              <textarea
                onChange={(event) => {
                  handleObjectDraftChange("summary", event.target.value);
                }}
                rows={4}
                value={objectEditorDraft.summary}
              />
            </label>
            <div className="control-row">
              <button type="submit">{copy.persistence.saveObject}</button>
            </div>
          </form>
        ) : detailMode === "create-object" ? (
          <form
            className="detail-editor"
            data-testid="detail-editor"
            onSubmit={(event) => {
              event.preventDefault();
              void saveObjectDetails();
            }}
          >
            <label className="field-stack">
              <span>{copy.workspace.objectName}</span>
              <input
                onChange={(event) => {
                  handleObjectDraftChange("name", event.target.value);
                }}
                placeholder="Heroine's Mother"
                type="text"
                value={objectEditorDraft.name}
              />
            </label>
            <label className="field-stack">
              <span>{copy.workspace.objectCategory}</span>
              <select
                onChange={(event) => {
                  handleObjectDraftChange(
                    "category",
                    event.target.value as StoryObjectCategory
                  );
                }}
                value={objectEditorDraft.category}
              >
                {objectCategoryOptions.map((category) => (
                  <option key={category} value={category}>
                    {formatObjectCategory(category)}
                  </option>
                ))}
              </select>
            </label>
            <label className="field-stack">
              <span>{copy.workspace.objectSummary}</span>
              <textarea
                onChange={(event) => {
                  handleObjectDraftChange("summary", event.target.value);
                }}
                placeholder="Relationship pressure, location note, or prop detail."
                rows={4}
                value={objectEditorDraft.summary}
              />
            </label>
            <div className="control-row">
              <button type="submit">{copy.workspace.createObject}</button>
            </div>
          </form>
        ) : null}
      </aside>
    ) : null;

  function openSidebarAndSearch() {
    setIsSidebarCollapsed(false);
    setIsEpisodeSearchVisible(true);
    setIsFolderCreatorVisible(false);
    setIsMoreVisible(false);
  }

  function toggleEpisodePin(episodeId: string) {
    const scopeId = folderIdByEpisodeId.get(episodeId) ?? rootFolderScopeId;

    setFolderEpisodePins((current) => {
      const scopedPins = current[scopeId] ?? [];
      const nextScopedPins = scopedPins.includes(episodeId)
        ? scopedPins.filter((entry) => entry !== episodeId)
        : [...scopedPins, episodeId];

      return {
        ...current,
        [scopeId]: nextScopedPins
      };
    });
    setEpisodeMenuId(null);
    setEpisodeMenuPosition(null);
  }

  function beginEpisodeRename(episode: StoryEpisode) {
    setEpisodeMenuId(null);
    setEpisodeMenuPosition(null);
    setRenamingEpisodeId(episode.id);
    setEpisodeRenameDraft(episode.title);
  }

  async function submitEpisodeRename() {
    if (!renamingEpisodeId) {
      return;
    }

    await controller.renameEpisode(renamingEpisodeId, episodeRenameDraft);
    setRenamingEpisodeId(null);
    setEpisodeRenameDraft("");
  }

  async function createEpisodeFromSidebar() {
    const nextEpisodeId = await controller.createEpisode();

    if (!nextEpisodeId) {
      return;
    }

    setIsSidebarCollapsed(false);
    setIsEpisodeSearchVisible(false);
    setIsFolderCreatorVisible(false);
    setIsMoreVisible(false);
  }

  function toggleFolderCreator() {
    setIsMoreVisible(false);
    setIsEpisodeSearchVisible(false);
    setIsFolderCreatorVisible((current) => !current);
  }

  function createFolderFromSidebar() {
    const name = folderNameDraft.trim();

    if (!name) {
      return;
    }

    const timestamp = new Date().toISOString();
    setSidebarFolders((current) => [
      {
        createdAt: timestamp,
        episodeIds: [],
        id: `folder_${crypto.randomUUID()}`,
        isCollapsed: false,
        isPinned: false,
        name,
        updatedAt: timestamp
      },
      ...current
    ]);
    setFolderNameDraft("");
    setIsFolderCreatorVisible(false);
    setIsSidebarCollapsed(false);
  }

  function assignEpisodeToFolder(episodeId: string, folderId: string) {
    setSidebarFolders((current) => {
      const timestamp = new Date().toISOString();
      const targetFolder = current.find((folder) => folder.id === folderId);

      if (targetFolder?.episodeIds.includes(episodeId)) {
        return current;
      }

      return current.map((folder) => {
        const nextEpisodeIds = folder.episodeIds.filter((entry) => entry !== episodeId);

        if (folder.id === folderId) {
          nextEpisodeIds.unshift(episodeId);
        }

        return {
          ...folder,
          episodeIds: nextEpisodeIds,
          isCollapsed: folder.id === folderId ? false : folder.isCollapsed,
          updatedAt:
            folder.id === folderId || folder.episodeIds.includes(episodeId)
              ? timestamp
              : folder.updatedAt
        };
      });
    });
    setEpisodeMenuId(null);
    setEpisodeMenuPosition(null);
    setFolderPickerEpisodeId(null);
    setFolderPickerPosition(null);
  }

  function dissolveEpisodeFromFolder(episodeId: string) {
    setSidebarFolders((current) =>
      current.map((folder) => ({
        ...folder,
        episodeIds: folder.episodeIds.filter((entry) => entry !== episodeId)
      }))
    );
    setEpisodeMenuId(null);
    setEpisodeMenuPosition(null);
    setFolderPickerEpisodeId(null);
    setFolderPickerPosition(null);
  }

  function toggleEpisodeInFolderPicker(folderId: string, episodeId: string) {
    setSidebarFolders((current) => {
      const timestamp = new Date().toISOString();
      const targetFolder = current.find((folder) => folder.id === folderId);
      const isAlreadyInFolder = targetFolder?.episodeIds.includes(episodeId) ?? false;

      return current.map((folder) => {
        const nextEpisodeIds = folder.episodeIds.filter((entry) => entry !== episodeId);

        if (folder.id === folderId && !isAlreadyInFolder) {
          nextEpisodeIds.unshift(episodeId);
        }

        return {
          ...folder,
          episodeIds: nextEpisodeIds,
          updatedAt:
            folder.id === folderId || folder.episodeIds.includes(episodeId)
              ? timestamp
              : folder.updatedAt
        };
      });
    });
  }

  function toggleFolderSort(folderId: string) {
    setSortingFolderId((current) => (current === folderId ? null : folderId));
  }

  function toggleFolderPin(folderId: string) {
    setSidebarFolders((current) =>
      current.map((folder) =>
        folder.id === folderId
          ? {
              ...folder,
              isPinned: !folder.isPinned,
              updatedAt: new Date().toISOString()
            }
          : folder
      )
    );
    setFolderMenuId(null);
    setFolderMenuPosition(null);
    setFolderEpisodePickerFolderId(null);
    setFolderEpisodePickerPosition(null);
  }

  function toggleFolderCollapsed(folderId: string) {
    setSidebarFolders((current) =>
      current.map((folder) =>
        folder.id === folderId
          ? {
              ...folder,
              isCollapsed: !folder.isCollapsed
            }
          : folder
      )
    );
    setFolderMenuId(null);
    setFolderMenuPosition(null);
    setFolderEpisodePickerFolderId(null);
    setFolderEpisodePickerPosition(null);
  }

  function beginFolderRename(folder: SidebarFolder) {
    setFolderMenuId(null);
    setFolderMenuPosition(null);
    setFolderEpisodePickerFolderId(null);
    setFolderEpisodePickerPosition(null);
    setRenamingFolderId(folder.id);
    setFolderRenameDraft(folder.name);
  }

  function submitFolderRename(folderId: string) {
    const name = folderRenameDraft.trim();

    if (!name) {
      return;
    }

    setSidebarFolders((current) =>
      current.map((folder) =>
        folder.id === folderId
          ? {
              ...folder,
              name,
              updatedAt: new Date().toISOString()
            }
          : folder
      )
    );
    setRenamingFolderId(null);
    setFolderRenameDraft("");
  }

  function deleteFolder(folderId: string) {
    setSidebarFolders((current) => current.filter((folder) => folder.id !== folderId));
    setFolderEpisodePins((current) => {
      const next = { ...current };
      delete next[folderId];
      return next;
    });
    if (sortingFolderId === folderId) {
      setSortingFolderId(null);
    }
    setFolderMenuId(null);
    setFolderMenuPosition(null);
    setFolderEpisodePickerFolderId(null);
    setFolderEpisodePickerPosition(null);
  }

  function reorderEpisodeWithinFolder(
    folderId: string,
    draggedEpisodeId: string,
    targetEpisodeId: string
  ) {
    if (draggedEpisodeId === targetEpisodeId) {
      return;
    }

    setSidebarFolders((current) =>
      current.map((folder) => {
        if (folder.id !== folderId) {
          return folder;
        }

        const nextEpisodeIds = folder.episodeIds.filter((entry) => entry !== draggedEpisodeId);
        const targetIndex = nextEpisodeIds.indexOf(targetEpisodeId);

        if (targetIndex === -1) {
          nextEpisodeIds.push(draggedEpisodeId);
        } else {
          nextEpisodeIds.splice(targetIndex, 0, draggedEpisodeId);
        }

        return {
          ...folder,
          episodeIds: nextEpisodeIds,
          updatedAt: new Date().toISOString()
        };
      })
    );
  }

  async function selectEpisodeFromSidebar(episodeId: string) {
    await controller.selectEpisode(episodeId);
    setEpisodeMenuId(null);
    setEpisodeMenuPosition(null);
    setFolderPickerEpisodeId(null);
    setFolderPickerPosition(null);
    setFolderEpisodePickerFolderId(null);
    setFolderEpisodePickerPosition(null);
    setIsSidebarCollapsed(false);
  }

  async function confirmDeleteEpisode() {
    if (!deleteEpisodeTarget) {
      return;
    }

    const deleted = await controller.deleteEpisode(deleteEpisodeTarget.id);

    if (deleted) {
      dissolveEpisodeFromFolder(deleteEpisodeTarget.id);
      setFolderEpisodePins((current) =>
        Object.fromEntries(
          Object.entries(current).map(([scopeId, entries]) => [
            scopeId,
            entries.filter((entry) => entry !== deleteEpisodeTarget.id)
          ])
        )
      );
    }

    setDeleteEpisodeId(null);
    setEpisodeMenuId(null);
    setEpisodeMenuPosition(null);
    setFolderPickerPosition(null);
  }

  function renderEpisodeItem(episode: StoryEpisode, scopeId: string) {
    const isActive = episode.id === activeEpisode?.id;
    const isPinned = getScopedPinnedEpisodes(scopeId).includes(episode.id);
    const isRenaming = renamingEpisodeId === episode.id;
    const currentFolderId = folderIdByEpisodeId.get(episode.id) ?? null;
    const isSortable = sortingFolderId !== null && sortingFolderId === currentFolderId;

    return (
      <li
        className={`sidebar-episode-item${isActive ? " is-active" : ""}${isSortable ? " is-sortable" : ""}`}
        draggable={!isRenaming}
        key={episode.id}
        onDragEnd={() => {
          setDraggedSidebarEpisodeId(null);
        }}
        onDragOver={(event) => {
          if (!isSortable || !draggedSidebarEpisodeId || draggedSidebarEpisodeId === episode.id) {
            return;
          }

          event.preventDefault();
        }}
        onDragStart={() => {
          if (isRenaming) {
            return;
          }

          setDraggedSidebarEpisodeId(episode.id);
        }}
        onDrop={(event) => {
          if (!isSortable || !draggedSidebarEpisodeId || !currentFolderId) {
            return;
          }

          event.preventDefault();
          reorderEpisodeWithinFolder(currentFolderId, draggedSidebarEpisodeId, episode.id);
          setDraggedSidebarEpisodeId(null);
        }}
      >
        {isRenaming ? (
          <form
            className="sidebar-episode-rename"
            onSubmit={(event) => {
              event.preventDefault();
              void submitEpisodeRename();
            }}
          >
            <input
              onChange={(event: ChangeEvent<HTMLInputElement>) => {
                setEpisodeRenameDraft(event.target.value);
              }}
              type="text"
              value={episodeRenameDraft}
            />
            <div className="control-row">
              <button type="submit">{copy.persistence.saveEpisode}</button>
              <button
                className="button-secondary"
                onClick={() => {
                  setRenamingEpisodeId(null);
                  setEpisodeRenameDraft("");
                }}
                type="button"
              >
                {copy.persistence.cancel}
              </button>
            </div>
          </form>
        ) : (
          <div className="sidebar-story-shell">
            <button
              className="sidebar-episode-link"
              onClick={() => {
                void selectEpisodeFromSidebar(episode.id);
              }}
              type="button"
            >
              <span className="sidebar-episode-title-row">
                <SidebarItemIcon kind="episode" />
                <strong>{episode.title}</strong>
              </span>
            </button>
            <div className="sidebar-episode-actions">
              <button
                aria-label={`${isPinned ? copy.persistence.unpinEpisode : copy.persistence.pinEpisode} ${episode.title}`}
                className="button-secondary sidebar-inline-pin-button"
                onClick={() => {
                  toggleEpisodePin(episode.id);
                }}
                type="button"
              >
                {isPinned ? copy.persistence.unpinEpisode : copy.persistence.pinEpisode}
              </button>
              <button
                aria-label={`${copy.workspace.utilities} ${episode.title}`}
                className="button-secondary sidebar-episode-menu-button"
                onClick={(event) => {
                  const rect = event.currentTarget.getBoundingClientRect();
                  setFolderMenuId(null);
                  setFolderMenuPosition(null);
                  setFolderEpisodePickerFolderId(null);
                  setFolderEpisodePickerPosition(null);
                  setFolderPickerEpisodeId(null);
                  setFolderPickerPosition(null);
                  setEpisodeMenuId((current) => {
                    const nextId = current === episode.id ? null : episode.id;
                    setEpisodeMenuPosition(
                      nextId ? getViewportMenuPosition(rect) : null
                    );
                    return nextId;
                  });
                }}
                ref={(element) => {
                  if (element) {
                    episodeMenuButtonRefs.current.set(episode.id, element);
                  } else {
                    episodeMenuButtonRefs.current.delete(episode.id);
                  }
                }}
                type="button"
              >
                ...
              </button>
              {episodeMenuId === episode.id
                ? renderViewportOverlay(
                    <div
                      className="sidebar-episode-menu sidebar-episode-menu-overlay"
                      style={
                        episodeMenuPosition
                          ? ({
                              left: `${episodeMenuPosition.left}px`,
                              top: `${episodeMenuPosition.top}px`
                            } as CSSProperties)
                          : undefined
                      }
                    >
                      <button
                        className="button-secondary"
                        onClick={() => {
                          beginEpisodeRename(episode);
                        }}
                        type="button"
                      >
                        {copy.persistence.renameEpisode}
                      </button>
                      {currentFolderId ? (
                        <button
                          className="button-secondary"
                          onClick={() => {
                            dissolveEpisodeFromFolder(episode.id);
                          }}
                          type="button"
                        >
                          {copy.persistence.dissolveEpisode}
                        </button>
                      ) : (
                        <button
                          className="button-secondary"
                          onClick={(event) => {
                            const rect = event.currentTarget.getBoundingClientRect();
                            setFolderPickerEpisodeId((current) => {
                              const nextId = current === episode.id ? null : episode.id;
                              setFolderPickerPosition(
                                nextId ? getViewportMenuPosition(rect, "right-start") : null
                              );
                              return nextId;
                            });
                          }}
                          type="button"
                        >
                          {copy.persistence.addToFolder}
                        </button>
                      )}
                      <button
                        className="button-secondary"
                        disabled={snapshot.episodes.length <= 1}
                        onClick={() => {
                          setDeleteEpisodeId(episode.id);
                          setEpisodeMenuId(null);
                          setEpisodeMenuPosition(null);
                          setFolderPickerEpisodeId(null);
                        }}
                        type="button"
                      >
                        {copy.persistence.delete}
                      </button>
                    </div>
                  )
                : null}
            </div>
          </div>
        )}
      </li>
    );
  }

  function renderFolderItem(folder: SidebarFolder & { visibleEpisodes: StoryEpisode[] }) {
    const isRenaming = renamingFolderId === folder.id;
    const isSorting = sortingFolderId === folder.id;

    return (
      <li className="sidebar-folder-item" key={folder.id}>
        {isRenaming ? (
          <form
            className="sidebar-episode-rename"
            onSubmit={(event) => {
              event.preventDefault();
              submitFolderRename(folder.id);
            }}
          >
            <input
              onChange={(event: ChangeEvent<HTMLInputElement>) => {
                setFolderRenameDraft(event.target.value);
              }}
              type="text"
              value={folderRenameDraft}
            />
            <div className="control-row">
              <button type="submit">{copy.persistence.saveEpisode}</button>
              <button
                className="button-secondary"
                onClick={() => {
                  setRenamingFolderId(null);
                  setFolderRenameDraft("");
                }}
                type="button"
              >
                {copy.persistence.cancel}
              </button>
            </div>
          </form>
        ) : (
          <div
            className={`sidebar-folder-card${
              draggedSidebarEpisodeId && !folder.episodeIds.includes(draggedSidebarEpisodeId)
                ? " is-drop-target"
                : ""
            }`}
            onDragOver={(event) => {
              if (!draggedSidebarEpisodeId || folder.episodeIds.includes(draggedSidebarEpisodeId)) {
                return;
              }

              event.preventDefault();
            }}
            onDrop={(event) => {
              if (!draggedSidebarEpisodeId || folder.episodeIds.includes(draggedSidebarEpisodeId)) {
                return;
              }

              event.preventDefault();
              assignEpisodeToFolder(draggedSidebarEpisodeId, folder.id);
              setDraggedSidebarEpisodeId(null);
            }}
          >
            <button
              className="sidebar-folder-button"
              onClick={() => {
                setSidebarFolders((current) =>
                  current.map((entry) =>
                    entry.id === folder.id
                      ? { ...entry, isCollapsed: !entry.isCollapsed }
                      : entry
                  )
                );
              }}
              type="button"
            >
              <span className="sidebar-folder-copy">
                <SidebarItemIcon kind="folder" />
                <strong>{folder.name}</strong>
              </span>
            </button>
            <div className="sidebar-folder-actions">
              <button
                aria-label={`${folder.isPinned ? copy.persistence.unpinEpisode : copy.persistence.pinEpisode} ${folder.name}`}
                className="button-secondary sidebar-inline-pin-button"
                onClick={() => {
                  toggleFolderPin(folder.id);
                }}
                type="button"
              >
                {folder.isPinned ? copy.persistence.unpinEpisode : copy.persistence.pinEpisode}
              </button>
              <button
                aria-label={`${copy.workspace.utilities} ${folder.name}`}
                className="button-secondary sidebar-episode-menu-button"
                onClick={(event) => {
                  const rect = event.currentTarget.getBoundingClientRect();
                  setEpisodeMenuId(null);
                  setEpisodeMenuPosition(null);
                  setFolderMenuId((current) => {
                    const nextId = current === folder.id ? null : folder.id;
                    setFolderMenuPosition(nextId ? getViewportMenuPosition(rect) : null);
                    setFolderEpisodePickerFolderId(null);
                    setFolderEpisodePickerPosition(null);
                    return nextId;
                  });
                  setFolderPickerPosition(null);
                  setFolderPickerEpisodeId(null);
                  setObjectMenuId(null);
                  setObjectMenuPosition(null);
                }}
                ref={(element) => {
                  if (element) {
                    folderMenuButtonRefs.current.set(folder.id, element);
                  } else {
                    folderMenuButtonRefs.current.delete(folder.id);
                  }
                }}
                type="button"
              >
                ...
              </button>
            </div>
            {folderMenuId === folder.id
              ? renderViewportOverlay(
                  <div
                    className="sidebar-folder-menu-overlay sidebar-episode-menu"
                    style={
                      folderMenuPosition
                        ? ({
                            left: `${folderMenuPosition.left}px`,
                            top: `${folderMenuPosition.top}px`
                          } as CSSProperties)
                        : undefined
                    }
                  >
                    <button
                      className="button-secondary"
                      onClick={() => {
                        beginFolderRename(folder);
                      }}
                      type="button"
                    >
                      {copy.persistence.renameEpisode}
                    </button>
                    <button
                      className="button-secondary"
                      onClick={() => {
                        toggleFolderCollapsed(folder.id);
                      }}
                      type="button"
                    >
                      {folder.isCollapsed ? copy.persistence.unfold : copy.persistence.fold}
                    </button>
                    <button
                      className="button-secondary"
                      onClick={(event) => {
                        const rect = event.currentTarget.getBoundingClientRect();
                        setFolderEpisodePickerFolderId((current) => {
                          const nextId = current === folder.id ? null : folder.id;
                          setFolderEpisodePickerPosition(
                            nextId ? getViewportMenuPosition(rect, "right-start") : null
                          );
                          return nextId;
                        });
                      }}
                      type="button"
                    >
                      {copy.persistence.addEpisodes}
                    </button>
                    <button
                      className="button-secondary"
                      onClick={() => {
                        toggleFolderSort(folder.id);
                      }}
                      type="button"
                    >
                      {isSorting ? copy.persistence.cancel : copy.persistence.sortStories}
                    </button>
                    <button
                      className="button-secondary"
                      onClick={() => {
                        deleteFolder(folder.id);
                      }}
                      type="button"
                    >
                      {copy.persistence.delete}
                    </button>
                  </div>
                )
              : null}
            {folderEpisodePickerFolderId === folder.id && folderEpisodePickerPosition
              ? renderViewportOverlay(
                  <div
                    className="sidebar-folder-picker sidebar-folder-picker-popout"
                    style={
                      {
                        left: `${folderEpisodePickerPosition.left}px`,
                        top: `${folderEpisodePickerPosition.top}px`
                      } as CSSProperties
                    }
                  >
                    {sortEpisodesForScope(snapshot.episodes, rootFolderScopeId).map((episodeOption) => {
                      const isInFolder = folder.episodeIds.includes(episodeOption.id);

                      return (
                        <button
                          className={`button-secondary sidebar-picker-option${
                            isInFolder ? " is-selected" : ""
                          }`}
                          key={`${folder.id}-${episodeOption.id}`}
                          onClick={() => {
                            toggleEpisodeInFolderPicker(folder.id, episodeOption.id);
                          }}
                          type="button"
                        >
                          <span className="sidebar-picker-option-prefix">
                            {isInFolder ? "-" : "+"}
                          </span>
                          <span className="sidebar-picker-option-label">
                            {episodeOption.title}
                          </span>
                        </button>
                      );
                    })}
                  </div>
                )
              : null}
          </div>
        )}
        {!folder.isCollapsed && folder.visibleEpisodes.length > 0 ? (
          <ul className="sidebar-folder-episode-list">
            {folder.visibleEpisodes.map((episode) => renderEpisodeItem(episode, folder.id))}
          </ul>
        ) : null}
      </li>
    );
  }

  return (
    <div
      className={`workspace-shell${detailMode === null ? " workspace-shell-details-closed" : ""}${
        isSidebarCollapsed ? " workspace-shell-sidebar-collapsed" : ""
      }`}
    >
      <aside
        className={`panel panel-navigation${isSidebarCollapsed ? " panel-navigation-collapsed" : ""}`}
      >
        {isSidebarCollapsed ? (
          <>
            <div className="sidebar-collapsed-actions">
              <button
                aria-label={copy.persistence.openSidebar}
                className="sidebar-icon-button"
                onClick={toggleSidebar}
                type="button"
              >
                []
              </button>
              <button
                aria-label={copy.workspace.newEpisode}
                className="sidebar-icon-button"
                onClick={() => {
                  void createEpisodeFromSidebar();
                }}
                type="button"
              >
                +
              </button>
              <button
                aria-label={copy.workspace.newFolder}
                className="sidebar-icon-button"
                onClick={() => {
                  setIsSidebarCollapsed(false);
                  setIsFolderCreatorVisible(true);
                }}
                type="button"
              >
                #
              </button>
              <button
                aria-label={copy.persistence.searchStories}
                className="sidebar-icon-button"
                onClick={openSidebarAndSearch}
                type="button"
              >
                ?
              </button>
              <button
                aria-label={copy.workspace.recentStories}
                className="sidebar-icon-button"
                onClick={() => {
                  setIsSidebarCollapsed(false);
                }}
                type="button"
              >
                R
              </button>
            </div>
            <button
              aria-label={copy.workspace.profile}
              className="sidebar-profile-button sidebar-profile-button-collapsed"
              type="button"
            >
              <span aria-hidden="true" className="sidebar-profile-avatar sidebar-profile-avatar-icon" />
            </button>
          </>
        ) : (
          <>
            <div className="sidebar-brand-row">
              <h1 className="sidebar-brand-title">{copy.workspace.brand}</h1>
              <button
                aria-label={copy.persistence.closeSidebar}
                className="sidebar-icon-button"
                onClick={toggleSidebar}
                type="button"
              >
                []
              </button>
            </div>

            <div className="sidebar-action-list">
              <button
                className="sidebar-action-button"
                onClick={() => {
                  void createEpisodeFromSidebar();
                }}
                type="button"
              >
                <span className="sidebar-action-icon">+</span>
                <span>{copy.workspace.newEpisode}</span>
              </button>
              <button
                aria-expanded={isFolderCreatorVisible}
                className="sidebar-action-button"
                onClick={() => {
                  setIsMoreVisible(false);
                  toggleFolderCreator();
                }}
                type="button"
              >
                <span className="sidebar-action-icon">#</span>
                <span>{copy.workspace.newFolder}</span>
              </button>
              <button
                aria-expanded={isEpisodeSearchVisible}
                className="sidebar-action-button"
                onClick={() => {
                  setIsMoreVisible(false);
                  setIsFolderCreatorVisible(false);
                  setIsEpisodeSearchVisible((current) => !current);
                }}
                type="button"
              >
                <span className="sidebar-action-icon">?</span>
                <span>{copy.persistence.searchStories}</span>
              </button>
            </div>

            {isEpisodeSearchVisible ? (
              <div className="sidebar-section sidebar-inline-panel">
                <label className="field-stack">
                  <span>{copy.persistence.searchStories}</span>
                  <input
                    onChange={(event: ChangeEvent<HTMLInputElement>) => {
                      setEpisodeSearchQuery(event.target.value);
                    }}
                    placeholder={copy.workspace.storySearchPlaceholder}
                    ref={episodeSearchInputRef}
                    type="search"
                    value={episodeSearchQuery}
                  />
                </label>
              </div>
            ) : null}

            {isFolderCreatorVisible ? (
              <section className="sidebar-section sidebar-inline-panel">
                <label className="field-stack">
                  <span>{copy.workspace.newFolder}</span>
                  <input
                    onChange={(event: ChangeEvent<HTMLInputElement>) => {
                      setFolderNameDraft(event.target.value);
                    }}
                    placeholder={copy.workspace.newFolderPlaceholder}
                    type="text"
                    value={folderNameDraft}
                  />
                </label>
                <div className="control-row">
                  <button
                    onClick={() => {
                      createFolderFromSidebar();
                    }}
                    type="button"
                  >
                    {copy.workspace.createFolder}
                  </button>
                  <button
                    className="button-secondary"
                    onClick={() => {
                      setIsFolderCreatorVisible(false);
                      setFolderNameDraft("");
                    }}
                    type="button"
                  >
                    {copy.persistence.cancel}
                  </button>
                </div>
              </section>
            ) : null}

            <section className="sidebar-section sidebar-recents-section">
              <div className="sidebar-section-header">
                <strong>{copy.workspace.recentStories}</strong>
              </div>

              <div className="sidebar-recents-scroll">
                {visibleFolders.length > 0 || rootEpisodes.length > 0 ? (
                  <>
                    {visibleFolders.length > 0 ? (
                      <ul className="sidebar-folder-list">
                        {visibleFolders.map((folder) => renderFolderItem(folder))}
                      </ul>
                    ) : null}

                    {rootEpisodes.length > 0 ? (
                      <ul
                        className={`sidebar-episode-list sidebar-root-episode-list${
                          visibleFolders.length > 0 ? " has-folders" : ""
                        }`}
                      >
                        {rootEpisodes.map((episode) =>
                          renderEpisodeItem(episode, rootFolderScopeId)
                        )}
                      </ul>
                    ) : null}
                  </>
                ) : (
                  <p className="support-copy">{copy.workspace.recentStoriesEmpty}</p>
                )}
              </div>
            </section>

            <div className="sidebar-profile-shell">
              <button
                aria-label={copy.workspace.profile}
                aria-expanded={isMoreVisible}
                className="sidebar-profile-button sidebar-profile-main"
                onClick={toggleProfileMenu}
                type="button"
              >
                <span aria-hidden="true" className="sidebar-profile-avatar sidebar-profile-avatar-icon" />
                <span className="sidebar-profile-copy">
                  <strong>{isAuthenticated ? profileName : copy.persistence.signIn}</strong>
                  <span>{isAuthenticated ? "Linked account" : "Guest workspace"}</span>
                </span>
                <span className="visually-hidden" data-testid="session-mode">
                  {isAuthenticated ? "authenticated" : "guest"}
                </span>
              </button>
              <button
                aria-label={`${copy.workspace.utilities} ${copy.workspace.profile}`}
                aria-expanded={isMoreVisible}
                className="button-secondary sidebar-profile-more"
                onClick={toggleProfileMenu}
                type="button"
              >
                ...
              </button>
              {isMoreVisible ? (
                <div className="sidebar-profile-menu">
                  <div className="chip-row">
                    <span className="badge">{isAuthenticated ? "authenticated" : "guest"}</span>
                    <span className="badge" data-testid="cloud-status-sidebar">
                      {describeCloudStatus(state)}
                    </span>
                  </div>
                  <div className="control-row sidebar-utility-actions">
                    <button
                      className="button-secondary"
                      disabled={isBusy}
                      onClick={() => {
                        setIsMoreVisible(false);
                        void controller.reloadLocal();
                      }}
                      type="button"
                    >
                      {copy.persistence.reloadLocal}
                    </button>
                    <button
                      className="button-secondary"
                      disabled={!isAuthenticated || isBusy}
                      onClick={() => {
                        setIsMoreVisible(false);
                        void controller.recoverFromCloud();
                      }}
                      type="button"
                    >
                      {copy.persistence.recoverFromCloud}
                    </button>
                    {isAuthenticated ? (
                      <button
                        className="button-secondary"
                        disabled={isBusy}
                        onClick={() => {
                          setIsMoreVisible(false);
                          void controller.signOut();
                        }}
                        type="button"
                      >
                        {copy.persistence.signOut}
                      </button>
                    ) : (
                      <button
                        className="button-secondary"
                        disabled={isBusy}
                        onClick={() => {
                          setIsMoreVisible(false);
                          void controller.signIn();
                        }}
                        type="button"
                      >
                        {copy.persistence.signIn}
                      </button>
                    )}
                  </div>
                </div>
              ) : null}
            </div>
          </>
        )}
      </aside>

      {folderPickerEpisodeId !== null && folderPickerPosition !== null
        ? renderViewportOverlay(
            <div
              className="sidebar-folder-picker sidebar-folder-picker-popout"
              style={
                {
                  left: `${folderPickerPosition.left}px`,
                  top: `${folderPickerPosition.top}px`
                } as CSSProperties
              }
            >
              {sidebarFolders.length > 0 ? (
                sidebarFolders.map((folder) => (
                  <button
                    className="button-secondary"
                    key={folder.id}
                    onClick={() => {
                      assignEpisodeToFolder(folderPickerEpisodeId, folder.id);
                    }}
                    type="button"
                  >
                    {folder.name}
                  </button>
                ))
              ) : (
                <span className="support-copy">{copy.workspace.noFoldersYet}</span>
              )}
            </div>
          )
        : null}

      <header className="panel panel-objects">
        <div className="object-toolbar object-toolbar-compact">
          <div className="object-toolbar-heading">
            <h2>{copy.workspace.objects}</h2>
            <span>{activeEpisode?.title ?? "Current episode"}</span>
          </div>
          <label className="object-search-field object-search-field-compact">
            <span className="visually-hidden">{copy.workspace.objectSearch}</span>
            <input
              data-testid="object-search"
              onChange={(event: ChangeEvent<HTMLInputElement>) => {
                setObjectSearchQuery(event.target.value);
              }}
              placeholder={copy.workspace.objectSearchPlaceholder}
              type="search"
              value={objectSearchQuery}
            />
          </label>
          <button
            className="button-secondary"
            onClick={openCreateObjectEditor}
            type="button"
          >
            {copy.workspace.createObject}
          </button>
          <label className="object-sort-field">
            <span className="visually-hidden">{copy.workspace.objectSort}</span>
            <select
              data-testid="object-sort"
              onChange={(event: ChangeEvent<HTMLSelectElement>) => {
                setObjectSortMode(event.target.value as ObjectSortMode);
              }}
              value={objectSortMode}
            >
              <option value="recent">{copy.workspace.objectSortRecent}</option>
              <option value="oldest">{copy.workspace.objectSortOldest}</option>
              <option value="usage-desc">{copy.workspace.objectSortUsageDesc}</option>
              <option value="usage-asc">{copy.workspace.objectSortUsageAsc}</option>
              <option value="name-asc">{copy.workspace.objectSortNameAsc}</option>
              <option value="name-desc">{copy.workspace.objectSortNameDesc}</option>
            </select>
          </label>
        </div>

        <div className="object-list-scroll">
          <div className="object-list" data-testid="object-list">
            {sortedObjects.length > 0 ? (
              sortedObjects.map((object) => {
                const isAttached = selectedNode?.objectIds.includes(object.id) ?? false;
                const usageCount = objectUsageCounts.get(object.id) ?? 0;

                return (
                  <article
                    className={`object-row${selectedObject?.id === object.id ? " is-selected" : ""}${
                      isAttached ? " is-attached" : ""
                    }`}
                    data-testid={`object-row-${object.id}`}
                    key={object.id}
                  >
                    <button
                      aria-label={object.name}
                      className="object-row-surface"
                      onClick={() => {
                        setObjectMenuId(null);
                        setObjectMenuPosition(null);
                        selectObjectFromLibrary(object.id);
                      }}
                      type="button"
                    >
                      <span className="object-row-name">
                        {object.name}
                      </span>
                      <span className="object-row-count">({usageCount})</span>
                    </button>
                    <div className="object-row-actions">
                      <button
                        aria-label={`${copy.persistence.more} ${object.name}`}
                        className="button-secondary object-row-menu-button"
                        onClick={(event) => {
                          event.stopPropagation();
                          const rect = event.currentTarget.getBoundingClientRect();
                          setSelectedObjectId(object.id);
                          setObjectMenuId((current) => {
                            const nextId = current === object.id ? null : object.id;
                            setObjectMenuPosition(
                              nextId ? getViewportMenuPosition(rect) : null
                            );
                            return nextId;
                          });
                        }}
                        ref={(element) => {
                          if (element) {
                            objectMenuButtonRefs.current.set(object.id, element);
                          } else {
                            objectMenuButtonRefs.current.delete(object.id);
                          }
                        }}
                        type="button"
                      >
                        ...
                      </button>
                    </div>
                  </article>
                );
              })
            ) : (
              <p className="support-copy">{copy.workspace.noObjectsFound}</p>
            )}
          </div>
        </div>
        {objectMenuId !== null && objectMenuPosition !== null
          ? renderViewportOverlay(
              <div
                className="object-row-menu object-row-menu-overlay"
                style={
                  {
                    left: `${objectMenuPosition.left}px`,
                    top: `${objectMenuPosition.top}px`
                  } as CSSProperties
                }
              >
                <button
                  className="button-secondary"
                  onClick={() => {
                    toggleObjectPin(objectMenuId);
                  }}
                  type="button"
                >
                  {pinnedObjectIds.includes(objectMenuId)
                    ? copy.persistence.unpinObject
                    : copy.persistence.pinObject}
                </button>
                <button
                  className="button-secondary"
                  onClick={() => {
                    beginObjectRename(objectMenuId);
                  }}
                  type="button"
                >
                  {copy.persistence.renameObject}
                </button>
                <button
                  className="button-secondary"
                  onClick={() => {
                    void deleteObjectFromLibrary(objectMenuId);
                  }}
                  type="button"
                >
                  {copy.persistence.deleteObject}
                </button>
              </div>
            )
          : null}
      </header>

      <main
        className={`panel panel-canvas${isCanvasFullscreen ? " is-fullscreen" : ""}`}
        ref={canvasPanelRef}
      >
        <div className="canvas-heading">
          <div className="canvas-heading-copy">
            <h2>{copy.workspace.canvas}</h2>
            <span className="visually-hidden" data-testid="node-count">
              Nodes: {orderedNodes.length}
            </span>
          </div>
          <div className="canvas-heading-actions">
            <button
              aria-label="Zoom Out"
              className="button-secondary canvas-zoom-button"
              onClick={() => {
                setCanvasZoom((current) => clampCanvasZoom(current - 0.1));
              }}
              type="button"
            >
              -
            </button>
            <button
              aria-label="Reset Zoom"
              className="button-secondary canvas-zoom-readout"
              onClick={() => {
                setCanvasZoom(1);
              }}
              type="button"
            >
              {Math.round(canvasZoom * 100)}%
            </button>
            <button
              aria-label="Zoom In"
              className="button-secondary canvas-zoom-button"
              onClick={() => {
                setCanvasZoom((current) => clampCanvasZoom(current + 0.1));
              }}
              type="button"
            >
              +
            </button>
            <button
              aria-label={
                isCanvasFullscreen
                  ? copy.persistence.exitFullscreen
                  : copy.persistence.enterFullscreen
              }
              className="button-secondary canvas-fullscreen-button"
              onClick={() => {
                void toggleCanvasFullscreen();
              }}
              type="button"
            >
              {isCanvasFullscreen ? "Exit" : "Full"}
            </button>
          </div>
        </div>

        <section className="canvas-workbench">
          {draftVisible ? (
            <section className="draft-panel canvas-draft-overlay">
              <article
                className="draft-card"
                data-testid="draft-node"
                draggable={!isBusy}
                onDragEnd={() => {
                  setDragPayload(null);
                }}
                onDragStart={(event) => {
                  event.dataTransfer.effectAllowed = "move";
                  event.dataTransfer.setData("text/plain", "draft");
                  setDragPayload({
                    kind: "draft"
                  });
                }}
              >
                <strong className="draft-card-title">New empty node</strong>
                <p>{copy.persistence.placeDraft}</p>
              </article>
            </section>
          ) : null}

          <section
            className={`canvas-viewport${isCanvasPanning ? " is-panning" : ""}`}
            onMouseDown={beginCanvasPan}
            onWheel={handleCanvasViewportWheel}
            ref={canvasViewportRef}
          >
          <div
            className="canvas-stage-zoom-shell"
            style={
              {
                "--canvas-zoom": canvasZoom,
                "--stage-height": `${stageHeight}px`,
                "--stage-width": `${stageWidth}px`
              } as CSSProperties
            }
          >
          <div
            className="canvas-stage"
            onDragOver={(event) => {
              if (!dragPayload) {
                return;
              }

              event.preventDefault();

              if (dragPayload.kind === "node") {
                maybeExtendTimelineForDraggedNode(
                  event.clientY,
                  getNodeSize(nodeSizes, dragPayload.nodeId)
                );
              }
            }}
            onDrop={(event) => {
              void handleCanvasStageDrop(event);
            }}
            ref={canvasStageRef}
            style={{ "--stage-height": `${stageHeight}px`, "--stage-width": `${stageWidth}px` } as CSSProperties}
          >
            <svg
              aria-hidden="true"
              className="connection-layer"
              viewBox={`0 0 ${stageWidth} ${stageHeight}`}
            >
              <defs>
                <marker
                  id="canvas-arrowhead"
                  markerHeight="12"
                  markerWidth="12"
                  orient="auto-start-reverse"
                  refX="11"
                  refY="6"
                >
                  <path d="M 0 0 L 12 6 L 0 12 z" />
                </marker>
              </defs>
              {connectionLines.map((line) => (
                <path d={line.path} key={line.id} markerEnd="url(#canvas-arrowhead)" />
              ))}
              {rewirePreviewLine ? (
                <path
                  className="connection-preview-line"
                  d={rewirePreviewLine}
                  markerEnd="url(#canvas-arrowhead)"
                />
              ) : null}
            </svg>
            {aiPanelNodeId === null ? (
              <div className="connection-handle-layer">
                {connectionLines.flatMap((line) => [
                  <button
                    aria-label="Adjust Connection"
                    className={`connection-port connection-port-line${
                      rewireNode?.id === line.childId ? " is-active" : ""
                    }`}
                    disabled={isBusy}
                    key={`${line.id}-start`}
                    onMouseDown={(event) => {
                      beginRewireDrag(line.childId, event);
                    }}
                    style={
                      {
                        left: `${line.startX}px`,
                        top: `${line.startY}px`
                      } as CSSProperties
                    }
                    type="button"
                  >
                    <span aria-hidden="true" />
                  </button>,
                  <button
                    aria-label="Adjust Connection"
                    className={`connection-port connection-port-line${
                      rewireNode?.id === line.childId ? " is-active" : ""
                    }`}
                    disabled={isBusy}
                    key={`${line.id}-end`}
                    onMouseDown={(event) => {
                      beginRewireDrag(line.childId, event);
                    }}
                    style={
                      {
                        left: `${line.endX}px`,
                        top: `${line.endY}px`
                      } as CSSProperties
                    }
                    type="button"
                  >
                    <span aria-hidden="true" />
                  </button>
                ])}
              </div>
            ) : null}

            <div
              className="lane-grid"
              style={
                {
                  "--detail-lane-width": `${laneWidths.detail}px`,
                  "--major-lane-width": `${laneWidths.major}px`,
                  "--minor-lane-width": `${laneWidths.minor}px`
                } as CSSProperties
              }
            >
              <div aria-hidden="true" className="lane-label-row">
                {laneDefinitions.map((lane) => (
                  <div
                    className={`lane-label lane-label-${lane.level}`}
                    key={`${lane.level}-label`}
                    style={
                      {
                        left: `${laneCanvasBounds[lane.level].left}px`,
                        width: `${laneWidths[lane.level]}px`
                      } as CSSProperties
                    }
                  >
                    <span className="lane-title">{lane.title}</span>
                  </div>
                ))}
              </div>
              {laneDefinitions.map((lane) => (
                <section
                  className={`lane-column lane-column-${lane.level}`}
                  key={lane.level}
                  style={
                    {
                      left: `${laneCanvasBounds[lane.level].left}px`,
                      width: `${laneWidths[lane.level]}px`
                    } as CSSProperties
                  }
                >
                  <div
                    className={`lane-track lane-track-${lane.level}${draftVisible ? " is-draft-target" : ""}`}
                    data-testid={`lane-${lane.level}`}
                    onClick={(event) => {
                      void handleLaneClick(lane.level, event);
                    }}
                    onDragOver={(event) => {
                      if (!dragPayload) {
                        return;
                      }

                      event.preventDefault();

                      if (dragPayload.kind === "node") {
                        maybeExtendTimelineForDraggedNode(
                          event.clientY,
                          getNodeSize(nodeSizes, dragPayload.nodeId)
                        );
                      }
                    }}
                    onDrop={(event) => {
                      event.stopPropagation();
                      void handleCanvasStageDrop(event);
                    }}
                  >
                    {lane.level === "major" ? (
                      <>
                        <div
                          aria-hidden="true"
                          className="timeline-rail"
                          style={
                            {
                              height: `${Math.max(120, effectiveTimelineEndY - timelineStartY)}px`,
                              left: `${majorLaneTimelineLocalCenterX - timelineRailWidth / 2}px`,
                              top: `${timelineStartY}px`,
                              width: `${timelineRailWidth}px`
                            } as CSSProperties
                          }
                        />
                        <span
                          aria-hidden="true"
                          className="timeline-start-anchor"
                          style={
                            {
                              left: `${majorLaneTimelineLocalCenterX}px`,
                              top: `${timelineStartY}px`
                            } as CSSProperties
                          }
                        />
                        <button
                          aria-label="Move timeline end"
                          className="timeline-end-handle"
                          onMouseDown={(event) => {
                            beginTimelineEndDrag(event);
                          }}
                          style={
                            {
                              left: `${majorLaneTimelineLocalCenterX}px`,
                              top: `${effectiveTimelineEndY}px`
                            } as CSSProperties
                          }
                          type="button"
                        >
                          <span aria-hidden="true" className="timeline-end-dot" />
                          <span aria-hidden="true" className="timeline-end-stem" />
                          <span aria-hidden="true" className="timeline-end-arrow" />
                        </button>
                      </>
                    ) : null}
                  </div>
                </section>
              ))}
              {renderedNodes}
              <div
                aria-hidden="true"
                className="lane-divider-line lane-divider-line-first"
                style={{ left: `${effectiveFirstDividerX}px` } as CSSProperties}
              />
              <span
                aria-hidden="true"
                className="lane-divider-cap lane-divider-cap-first"
                style={{ left: `${effectiveFirstDividerX}px` } as CSSProperties}
              >
                <span aria-hidden="true" className="lane-divider-dot" />
              </span>
              <div
                aria-hidden="true"
                className="lane-divider-line lane-divider-line-second"
                style={{ left: `${effectiveSecondDividerX}px` } as CSSProperties}
              />
              <button
                aria-label="Resize minor and detail lanes"
                className="lane-divider-handle lane-divider-handle-second"
                onMouseDown={(event) => {
                  beginLaneDividerDrag("second", event);
                }}
                style={{ left: `${effectiveSecondDividerX}px` } as CSSProperties}
                type="button"
              >
                <span aria-hidden="true" className="lane-divider-dot" />
                <span aria-hidden="true" className="lane-divider-stem" />
              </button>
              <div
                aria-hidden="true"
                className="lane-divider-line lane-divider-line-edge"
                style={{ left: `${effectiveDetailEdgeX}px` } as CSSProperties}
              />
              <button
                aria-label="Resize minor detail lane edge"
                className="lane-divider-handle lane-divider-handle-edge"
                onMouseDown={(event) => {
                  beginLaneDividerDrag("detail-edge", event);
                }}
                style={{ left: `${effectiveDetailEdgeX}px` } as CSSProperties}
                type="button"
              >
                <span aria-hidden="true" className="lane-divider-dot" />
                <span aria-hidden="true" className="lane-divider-stem" />
              </button>
            </div>
          </div>
          </div>
        </section>
        </section>
        {isDrawerUiEnabled && isDrawerOpen ? (
          <section className="panel panel-drawer drawer-sheet">
            <div className="drawer-header">
              <div>
                <span className="eyebrow">Bottom Drawer</span>
                <h2>{copy.workspace.drawer}</h2>
              </div>
              <button
                aria-label={copy.persistence.toggleDrawer}
                className="button-secondary drawer-sheet-toggle"
                onClick={() => {
                  setIsDrawerOpen(false);
                }}
                type="button"
              >
                v
              </button>
            </div>

            <ul className="drawer-list">
              {activeDrawerItems.map((item) => {
                const preview = getDrawerItemPreview(item);

                return (
                  <li className="drawer-card" key={item.id}>
                    <div>
                      <strong>{preview.label}</strong>
                      <p>{preview.detail}</p>
                      <span>
                        {preview.rootLevel ? `${preview.rootLevel} lane` : "free note"} - {preview.nodeCount} node
                        {preview.nodeCount === 1 ? "" : "s"}
                      </span>
                    </div>
                    <button
                      disabled={isBusy}
                      onClick={() => {
                        void restoreDrawerItemToCanvas(item.id);
                      }}
                      type="button"
                    >
                      {copy.persistence.restoreToCanvas}
                    </button>
                  </li>
                );
              })}
            </ul>
          </section>
        ) : null}

        <div className="floating-history-controls" data-testid="history-controls">
          <button
            className="button-secondary history-control-button history-control-button-undo"
            aria-label={copy.persistence.undo}
            disabled={!state.history.canUndo || isBusy}
            onClick={() => {
              void controller.undo();
            }}
            type="button"
          >
            <span aria-hidden="true" className="history-control-icon">
              <svg className="history-control-svg" viewBox="0 0 24 24">
                <path d="M9 7 4 12l5 5" />
                <path d="M20 18a7 7 0 0 0-7-7H4" />
              </svg>
            </span>
            <span className="visually-hidden">{copy.persistence.undo}</span>
          </button>
          <button
            className="button-secondary history-control-button history-control-button-redo"
            aria-label={copy.persistence.redo}
            disabled={!state.history.canRedo || isBusy}
            onClick={() => {
              void controller.redo();
            }}
            type="button"
          >
            <span aria-hidden="true" className="history-control-icon">
              <svg className="history-control-svg" viewBox="0 0 24 24">
                <path d="m15 7 5 5-5 5" />
                <path d="M4 18a7 7 0 0 1 7-7h9" />
              </svg>
            </span>
            <span className="visually-hidden">{copy.persistence.redo}</span>
          </button>
          {isDrawerUiEnabled ? (
            <button
              className={`button-secondary history-control-button history-control-button-drawer${
                isDrawerOpen ? " is-open" : ""
              }`}
              aria-label={copy.persistence.toggleDrawer}
              onClick={() => {
                setIsDrawerOpen((current) => !current);
              }}
              type="button"
            >
              <span aria-hidden="true" className="history-control-icon">
                <svg className="history-control-svg history-control-chevron" viewBox="0 0 16 16">
                  <path d="M3.5 6 8 10.5 12.5 6" />
                </svg>
              </span>
              <span className="visually-hidden">
                {isDrawerOpen ? copy.persistence.drawerOpen : copy.persistence.drawerClosed}
              </span>
            </button>
          ) : null}
          <button
            className="button-secondary history-control-button history-control-button-create"
            aria-label={copy.persistence.createNode}
            disabled={isBusy}
            onClick={() => {
              setDraftVisible((current) => !current);
              setRewireNodeId(null);
            }}
            type="button"
          >
            <span aria-hidden="true" className="history-control-icon">
              <svg className="history-control-svg" viewBox="0 0 24 24">
                <path d="M12 5v14" />
                <path d="M5 12h14" />
              </svg>
            </span>
            <span className="visually-hidden">{copy.persistence.createNode}</span>
          </button>
        </div>
      </main>

      {detailPanel
        ? isCanvasFullscreen
          ? renderViewportOverlay(detailPanel)
          : detailPanel
        : null}

      {nodeMoreMenuOverlay}

      {objectMentionOverlay}

      {deleteTarget ? (
        <div className="modal-backdrop" role="presentation">
          <section
            aria-labelledby="delete-node-title"
            aria-modal="true"
            className="modal-card"
            role="dialog"
          >
            <span className="eyebrow">Delete Node</span>
            <h3 id="delete-node-title">{getNodeHeadline(deleteTarget)}</h3>
            <p>{copy.persistence.deleteConfirmation}</p>
            <div className="control-row">
              <button
                className="button-secondary"
                onClick={() => {
                  setDeleteTargetId(null);
                }}
                type="button"
              >
                {copy.persistence.cancel}
              </button>
              <button
                onClick={() => {
                  void controller.deleteNodeTree(deleteTarget.id);
                  setDeleteTargetId(null);
                  setSelectedNodeId(null);
                  setRewireNodeId(null);
                }}
                type="button"
              >
                {copy.persistence.delete}
              </button>
            </div>
          </section>
        </div>
      ) : null}

      {deleteEpisodeTarget ? (
        <div className="modal-backdrop" role="presentation">
          <section
            aria-labelledby="delete-episode-title"
            aria-modal="true"
            className="modal-card"
            role="dialog"
          >
            <span className="eyebrow">Delete Episode</span>
            <h3 id="delete-episode-title">{deleteEpisodeTarget.title}</h3>
            <p>{copy.persistence.episodeDeleteConfirmation}</p>
            <div className="control-row">
              <button
                className="button-secondary"
                onClick={() => {
                  setDeleteEpisodeId(null);
                }}
                type="button"
              >
                {copy.persistence.cancel}
              </button>
              <button
                onClick={() => {
                  void confirmDeleteEpisode();
                }}
                type="button"
              >
                {copy.persistence.delete}
              </button>
            </div>
          </section>
        </div>
      ) : null}
    </div>
  );
}


