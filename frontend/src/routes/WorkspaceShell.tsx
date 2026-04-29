// 이 파일은 워크스페이스 캔버스와 편집 상호작용을 관리합니다.
import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type CSSProperties,
  type ChangeEvent,
  type DragEvent,
  type MouseEvent as ReactMouseEvent,
  type PointerEvent as ReactPointerEvent
} from "react";
import type {
  KeywordRecommendationRequest,
  KeywordSuggestion
} from "@scenaairo/recommendation";
import type {
  StoryEpisode,
  StoryNode,
  StoryNodeContentMode,
  StoryNodeLevel
} from "@scenaairo/shared";

import { StubAuthBoundary } from "../auth/stubAuthBoundary";
import { SessionAuthBoundary } from "../auth/sessionAuthBoundary";
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
  collectDescendantIds,
  collectSubtreeNodes,
  isDescendant,
  sortNodesByOrder
} from "../persistence/nodeTree";
import { RecommendationClient } from "../recommendation/client";
import { StandaloneRecommendationClient } from "../recommendation/standaloneClient";
import { createKeywordRecommendationRequest } from "../recommendation/request";
import {
  laneDefinitions,
  initialStageWidth,
  stageInnerLeft,
  laneGap,
  laneDividerNodePadding,
  initialLaneDividerXs,
  stageRightPadding,
  minLaneWidth,
  maxCanvasContentRight,
  timelineRailWidth,
  timelineStartY,
  timelineHandleHeight,
  nodeCardWidth,
  nodeCardHeight,
  canvasBottomPadding,
  minimumCanvasHeight,
  emptyNodes,
  rootFolderScopeId,
  initialTimelineEndY
} from "./workspace-shell/workspaceShell.constants";
import {
  toMessage,
  describeCloudStatus,
  renderViewportOverlay
} from "./workspace-shell/workspaceShell.common";
import {
  computeLaneCanvasBounds,
  getNodeSize,
  getFallbackNodePlacementWithinBounds,
  clampNodePlacement,
  clampCanvasZoom,
  getMentionPopoverPosition,
  canStartCanvasPan,
  hasCollapsedAncestor,
  buildConnectionLines,
  isEditableTarget,
  isInteractiveTarget,
  hasTextSelection,
  getPasteInsertIndex,
  getTimelineAnchorPositions,
  snapMajorNodePlacementToTimelineAnchors,
  resolveNearestParentIdByY,
  buildNodeConnectionPath,
  computeCanvasAutoScrollVelocity,
  resolveVisibleCanvasAutoScrollBounds
} from "./workspace-shell/workspaceShell.canvas";
import {
  extractInlineKeywords,
  buildInlineEditorText,
  extractDisplayText,
  extractObjectMentionNames,
  getOpenObjectMentionQuery,
  getObjectToken,
  normalizeInlineObjectMentions,
  getClosedObjectWordQuery,
  buildDisplayedKeywordSuggestions,
  getObjectMentionCreateCandidate,
  normalizeObjectMentionMatchName,
  normalizeInlineKeywordTokens,
  toggleInlineKeywordToken,
  getObjectMentionSignature,
  deriveNodeContentMode,
  keywordCloudSlotCount
} from "./workspace-shell/workspaceShell.inlineEditor";
import { cloneCopiedNodes } from "./workspace-shell/workspaceShell.node";
import {
  parseStoredStringArray
} from "./workspace-shell/workspaceShell.storage";
import {
  parseStoredFolderList,
  parseStoredEpisodePinMap,
  sanitizeEpisodePinMap,
  sanitizeSidebarFolders,
  buildSidebarEpisodeCollections
} from "./workspace-shell/workspaceShell.sidebar";
import { WorkspaceSidebarRecents } from "./workspace-shell/WorkspaceSidebarRecents";
import { WorkspaceObjectPanel } from "./workspace-shell/WorkspaceObjectPanel";
import { CanvasNodeCard } from "./workspace-shell/CanvasNodeCard";
import { CanvasLaneSpacer } from "./workspace-shell/CanvasLaneSpacer";
import {
  buildLaneLayoutsByLevel,
  getLaneLayoutNodePlacements,
  resolveLaneDropPlacement
} from "./workspace-shell/workspaceShell.laneLayout";
import { useEpisodeCanvasState } from "./workspace-shell/useEpisodeCanvasState";
import type {
  DragPayload,
  DetailEditorMode,
  ObjectSortMode,
  SidebarFolder,
  EpisodePinMap,
  NodeResizeDirection,
  NodeSize,
  ObjectMentionQuery
} from "./workspace-shell/workspaceShell.types";

type WorkspaceInteractionScope = "canvas" | "modal" | "none" | "object-panel" | "sidebar";

type KeywordSuggestionPool = {
  consumedLabels: string[];
  contextSignature: string;
  createdAt: number;
  unusedSuggestions: KeywordSuggestion[];
};

type InlineDraftFlushResult = "changed" | "unchanged";

const keywordSuggestionBatchPageCount = 2;

// 인라인 draft를 저장 가능한 노드 content 값으로 정리합니다.
function resolveInlineNodeContent(
  nextText: string,
  nextKeywords: string[]
): {
  contentMode: StoryNodeContentMode;
  keywords: string[];
  text: string;
} {
  const resolvedText = normalizeInlineKeywordTokens(
    normalizeInlineObjectMentions(nextText)
  ).trim();
  const extractedKeywords = extractInlineKeywords(resolvedText);
  const resolvedKeywords = extractedKeywords.length ? extractedKeywords : nextKeywords;

  return {
    contentMode: deriveNodeContentMode(resolvedText, resolvedKeywords),
    keywords: resolvedKeywords,
    text: resolvedText
  };
}

// 키워드 배열이 저장된 값과 달라졌는지 확인합니다.
function haveKeywordListsChanged(left: string[], right: string[]) {
  return left.length !== right.length || left.some((keyword, index) => keyword !== right[index]);
}

// 키워드 추천 label을 비교 가능한 키로 정규화합니다.
function getKeywordSuggestionLabelKey(label: string) {
  return label.trim().toLowerCase();
}

// 키워드 추천 label 목록을 중복 없이 정리합니다.
function cleanKeywordSuggestionLabels(labels: string[]) {
  const cleanLabels: string[] = [];
  const seenLabels = new Set<string>();

  for (const label of labels) {
    const cleanLabel = label.trim();
    const labelKey = getKeywordSuggestionLabelKey(cleanLabel);

    if (!cleanLabel || seenLabels.has(labelKey)) {
      continue;
    }

    seenLabels.add(labelKey);
    cleanLabels.push(cleanLabel);
  }

  return cleanLabels;
}

// 추천 후보에서 빈 label, 중복, 이미 표시한 label을 제거합니다.
function cleanKeywordSuggestionBatch(
  suggestions: KeywordSuggestion[],
  blockedLabels: string[] = []
) {
  const seenLabels = new Set(blockedLabels.map(getKeywordSuggestionLabelKey));
  const cleanSuggestions: KeywordSuggestion[] = [];

  for (const suggestion of suggestions) {
    const cleanLabel = suggestion.label.trim();
    const labelKey = getKeywordSuggestionLabelKey(cleanLabel);

    if (!cleanLabel || seenLabels.has(labelKey)) {
      continue;
    }

    seenLabels.add(labelKey);
    cleanSuggestions.push(
      cleanLabel === suggestion.label
        ? suggestion
        : {
            ...suggestion,
            label: cleanLabel
          }
    );
  }

  return cleanSuggestions;
}

// 현재 빈 슬롯 기준으로 한 번에 요청할 추천 batch 크기를 계산합니다.
function getKeywordSuggestionBatchSize(openSlotCount: number) {
  return Math.max(0, openSlotCount * keywordSuggestionBatchPageCount);
}

// 추천 후보 queue에서 현재 cloud에 표시할 한 페이지를 꺼냅니다.
function takeKeywordSuggestionPage(
  suggestions: KeywordSuggestion[],
  openSlotCount: number
) {
  return {
    pageSuggestions: suggestions.slice(0, openSlotCount),
    remainingSuggestions: suggestions.slice(openSlotCount)
  };
}

// 추천 요청 payload에서 refresh nonce를 제외한 stable context signature를 만듭니다.
function createKeywordSuggestionContextSignature(request: KeywordRecommendationRequest) {
  return JSON.stringify({
    maxSuggestions: request.maxSuggestions,
    selectedKeywords: request.selectedKeywords,
    story: request.story,
    structuredContext: request.structuredContext
  });
}

// 다음 LLM refresh에서 제외할 표시/소비 label 목록을 만듭니다.
function createKeywordSuggestionExclusionLabels(
  displayedSuggestions: KeywordSuggestion[],
  pool: KeywordSuggestionPool | null
) {
  return cleanKeywordSuggestionLabels([
    ...displayedSuggestions.map((suggestion) => suggestion.label),
    ...(pool?.consumedLabels ?? [])
  ]);
}

// 표시한 추천 page를 pool의 소비 이력에 반영합니다.
function updateKeywordSuggestionPool(
  contextSignature: string,
  pool: KeywordSuggestionPool | null,
  pageSuggestions: KeywordSuggestion[],
  remainingSuggestions: KeywordSuggestion[]
): KeywordSuggestionPool {
  return {
    consumedLabels: cleanKeywordSuggestionLabels([
      ...(pool?.consumedLabels ?? []),
      ...pageSuggestions.map((suggestion) => suggestion.label)
    ]),
    contextSignature,
    createdAt: pool?.createdAt ?? Date.now(),
    unusedSuggestions: remainingSuggestions
  };
}

// 이벤트 대상을 워크스페이스 편집 영역으로 분류합니다.
function resolveWorkspaceInteractionScope(
  target: EventTarget | null,
  canvasViewport: HTMLElement | null
): WorkspaceInteractionScope {
  if (!(target instanceof Element)) {
    return "none";
  }

  if (target.closest(".modal-backdrop")) {
    return "modal";
  }

  if (target.closest(".floating-history-controls")) {
    return "canvas";
  }

  if (canvasViewport?.contains(target)) {
    return "canvas";
  }

  if (target.closest(".panel-navigation")) {
    return "sidebar";
  }

  if (target.closest(".panel-details, .panel-objects")) {
    return "object-panel";
  }

  return "none";
}

// 오브젝트 설명은 한 줄 입력으로 저장되도록 줄바꿈을 공백으로 바꿉니다.
function normalizeObjectSummaryInput(value: string) {
  return value.replace(/\s*\r?\n+\s*/g, " ");
}

// 로그인 실패 코드를 사용자 메시지로 변환합니다.
function describeSignInError(error: unknown) {
  const message = toMessage(error);
  const code = message.split(":")[0];

  switch (code) {
    case "google_client_id_is_not_configured":
    case "google_identity_sdk_not_loaded":
      return copy.persistence.signInWithGoogleNotConfigured;
    case "google_auth_not_configured":
    case "google_prompt_not_displayed":
    case "google_identity_script_load_failed":
    case "google_prompt_skipped":
    case "invalid_google_credential_response":
    case "browser_environment_required":
    case "google_login_request_failed":
    case "google_token_verification_failed":
    case "google_login_failed":
    case "credential_required":
      return copy.persistence.signInUnavailable;
    default:
      return message;
  }
}

// 양수 크기 값만 canonical 노드 크기로 인정합니다.
function getPositiveNodeSizeValue(value: number | undefined) {
  return typeof value === "number" && Number.isFinite(value) && value > 0 ? value : null;
}

// 노드의 canonical 크기와 로컬 fallback 크기를 합칩니다.
function resolveNodeSize(
  node: StoryNode,
  localSize: NodeSize | undefined,
  preferLocalSize: boolean
): NodeSize {
  const canonicalWidth = getPositiveNodeSizeValue(node.canvasWidth);
  const canonicalHeight = getPositiveNodeSizeValue(node.canvasHeight);

  return {
    height: preferLocalSize
      ? localSize?.height ?? canonicalHeight ?? nodeCardHeight
      : canonicalHeight ?? localSize?.height ?? nodeCardHeight,
    width: preferLocalSize
      ? localSize?.width ?? canonicalWidth ?? nodeCardWidth
      : canonicalWidth ?? localSize?.width ?? nodeCardWidth
  };
}

// 현재 렌더에서 사용할 노드 크기 맵을 계산합니다.
function buildEffectiveNodeSizes(
  nodes: StoryNode[],
  nodeSizes: Record<string, NodeSize>,
  activeNodeResizeId: string | null
) {
  return Object.fromEntries(
    nodes.map((node) => [
      node.id,
      resolveNodeSize(node, nodeSizes[node.id], activeNodeResizeId === node.id)
    ])
  ) satisfies Record<string, NodeSize>;
}

// 이 컴포넌트는 워크스페이스 화면 전체를 렌더링합니다.
export function WorkspaceShell() {
  const isDrawerUiEnabled = false;
  const [env] = useState(() => loadFrontendEnv());
  const [localStore] = useState(
    () => new LocalPersistenceStore(window.localStorage, env.storagePrefix)
  );
  const [controller] = useState(
    () =>
      new WorkspacePersistenceController({
        auth:
          env.runtimeMode === "standalone"
            ? new StubAuthBoundary(window.localStorage, env.storagePrefix)
            : new SessionAuthBoundary(env.apiBaseUrl, {
                googleClientId: env.googleClientId
              }),
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
  const [activeNodeDragPreview, setActiveNodeDragPreview] = useState<{
    nodeId: string;
    placement: {
      x: number;
      y: number;
    };
  } | null>(null);
  const [activeNodeResizeId, setActiveNodeResizeId] = useState<string | null>(null);
  const [rewireNodeId, setRewireNodeId] = useState<string | null>(null);
  const [deleteTargetId, setDeleteTargetId] = useState<string | null>(null);
  const [isDrawerOpen, setIsDrawerOpen] = useState(false);
  const [aiPanelNodeId, setAiPanelNodeId] = useState<string | null>(null);
  const [keywordSuggestions, setKeywordSuggestions] = useState<KeywordSuggestion[]>([]);
  const [keywordRefreshCycle, setKeywordRefreshCycle] = useState(0);
  const [selectedAiKeywords, setSelectedAiKeywords] = useState<string[]>([]);
  const [recommendationError, setRecommendationError] = useState<string | null>(null);
  const [isLoadingKeywords, setIsLoadingKeywords] = useState(false);
  const [workspaceHistoryScope, setWorkspaceHistoryScope] =
    useState<WorkspaceInteractionScope>("canvas");
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
  const [deleteFolderId, setDeleteFolderId] = useState<string | null>(null);
  const [deleteObjectId, setDeleteObjectId] = useState<string | null>(null);
  const [sidebarFolders, setSidebarFolders] = useState<SidebarFolder[]>([]);
  const [folderEpisodePins, setFolderEpisodePins] = useState<EpisodePinMap>({});
  const [sortingFolderId, setSortingFolderId] = useState<string | null>(null);
  const [draggedSidebarEpisodeId, setDraggedSidebarEpisodeId] = useState<string | null>(null);
  const [pinnedObjectIds, setPinnedObjectIds] = useState<string[]>([]);
  const [detailError, setDetailError] = useState<string | null>(null);
  const [authSignInError, setAuthSignInError] = useState<string | null>(null);
  const [isAuthSignInInProgress, setIsAuthSignInInProgress] = useState(false);
  const [isCanvasFullscreen, setIsCanvasFullscreen] = useState(false);
  const [viewportWidth, setViewportWidth] = useState(() => window.innerWidth);
  const [canvasZoom, setCanvasZoom] = useState(1);
  const [isCanvasPanning, setIsCanvasPanning] = useState(false);
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
  const [hoveredConnectionId, setHoveredConnectionId] = useState<string | null>(null);
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
  const skipNextAutoHeightSyncRef = useRef(false);
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
  const inlineDraftDirtyRef = useRef(false);
  const explicitMentionCreateNamesRef = useRef<Set<string>>(new Set());
  const inlineDraftFlushPromiseRef = useRef<Promise<InlineDraftFlushResult> | null>(null);
  const keywordRequestIdRef = useRef(0);
  const keywordSuggestionPoolRef = useRef<KeywordSuggestionPool | null>(null);
  const runRedoWithInlineDraftFlushRef = useRef<() => Promise<void>>(async () => {});
  const runUndoWithInlineDraftFlushRef = useRef<() => Promise<void>>(async () => {});
  const nodePlacementsRef = useRef(new Map<string, { x: number; y: number }>());
  const visibleNodesRef = useRef<StoryNode[]>(emptyNodes);
  const laneCanvasBoundsRef = useRef<
    Record<StoryNodeLevel, { left: number; right: number; startY: number }> | null
  >(null);
  const timelineAnchorsRef = useRef<ReturnType<typeof getTimelineAnchorPositions> | null>(null);
  const stageHeightRef = useRef(0);
  const majorAnchorNodeIdsByEpisodeRef = useRef<
    Record<string, { endId: string | null; startId: string | null }>
  >({});
  const endMajorNodeIdRef = useRef<string | null>(null);
  const selectedNodeIdRef = useRef<string | null>(null);
  const moveNodeFreelyRef = useRef<
    ((
      nodeId: string,
      level: StoryNodeLevel,
      placement: {
        x: number;
        y: number;
      }
    ) => Promise<void>) | null
  >(null);
  const activeNodeDragPreviewRef = useRef<{
    nodeId: string;
    placement: {
      x: number;
      y: number;
    };
  } | null>(null);
  const suppressNodeClickRef = useRef<string | null>(null);
  const autoNodeHeightsRef = useRef<Record<string, number>>({});
  const isNodeResizingRef = useRef(false);
  const pendingNodeResizeSizeRef = useRef<{
    nodeId: string;
    size: NodeSize;
  } | null>(null);
  const canvasDragStateRef = useRef<
    | {
        kind: "divider";
        divider: "detail-edge" | "second";
        stageLeft: number;
      }
    | {
        kind: "timeline-end";
        followerNodeId: string | null;
        followerNodeSize: NodeSize | null;
        stageTop: number;
      }
    | {
        direction: NodeResizeDirection;
        initialHeight: number;
        initialWidth: number;
        kind: "node-resize";
        level: StoryNodeLevel;
        nodeId: string;
        pointerStartX: number;
        pointerStartY: number;
      }
    | {
        connectionId: string | null;
        kind: "rewire-drag";
        nodeId: string;
        parentId: string | null;
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
    | {
        kind: "node-drag" | "node-drag-pending";
        level: StoryNodeLevel;
        nodeId: string;
        nodeSize: NodeSize;
        pointerOffsetX: number;
        pointerOffsetY: number;
        pointerStartX: number;
        pointerStartY: number;
      }
    | null
  >(null);
  const canvasAutoScrollStateRef = useRef<{
    animationId: number | null;
    dragKind: "node-drag" | "rewire-drag" | null;
    pointerClientX: number;
    pointerClientY: number;
  }>({
    animationId: null,
    dragKind: null,
    pointerClientX: 0,
    pointerClientY: 0
  });

  useEffect(() => {
    const unsubscribe = controller.subscribe(setState);

    void controller.initialize();

    return () => {
      unsubscribe();
      controller.dispose();
    };
  }, [controller]);

  // 브라우저 생명주기 이벤트에서 동기화 플러시를 시도합니다.
  useEffect(() => {
    function flushOnLifecycleEvent() {
      void controller.flushNow();
    }

    function handleVisibilityChange() {
      if (document.visibilityState === "hidden") {
        flushOnLifecycleEvent();
      }
    }

    window.addEventListener("pagehide", flushOnLifecycleEvent);
    window.addEventListener("beforeunload", flushOnLifecycleEvent);
    window.addEventListener("online", flushOnLifecycleEvent);
    document.addEventListener("visibilitychange", handleVisibilityChange);

    return () => {
      window.removeEventListener("pagehide", flushOnLifecycleEvent);
      window.removeEventListener("beforeunload", flushOnLifecycleEvent);
      window.removeEventListener("online", flushOnLifecycleEvent);
      document.removeEventListener("visibilitychange", handleVisibilityChange);
    };
  }, [controller]);

  const activeSidebarProjectId = state?.registry.activeProjectId ?? null;
  const activeEpisodeId = state?.snapshot.project.activeEpisodeId ?? null;
  const cacheScopeKey =
    state && state.session.mode === "authenticated" && state.session.accountId
      ? `account:${state.session.accountId}`
      : "guest";
  const {
    laneDividerXs,
    nodeSizes,
    nodeSizesRef,
    runRedo,
    runUndo,
    setLaneDividerXs,
    setNodeSizes,
    setTimelineEndY,
    timelineEndY
  } = useEpisodeCanvasState({
    activeEpisodeId,
    cacheScopeKey,
    controller,
    snapshotNodes: state?.snapshot.nodes ?? emptyNodes,
    storagePrefix: env.storagePrefix
  });
  const sidebarSnapshotEpisodesRef = useRef<StoryEpisode[]>([]);
  const sidebarSnapshotObjectIdsRef = useRef<Set<string>>(new Set());
  const sidebarStorageRestoreRef = useRef<SidebarStorageRestoreState>({
    folders: null,
    pinnedObjectIds: null,
    pins: null,
    scopeKey: null
  });

  sidebarSnapshotEpisodesRef.current = state?.snapshot.episodes ?? [];
  sidebarSnapshotObjectIdsRef.current = new Set(
    state?.snapshot.objects.map((object) => object.id) ?? []
  );

  useEffect(() => {
    if (!state) {
      return;
    }

    const scopedEpisodeIds = new Set(
      activeEpisodeId
        ? (
            sidebarFolders.find((folder) => folder.episodeIds.includes(activeEpisodeId))
              ?.episodeIds ?? [activeEpisodeId]
          )
        : []
    );
    const scopedObjects = activeEpisodeId
      ? state.snapshot.objects.filter((object) => scopedEpisodeIds.has(object.episodeId))
      : state.snapshot.objects;

    if (
      selectedObjectId === null ||
      !scopedObjects.some((object) => object.id === selectedObjectId)
    ) {
      queueMicrotask(() => {
        setSelectedObjectId(scopedObjects[0]?.id ?? null);
      });
    }
  }, [activeEpisodeId, selectedObjectId, sidebarFolders, state]);

  useEffect(() => {
    window.localStorage.setItem(
      `${env.storagePrefix}:sidebar-collapsed`,
      String(isSidebarCollapsed)
    );
  }, [env.storagePrefix, isSidebarCollapsed]);

  useEffect(() => {
    if (!activeSidebarProjectId) {
      sidebarStorageRestoreRef.current = {
        folders: null,
        pinnedObjectIds: null,
        pins: null,
        scopeKey: null
      };
      queueMicrotask(() => {
        setSidebarFolders((current) => (current.length > 0 ? [] : current));
        setFolderEpisodePins((current) =>
          Object.keys(current).length > 0 ? {} : current
        );
        setPinnedObjectIds((current) => (current.length > 0 ? [] : current));
      });
      return;
    }

    const scopeKey = getSidebarStorageScopeKey(cacheScopeKey, activeSidebarProjectId);
    const foldersKey = `${env.storagePrefix}:${cacheScopeKey}:sidebar-folders:${activeSidebarProjectId}`;
    const pinsKey = `${env.storagePrefix}:${cacheScopeKey}:folder-episode-pins:${activeSidebarProjectId}`;
    const pinnedObjectsKey = `${env.storagePrefix}:${cacheScopeKey}:pinned-objects:${activeSidebarProjectId}`;
    const nextSidebarFolders = sanitizeSidebarFolders(
      parseStoredFolderList(window.localStorage.getItem(foldersKey)),
      sidebarSnapshotEpisodesRef.current,
      { dropEmptyFolders: true }
    );
    const nextFolderEpisodePins = sanitizeEpisodePinMap(
      parseStoredEpisodePinMap(window.localStorage.getItem(pinsKey)),
      sidebarSnapshotEpisodesRef.current
    );
    const nextPinnedObjectIds = parseStoredStringArray(
      window.localStorage.getItem(pinnedObjectsKey)
    ).filter((objectId) => sidebarSnapshotObjectIdsRef.current.has(objectId));

    sidebarStorageRestoreRef.current = {
      folders: JSON.stringify(nextSidebarFolders),
      pinnedObjectIds: JSON.stringify(nextPinnedObjectIds),
      pins: JSON.stringify(nextFolderEpisodePins),
      scopeKey
    };

    queueMicrotask(() => {
      setSidebarFolders(nextSidebarFolders);
      setFolderEpisodePins(nextFolderEpisodePins);
      setPinnedObjectIds(nextPinnedObjectIds);
    });
  }, [activeSidebarProjectId, cacheScopeKey, env.storagePrefix]);

  useEffect(() => {
    if (!activeSidebarProjectId) {
      return;
    }

    const scopeKey = getSidebarStorageScopeKey(cacheScopeKey, activeSidebarProjectId);
    const serializedFolders = JSON.stringify(sidebarFolders);
    const restoreState = sidebarStorageRestoreRef.current;

    if (restoreState.scopeKey !== scopeKey) {
      return;
    }

    if (restoreState.folders !== null) {
      if (restoreState.folders !== serializedFolders) {
        return;
      }

      sidebarStorageRestoreRef.current = {
        ...restoreState,
        folders: null
      };
    }

    const foldersKey = `${env.storagePrefix}:${cacheScopeKey}:sidebar-folders:${activeSidebarProjectId}`;
    window.localStorage.setItem(foldersKey, serializedFolders);
  }, [activeSidebarProjectId, cacheScopeKey, env.storagePrefix, sidebarFolders]);

  useEffect(() => {
    if (!activeSidebarProjectId) {
      return;
    }

    const scopeKey = getSidebarStorageScopeKey(cacheScopeKey, activeSidebarProjectId);
    const serializedPins = JSON.stringify(folderEpisodePins);
    const restoreState = sidebarStorageRestoreRef.current;

    if (restoreState.scopeKey !== scopeKey) {
      return;
    }

    if (restoreState.pins !== null) {
      if (restoreState.pins !== serializedPins) {
        return;
      }

      sidebarStorageRestoreRef.current = {
        ...restoreState,
        pins: null
      };
    }

    const pinsKey = `${env.storagePrefix}:${cacheScopeKey}:folder-episode-pins:${activeSidebarProjectId}`;
    window.localStorage.setItem(pinsKey, serializedPins);
  }, [activeSidebarProjectId, cacheScopeKey, env.storagePrefix, folderEpisodePins]);

  useEffect(() => {
    if (!activeSidebarProjectId) {
      return;
    }

    const scopeKey = getSidebarStorageScopeKey(cacheScopeKey, activeSidebarProjectId);
    const serializedPinnedObjectIds = JSON.stringify(pinnedObjectIds);
    const restoreState = sidebarStorageRestoreRef.current;

    if (restoreState.scopeKey !== scopeKey) {
      return;
    }

    if (restoreState.pinnedObjectIds !== null) {
      if (restoreState.pinnedObjectIds !== serializedPinnedObjectIds) {
        return;
      }

      sidebarStorageRestoreRef.current = {
        ...restoreState,
        pinnedObjectIds: null
      };
    }

    const key = `${env.storagePrefix}:${cacheScopeKey}:pinned-objects:${activeSidebarProjectId}`;
    window.localStorage.setItem(key, serializedPinnedObjectIds);
  }, [activeSidebarProjectId, cacheScopeKey, env.storagePrefix, pinnedObjectIds]);

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

    const sanitizedPins = sanitizeEpisodePinMap(folderEpisodePins, state.snapshot.episodes);
    const changedPins = JSON.stringify(sanitizedPins) !== JSON.stringify(folderEpisodePins);
    const validObjectIds = new Set(state.snapshot.objects.map((object) => object.id));
    const sanitizedPinnedObjectIds = pinnedObjectIds.filter((objectId) =>
      validObjectIds.has(objectId)
    );
    const changedPinnedObjectIds =
      JSON.stringify(sanitizedPinnedObjectIds) !== JSON.stringify(pinnedObjectIds);

    if (changedFolders || changedPins || changedPinnedObjectIds) {
      queueMicrotask(() => {
        if (changedFolders) {
          setSidebarFolders(sanitizedFolders);
        }

        if (changedPins) {
          setFolderEpisodePins(sanitizedPins);
        }

        if (changedPinnedObjectIds) {
          setPinnedObjectIds(sanitizedPinnedObjectIds);
        }
      });
    }
  }, [folderEpisodePins, pinnedObjectIds, sidebarFolders, state]);

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
    function updateRewireDragFromPointer(
      dragState: {
        connectionId: string | null;
        kind: "rewire-drag";
        nodeId: string;
        parentId: string | null;
        stageLeft: number;
        stageTop: number;
      },
      pointer: {
        clientX: number;
        clientY: number;
      }
    ) {
      const hoveredTargetId =
        [...candidateParentIdsRef.current].find((nodeId) => {
          const element = nodeCardRefs.current.get(nodeId);

          if (!element) {
            return false;
          }

          const rect = element.getBoundingClientRect();

          return (
            pointer.clientX >= rect.left &&
            pointer.clientX <= rect.right &&
            pointer.clientY >= rect.top &&
            pointer.clientY <= rect.bottom
          );
        }) ?? null;
      const stageRect = canvasStageRef.current?.getBoundingClientRect();
      const stageLeft = stageRect?.left ?? dragState.stageLeft;
      const stageTop = stageRect?.top ?? dragState.stageTop;

      setRewirePreviewPoint({
        x: (pointer.clientX - stageLeft) / canvasZoom,
        y: (pointer.clientY - stageTop) / canvasZoom
      });
      rewireHoverTargetIdRef.current = hoveredTargetId;
      setRewireHoverTargetId(hoveredTargetId);
    }

    function updateNodeDragFromPointer(
      activeDragState: {
        kind: "node-drag" | "node-drag-pending";
        level: StoryNodeLevel;
        nodeId: string;
        nodeSize: NodeSize;
        pointerOffsetX: number;
        pointerOffsetY: number;
        pointerStartX: number;
        pointerStartY: number;
      },
      pointer: {
        clientX: number;
        clientY: number;
      }
    ) {
      const currentLaneCanvasBounds = laneCanvasBoundsRef.current;
      const currentTimelineAnchors = timelineAnchorsRef.current;

      if (!currentLaneCanvasBounds || !currentTimelineAnchors) {
        return;
      }

      const stageRect = canvasStageRef.current?.getBoundingClientRect();

      if (!stageRect) {
        return;
      }

      const stagePoint = {
        stageRect,
        x: (pointer.clientX - stageRect.left) / canvasZoom,
        y: (pointer.clientY - stageRect.top) / canvasZoom
      };

      const previewPlacement = snapMajorNodePlacementToTimelineAnchors(
        activeDragState.level,
        clampNodePlacement(
          activeDragState.level,
          {
            x: stagePoint.x - activeDragState.pointerOffsetX,
            y: stagePoint.y - activeDragState.pointerOffsetY
          },
          Math.max(
            stageHeightRef.current,
            stagePoint.y - activeDragState.pointerOffsetY + activeDragState.nodeSize.height
          ),
          currentLaneCanvasBounds,
          activeDragState.nodeSize
        ),
        activeDragState.level === "major"
          ? getTimelineAnchorPositions(
            Math.max(
                initialTimelineEndY,
                stagePoint.y - activeDragState.pointerOffsetY + activeDragState.nodeSize.height
              ),
              currentLaneCanvasBounds.major,
              activeDragState.nodeSize
            )
          : currentTimelineAnchors,
        activeDragState.nodeSize
      );

      updateNodeDragPreview({
        nodeId: activeDragState.nodeId,
        placement: previewPlacement
      });

      if (activeDragState.level === "major") {
        setTimelineEndY(
          Math.max(
            initialTimelineEndY,
            Math.max(
              0,
              ...visibleNodesRef.current
                .filter((node) => node.level === "major")
                .map((node) => {
                  const placement =
                    node.id === activeDragState.nodeId
                      ? previewPlacement
                      : nodePlacementsRef.current.get(node.id);
                  const size =
                    node.id === activeDragState.nodeId
                      ? activeDragState.nodeSize
                      : getNodeSize(nodeSizesRef.current, node.id);

                  return (placement?.y ?? 0) + size.height;
                })
            )
          )
        );
      }
    }

    function stopCanvasAutoScroll() {
      const autoScrollState = canvasAutoScrollStateRef.current;

      if (autoScrollState.animationId !== null) {
        window.cancelAnimationFrame(autoScrollState.animationId);
      }

      canvasAutoScrollStateRef.current = {
        ...autoScrollState,
        animationId: null,
        dragKind: null
      };
    }

    function getVisibleCanvasAutoScrollBounds(viewport: HTMLElement) {
      const viewportRect = viewport.getBoundingClientRect();

      return resolveVisibleCanvasAutoScrollBounds({
        browserViewportBottom:
          window.innerHeight || document.documentElement.clientHeight || viewportRect.bottom,
        viewportBottom: viewportRect.bottom,
        viewportTop: viewportRect.top
      });
    }

    function getBrowserAutoScrollBottom(viewport: HTMLElement) {
      return window.innerHeight || document.documentElement.clientHeight || viewport.getBoundingClientRect().bottom;
    }

    function getCanvasAutoScrollVelocity(
      viewport: HTMLElement,
      pointerClientY: number
    ) {
      const autoScrollBounds = getVisibleCanvasAutoScrollBounds(viewport);

      return computeCanvasAutoScrollVelocity({
        pointerClientY,
        viewportBottom: autoScrollBounds.viewportBottom,
        viewportTop: autoScrollBounds.viewportTop
      });
    }

    function getWindowAutoScrollVelocity(
      viewport: HTMLElement,
      pointerClientY: number
    ) {
      return computeCanvasAutoScrollVelocity({
        pointerClientY,
        viewportBottom: getBrowserAutoScrollBottom(viewport),
        viewportTop: 0
      });
    }

    function scrollWindowByVelocity(scrollVelocity: number) {
      if (scrollVelocity === 0) {
        return;
      }

      const scrollingElement =
        document.scrollingElement ?? document.documentElement ?? document.body;

      if (!scrollingElement) {
        return;
      }

      const currentTop = window.scrollY || scrollingElement.scrollTop || 0;
      const browserHeight =
        window.innerHeight ||
        document.documentElement.clientHeight ||
        scrollingElement.clientHeight ||
        0;
      const scrollHeight = Math.max(
        scrollingElement.scrollHeight,
        document.documentElement.scrollHeight,
        document.body?.scrollHeight ?? 0
      );
      const maxScrollTop = Math.max(0, scrollHeight - browserHeight);
      const nextTop = Math.max(0, Math.min(currentTop + scrollVelocity, maxScrollTop));

      if (nextTop === currentTop) {
        return;
      }

      scrollingElement.scrollTop = nextTop;
      document.documentElement.scrollTop = nextTop;

      if (document.body) {
        document.body.scrollTop = nextTop;
      }
    }

    function runCanvasAutoScrollFrame() {
      const autoScrollState = canvasAutoScrollStateRef.current;
      const viewport = canvasViewportRef.current;
      const dragState = canvasDragStateRef.current;

      canvasAutoScrollStateRef.current = {
        ...autoScrollState,
        animationId: null
      };

      if (!viewport || autoScrollState.dragKind === null || !dragState) {
        stopCanvasAutoScroll();
        return;
      }

      const canvasScrollVelocity = getCanvasAutoScrollVelocity(
        viewport,
        autoScrollState.pointerClientY
      );
      const windowScrollVelocity = getWindowAutoScrollVelocity(
        viewport,
        autoScrollState.pointerClientY
      );

      if (canvasScrollVelocity === 0 && windowScrollVelocity === 0) {
        stopCanvasAutoScroll();
        return;
      }

      scrollWindowByVelocity(windowScrollVelocity);

      const maxScrollTop = Math.max(0, viewport.scrollHeight - viewport.clientHeight);
      viewport.scrollTop = Math.max(
        0,
        Math.min(viewport.scrollTop + canvasScrollVelocity, maxScrollTop)
      );

      const pointer = {
        clientX: autoScrollState.pointerClientX,
        clientY: autoScrollState.pointerClientY
      };

      if (autoScrollState.dragKind === "rewire-drag" && dragState.kind === "rewire-drag") {
        updateRewireDragFromPointer(dragState, pointer);
      } else if (autoScrollState.dragKind === "node-drag" && dragState.kind === "node-drag") {
        updateNodeDragFromPointer(dragState, pointer);
      } else {
        stopCanvasAutoScroll();
        return;
      }

      canvasAutoScrollStateRef.current = {
        ...canvasAutoScrollStateRef.current,
        animationId: window.requestAnimationFrame(runCanvasAutoScrollFrame)
      };
    }

    function syncCanvasAutoScroll(
      dragKind: "node-drag" | "rewire-drag",
      pointer: {
        clientX: number;
        clientY: number;
      }
    ) {
      const viewport = canvasViewportRef.current;

      if (!viewport) {
        stopCanvasAutoScroll();
        return;
      }

      const canvasScrollVelocity = getCanvasAutoScrollVelocity(viewport, pointer.clientY);
      const windowScrollVelocity = getWindowAutoScrollVelocity(viewport, pointer.clientY);

      canvasAutoScrollStateRef.current = {
        ...canvasAutoScrollStateRef.current,
        dragKind,
        pointerClientX: pointer.clientX,
        pointerClientY: pointer.clientY
      };

      if (canvasScrollVelocity === 0 && windowScrollVelocity === 0) {
        stopCanvasAutoScroll();
        return;
      }

      if (canvasAutoScrollStateRef.current.animationId === null) {
        canvasAutoScrollStateRef.current = {
          ...canvasAutoScrollStateRef.current,
          animationId: window.requestAnimationFrame(runCanvasAutoScrollFrame)
        };
      }
    }

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
        updateRewireDragFromPointer(dragState, event);
        syncCanvasAutoScroll("rewire-drag", event);
        return;
      }

      if (dragState.kind === "node-resize") {
        const deltaX = (event.clientX - dragState.pointerStartX) / canvasZoom;
        const deltaY = (event.clientY - dragState.pointerStartY) / canvasZoom;
        // 현재 분할선 상태와 이웃 레인 최소 폭을 반영해 레벨별 최대 너비를 제한합니다.
        const maxSecondDividerX = maxCanvasContentRight - minLaneWidth - laneGap / 2;
        const maxMajorLaneWidth =
          maxCanvasContentRight - stageInnerLeft - minLaneWidth * 2 - laneGap * 2;
        const maxMinorOrDetailLaneWidth =
          maxSecondDividerX - effectiveFirstDividerXRef.current - laneGap;
        const maxAllowedLaneWidth =
          dragState.level === "major" ? maxMajorLaneWidth : maxMinorOrDetailLaneWidth;
        const maxResizableNodeWidth = Math.max(
          nodeCardWidth,
          maxAllowedLaneWidth - laneDividerNodePadding * 2
        );
        const nextHeight =
          dragState.direction === "horizontal"
            ? dragState.initialHeight
            : Math.max(nodeCardHeight, dragState.initialHeight + deltaY);
        const nextWidth =
          dragState.direction === "vertical"
            ? dragState.initialWidth
            : Math.min(
                maxResizableNodeWidth,
                Math.max(nodeCardWidth, dragState.initialWidth + deltaX)
              );
        const nextNodeSize = {
          height: nextHeight,
          width: nextWidth
        };

        pendingNodeResizeSizeRef.current = {
          nodeId: dragState.nodeId,
          size: nextNodeSize
        };

        setNodeSizes((current) => ({
          ...current,
          [dragState.nodeId]: nextNodeSize
        }));

        return;
      }

      if (dragState.kind === "node-drag-pending" || dragState.kind === "node-drag") {
        const deltaX = event.clientX - dragState.pointerStartX;
        const deltaY = event.clientY - dragState.pointerStartY;

        if (
          dragState.kind === "node-drag-pending" &&
          Math.hypot(deltaX, deltaY) < 6
        ) {
          return;
        }

        const activeDragState =
          dragState.kind === "node-drag-pending"
            ? {
                ...dragState,
                kind: "node-drag" as const
              }
            : dragState;

        if (dragState.kind === "node-drag-pending") {
          canvasDragStateRef.current = activeDragState;
          suppressNodeClickRef.current = dragState.nodeId;
        }

        updateNodeDragFromPointer(activeDragState, event);
        syncCanvasAutoScroll("node-drag", event);
        return;
      }

      if (dragState.kind !== "timeline-end") {
        return;
      }

      const nextTimelineEndY = Math.max(
        initialTimelineEndY,
        (event.clientY - dragState.stageTop) / canvasZoom
      );
      const followerNodeId = dragState.followerNodeId;
      const followerNodeSize = dragState.followerNodeSize;

      if (!followerNodeId || !followerNodeSize) {
        updateNodeDragPreview(null);
        setTimelineEndY(nextTimelineEndY);
        return;
      }

      const followerPreviewPlacement = getTimelineEndFollowerPlacement(
        followerNodeId,
        nextTimelineEndY,
        followerNodeSize
      );

      if (!followerPreviewPlacement) {
        updateNodeDragPreview(null);
        setTimelineEndY(nextTimelineEndY);
        return;
      }

      updateNodeDragPreview({
        nodeId: followerNodeId,
        placement: followerPreviewPlacement
      });
      setTimelineEndY(
        Math.max(nextTimelineEndY, followerPreviewPlacement.y + followerNodeSize.height)
      );
    }

    function clearPointerDrag() {
      stopCanvasAutoScroll();
      const dragState = canvasDragStateRef.current;
      canvasDragStateRef.current = null;
      setIsCanvasPanning(false);
      const activeNodeDragPreview = activeNodeDragPreviewRef.current;

      if (dragState?.kind === "node-resize") {
        isNodeResizingRef.current = false;
        const resizedNodeSize =
          pendingNodeResizeSizeRef.current?.nodeId === dragState.nodeId
            ? pendingNodeResizeSizeRef.current.size
            : getNodeSize(nodeSizesRef.current, dragState.nodeId);

        pendingNodeResizeSizeRef.current = null;
        void controller
          .updateNodePlacement(dragState.nodeId, {
            canvasHeight: resizedNodeSize.height,
            canvasWidth: resizedNodeSize.width
          })
          .finally(() => {
            setActiveNodeResizeId((current) =>
              current === dragState.nodeId ? null : current
            );
          });
      }

      if (dragState?.kind === "node-drag" || dragState?.kind === "node-drag-pending") {
        updateNodeDragPreview(null);

        if (
          dragState.kind === "node-drag" &&
          activeNodeDragPreview &&
          activeNodeDragPreview.nodeId === dragState.nodeId
        ) {
          void moveNodeFreelyRef.current?.(
            dragState.nodeId,
            dragState.level,
            activeNodeDragPreview.placement
          );
        }

        if (dragState.kind === "node-drag") {
          window.requestAnimationFrame(() => {
            if (suppressNodeClickRef.current === dragState.nodeId) {
              suppressNodeClickRef.current = null;
            }
          });
        }
      }

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
        setHoveredConnectionId(null);
      }

      if (dragState?.kind === "timeline-end") {
        const followerNodeId = dragState.followerNodeId;
        const followerPreviewPlacement =
          followerNodeId && activeNodeDragPreview?.nodeId === followerNodeId
            ? activeNodeDragPreview.placement
            : null;

        updateNodeDragPreview(null);

        if (followerNodeId && followerPreviewPlacement) {
          void moveNodeFreelyRef.current?.(followerNodeId, "major", followerPreviewPlacement);
          setSelectedNodeId(followerNodeId);
          setRewireNodeId(null);
        }
      }

      if (dragState?.kind === "node-resize" && selectedNodeIdRef.current === dragState.nodeId) {
        window.requestAnimationFrame(() => {
          syncSelectedNodeInputHeight(dragState.nodeId, selectedNodeInputRef.current, {
            preserveManualHeight: dragState.direction !== "horizontal"
          });

          if (dragState.level === "major") {
            const nextLowestMajorBottom = Math.max(
              0,
              ...visibleNodesRef.current
                .filter((node) => node.level === "major")
                .map((node) => {
                  const placement = nodePlacementsRef.current.get(node.id);
                  const size = getNodeSize(nodeSizesRef.current, node.id);
                  return (placement?.y ?? 0) + size.height;
                })
            );

            setTimelineEndY(Math.max(initialTimelineEndY, nextLowestMajorBottom));
          }
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
      stopCanvasAutoScroll();
    };
  // syncSelectedNodeInputHeight는 렌더마다 새로 정의되므로 deps에 포함하지 않습니다.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    canvasZoom,
    controller,
    nodeSizesRef,
    setLaneDividerXs,
    setNodeSizes,
    setTimelineEndY
  ]);

  const hasWorkspaceState = state !== null;
  useEffect(() => {
    const viewport = canvasViewportRef.current;

    if (!viewport) {
      return;
    }
    const viewportElement = viewport;

    // 캔버스 내부 요소 위의 Ctrl/Cmd + 휠 입력을 캔버스 줌으로 처리합니다.
    function handleCanvasViewportWheel(event: WheelEvent) {
      if (!(event.ctrlKey || event.metaKey)) {
        return;
      }

      if (!(event.target instanceof Node) || !viewportElement.contains(event.target)) {
        return;
      }

      event.preventDefault();
      const viewportRect = viewportElement.getBoundingClientRect();
      const pointerOffsetX = event.clientX - viewportRect.left + viewportElement.scrollLeft;
      const pointerOffsetY = event.clientY - viewportRect.top + viewportElement.scrollTop;
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
        viewportElement.scrollLeft = Math.max(
          0,
          nextPointerOffsetX - (event.clientX - viewportRect.left)
        );
        viewportElement.scrollTop = Math.max(
          0,
          nextPointerOffsetY - (event.clientY - viewportRect.top)
        );
      });
    }

    viewportElement.addEventListener("wheel", handleCanvasViewportWheel, {
      passive: false
    });

    return () => {
      viewportElement.removeEventListener("wheel", handleCanvasViewportWheel);
    };
  }, [canvasZoom, hasWorkspaceState]);

  const orderedNodes =
    state && activeEpisodeId
      ? sortNodesByOrder(
          state.snapshot.nodes.filter((node) => node.episodeId === activeEpisodeId)
        )
      : emptyNodes;
  const effectiveNodeSizes = buildEffectiveNodeSizes(
    orderedNodes,
    nodeSizes,
    activeNodeResizeId
  );
  const activeDrawerItems =
    state && activeEpisodeId
      ? state.snapshot.temporaryDrawer.filter((item) => item.episodeId === activeEpisodeId)
      : [];
  const activeFolder =
    activeEpisodeId
      ? sidebarFolders.find((folder) => folder.episodeIds.includes(activeEpisodeId)) ?? null
      : null;
  const scopedEpisodeIds = new Set(
    activeFolder?.episodeIds ?? (activeEpisodeId ? [activeEpisodeId] : [])
  );
  const activeEpisodeObjects =
    state && activeEpisodeId
      ? state.snapshot.objects.filter((object) => scopedEpisodeIds.has(object.episodeId))
      : [];
  const episodesById = new Map(
    (state?.snapshot.episodes ?? []).map((episode) => [episode.id, episode])
  );
  const nodesById = new Map(orderedNodes.map((node) => [node.id, node]));
  const selectedNode =
    (selectedNodeId ? nodesById.get(selectedNodeId) : null) ?? orderedNodes[0] ?? null;
  const selectedNodeIdentity = selectedNodeId ?? orderedNodes[0]?.id ?? null;
  const objectsById = new Map(activeEpisodeObjects.map((object) => [object.id, object]));
  const selectedObject =
    state === null
      ? null
      : (selectedObjectId ? objectsById.get(selectedObjectId) ?? null : null) ||
        activeEpisodeObjects.at(0) ||
        null;
  const selectedObjectEpisodeTitle = selectedObject
    ? (episodesById.get(selectedObject.episodeId)?.title ?? copy.workspace.objectEpisodeMissing)
    : null;
  const isAuthenticated = state ? state.session.mode === "authenticated" : false;
  const isGoogleSignInEnabled = env.isGoogleClientIdConfigured;
  const signInLabel = isGoogleSignInEnabled
    ? copy.persistence.signInWithGoogle
    : copy.persistence.signIn;
  const isBusy =
    state === null
      ? true
      : state.syncStatus === "booting" ||
        state.syncStatus === "importing" ||
        state.syncStatus === "syncing";
  const canUseCanvasHistory = workspaceHistoryScope === "canvas" && !isBusy;
  const hasSelectedNodeDirtyInlineDraft =
    inlineDraftDirtyRef.current &&
    selectedNode !== null &&
    !selectedNode.isFixed &&
    (() => {
      const resolvedContent = resolveInlineNodeContent(
        inlineNodeTextDraft,
        selectedAiKeywords
      );

      return (
        resolvedContent.text !== selectedNode.text.trim() ||
        haveKeywordListsChanged(selectedNode.keywords, resolvedContent.keywords)
      );
    })();
  const canUseCanvasUndo =
    canUseCanvasHistory && ((state?.history.canUndo ?? false) || hasSelectedNodeDirtyInlineDraft);
  const canUseCanvasRedo =
    canUseCanvasHistory && !hasSelectedNodeDirtyInlineDraft && (state?.history.canRedo ?? false);
  const isAuthBusy = isBusy || isAuthSignInInProgress;

  const handleSignInWithGoogle = useCallback(() => {
    setIsMoreVisible(false);
    setAuthSignInError(null);

    if (!isGoogleSignInEnabled) {
      setAuthSignInError(copy.persistence.signInWithGoogleNotConfigured);
      return;
    }

    if (isAuthSignInInProgress) {
      return;
    }

    setIsAuthSignInInProgress(true);

    void (async () => {
      try {
        await controller.signIn();
      } catch (error) {
        setAuthSignInError(describeSignInError(error));
      } finally {
        setIsAuthSignInInProgress(false);
      }
    })();
  }, [controller, isGoogleSignInEnabled, isAuthSignInInProgress]);

  useEffect(() => {
    if (isAuthenticated) {
      queueMicrotask(() => {
        setAuthSignInError(null);
      });
    }
  }, [isAuthenticated]);

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
    skipNextAutoHeightSyncRef.current = true;

    const nextSelectedNode = selectedNodeId
      ? orderedNodes.find((node) => node.id === selectedNodeId) || orderedNodes[0] || null
      : orderedNodes[0] || null;

    if (nextSelectedNode) {
      const nextInlineText = buildInlineEditorText(
        nextSelectedNode.text,
        nextSelectedNode.keywords
      );
      inlineMentionSignatureRef.current[nextSelectedNode.id] = getObjectMentionSignature(
        nextInlineText
      );
      queueMicrotask(() => {
        inlineDraftDirtyRef.current = false;
        setInlineNodeTextDraft(nextInlineText);
        setSelectedAiKeywords(extractInlineKeywords(nextInlineText));
        setIsNodeMoreMenuOpen(false);
        setNodeMenuPosition(null);
        setObjectMentionQuery(null);
        setObjectMentionMenuPosition(null);
        setActiveObjectMentionIndex(0);
        setDetailError(null);
      });
    } else {
      queueMicrotask(() => {
        inlineDraftDirtyRef.current = false;
        setInlineNodeTextDraft("");
        setSelectedAiKeywords([]);
        setIsNodeMoreMenuOpen(false);
        setNodeMenuPosition(null);
        setObjectMentionQuery(null);
        setObjectMentionMenuPosition(null);
        setActiveObjectMentionIndex(0);
        setDetailError(null);
      });
    }
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

    if (skipNextAutoHeightSyncRef.current) {
      skipNextAutoHeightSyncRef.current = false;
      return;
    }

    const animationId = window.requestAnimationFrame(() => {
      syncSelectedNodeInputHeight(selectedNode.id, selectedNodeInputRef.current);
    });

    return () => {
      window.cancelAnimationFrame(animationId);
    };
  // syncSelectedNodeInputHeight는 렌더마다 새로 정의되므로 deps에 포함하지 않습니다.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedAiKeywords, inlineNodeTextDraft, selectedNode, selectedNodeIdentity]);

  useEffect(() => {
    if (detailMode === "object" && selectedObject) {
      queueMicrotask(() => {
        setObjectEditorDraft({
          category: selectedObject.category,
          name: selectedObject.name,
          summary: selectedObject.summary
        });
        setDetailError(null);
      });
    }
  }, [detailMode, selectedObject]);

  useEffect(() => {
    if (!state) {
      return;
    }

    function handleGlobalKeyDown(event: KeyboardEvent) {
      const key = event.key.toLowerCase();
      const usesModifier = event.ctrlKey || event.metaKey;
      const viewport = canvasViewportRef.current;
      const targetElement = event.target instanceof Element ? event.target : null;
      const isCanvasEventTarget =
        targetElement !== null &&
        viewport !== null &&
        viewport.contains(targetElement);
      const keyboardInteractionScope = resolveWorkspaceInteractionScope(targetElement, viewport);
      const hasCanvasHistoryScope =
        workspaceHistoryScope === "canvas" || keyboardInteractionScope === "canvas";

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

        if (deleteFolderId !== null) {
          event.preventDefault();
          setDeleteFolderId(null);
          return;
        }

        if (deleteObjectId !== null) {
          event.preventDefault();
          setDeleteObjectId(null);
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
          canvasDragStateRef.current = null;
          rewireHoverTargetIdRef.current = null;
          setRewireHoverTargetId(null);
          setRewirePreviewPoint(null);
          setRewireNodeId(null);
          setHoveredConnectionId(null);
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
      const canUseCanvasShortcuts =
        hasCanvasHistoryScope &&
        (isCanvasEventTarget ||
          isSelectedNodeInputTarget ||
          targetElement === document.body ||
          targetElement === document.documentElement);
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
        usesModifier &&
        ((key === "z" || key === "y") ||
          (!inlineEditorHasSelection &&
            (key === "c" || (key === "v" && copiedNodeTreeRef.current !== null))));

      if (
        usesModifier &&
        !canUseCanvasShortcuts &&
        (key === "z" ||
          key === "y" ||
          key === "c" ||
          key === "v" ||
          key === "+" ||
          key === "-" ||
          key === "=" ||
          key === "0")
      ) {
        return;
      }

      if ((isEditableTarget(event.target) && !canUseNodeShortcutFromInlineEditor) || isBusy) {
        return;
      }

      if (event.key === "Delete" && !usesModifier) {
        const sidebarEpisodeElement = targetElement?.closest("[data-sidebar-episode-id]");
        const sidebarFolderElement = targetElement?.closest("[data-sidebar-folder-id]");
        const objectElement = targetElement?.closest("[data-object-id]");

        if (
          keyboardInteractionScope === "sidebar" &&
          sidebarEpisodeElement instanceof HTMLElement
        ) {
          const episodeId = sidebarEpisodeElement.dataset.sidebarEpisodeId;

          if (episodeId) {
            event.preventDefault();
            setDeleteEpisodeId(episodeId);
            setEpisodeMenuId(null);
            setEpisodeMenuPosition(null);
            setFolderPickerEpisodeId(null);
            setFolderPickerPosition(null);
            return;
          }
        }

        if (
          keyboardInteractionScope === "sidebar" &&
          sidebarFolderElement instanceof HTMLElement
        ) {
          const folderId = sidebarFolderElement.dataset.sidebarFolderId;

          if (folderId) {
            event.preventDefault();
            setDeleteFolderId(folderId);
            setFolderMenuId(null);
            setFolderMenuPosition(null);
            return;
          }
        }

        if (keyboardInteractionScope === "object-panel") {
          const objectId =
            objectElement instanceof HTMLElement
              ? objectElement.dataset.objectId
              : selectedObject?.id;

          if (objectId) {
            event.preventDefault();
            setDeleteObjectId(objectId);
            setObjectMenuId(null);
            setObjectMenuPosition(null);
            return;
          }
        }
      }

      if (!hasCanvasHistoryScope) {
        return;
      }

      if (usesModifier && (key === "+" || key === "=")) {
        event.preventDefault();
        setCanvasZoom((current) => clampCanvasZoom(current + 0.1));
        return;
      }

      if (usesModifier && key === "-") {
        event.preventDefault();
        setCanvasZoom((current) => clampCanvasZoom(current - 0.1));
        return;
      }

      if (usesModifier && key === "0") {
        event.preventDefault();
        setCanvasZoom(1);
        return;
      }

      if (usesModifier && key === "z") {
        event.preventDefault();

        if (event.shiftKey) {
          void runRedoWithInlineDraftFlushRef.current();
        } else {
          void runUndoWithInlineDraftFlushRef.current();
        }

        return;
      }

      if (usesModifier && key === "y") {
        event.preventDefault();
        void runRedoWithInlineDraftFlushRef.current();
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
    deleteFolderId,
    deleteObjectId,
    deleteTargetId,
    detailMode,
    draftVisible,
    episodeMenuId,
    folderMenuId,
    folderPickerEpisodeId,
    isFolderCreatorVisible,
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
    selectedObject,
    state,
    workspaceHistoryScope
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

  const isWorkspaceEmptyState =
    state.snapshot.episodes.length === 0 &&
    state.snapshot.nodes.length === 0 &&
    state.snapshot.temporaryDrawer.length === 0;
  const isAuthenticatedEmptyState =
    state.session.mode === "authenticated" &&
    state.linkage === null &&
    isWorkspaceEmptyState &&
    (state.cloudProjectCount === 0 ||
      state.syncStatus === "authenticated-empty" ||
      state.syncStatus === "error");
  const isEmptyStateBusy =
    isAuthSignInInProgress ||
    state.syncStatus === "importing" ||
    state.syncStatus === "syncing";

  if (isAuthenticatedEmptyState) {
    return (
      <div className="workspace-shell workspace-shell-loading">
        <section className="panel panel-canvas">
          <span className="eyebrow">Center</span>
          <h1>{copy.workspace.title}</h1>
          <p>{copy.persistence.authenticatedEmptyState}</p>
          <div className="control-row">
            <button
              disabled={isEmptyStateBusy}
              onClick={() => {
                setAuthSignInError(null);
                setDetailError(null);
                void controller.createWorkspaceFromEmptyState().catch((error) => {
                  setDetailError(toMessage(error));
                });
              }}
              type="button"
            >
              {copy.persistence.createProject}
            </button>
            <button
              className="button-secondary"
              disabled={isEmptyStateBusy}
              onClick={() => {
                setAuthSignInError(null);
                setDetailError(null);
                void controller.signOut().catch((error) => {
                  setAuthSignInError(describeSignInError(error));
                });
              }}
              type="button"
            >
              {copy.persistence.signOut}
            </button>
          </div>
          <p>{describeCloudStatus(state)}</p>
          {state.lastError ? <p>{`Error: ${state.lastError}`}</p> : null}
          {authSignInError ? <p>{authSignInError}</p> : null}
          {detailError ? <p>{detailError}</p> : null}
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
  const majorLaneRequiredWidth = Math.max(
    minLaneWidth,
    ...visibleNodes
      .filter((node) => node.level === "major")
      .map((node) => getNodeSize(effectiveNodeSizes, node.id).width + laneDividerNodePadding * 2)
  );
  const minorLaneRequiredWidth = Math.max(
    minLaneWidth,
    ...visibleNodes
      .filter((node) => node.level === "minor")
      .map((node) => getNodeSize(effectiveNodeSizes, node.id).width + laneDividerNodePadding * 2)
  );
  const detailLaneRequiredWidth = Math.max(
    minLaneWidth,
    ...visibleNodes
      .filter((node) => node.level === "detail")
      .map((node) => getNodeSize(effectiveNodeSizes, node.id).width + laneDividerNodePadding * 2)
  );
  const autoFirstDividerX = Math.max(
    initialLaneDividerXs.first,
    stageInnerLeft + majorLaneRequiredWidth + laneGap / 2
  );
  const effectiveFirstDividerX = autoFirstDividerX;
  const autoSecondDividerX = Math.max(
    effectiveFirstDividerX + minLaneWidth + laneGap,
    effectiveFirstDividerX + laneGap + minorLaneRequiredWidth
  );
  const maxSecondDividerX = maxCanvasContentRight - minLaneWidth - laneGap / 2;
  const effectiveSecondDividerX = Math.min(
    maxSecondDividerX,
    Math.max(laneDividerXs.second, autoSecondDividerX)
  );
  const autoDetailEdgeX = Math.max(
    minimumVisibleDetailEdge,
    effectiveSecondDividerX + minLaneWidth + laneGap / 2,
    effectiveSecondDividerX + laneGap / 2 + detailLaneRequiredWidth
  );
  const effectiveDetailEdgeX = Math.min(
    maxCanvasContentRight,
    Math.max(laneDividerXs.detailEdge, autoDetailEdgeX)
  );
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
  const minimumTimelineEndY = Math.max(initialTimelineEndY, timelineEndY);
  const timelineAnchors = getTimelineAnchorPositions(
    minimumTimelineEndY,
    laneCanvasBounds.major,
    {
      height: nodeCardHeight,
      width: nodeCardWidth
    }
  );
  const orderedMajorNodes = orderedNodes.filter((node) => node.level === "major");
  const lockedStartMajorNodeId = orderedMajorNodes[0]?.id ?? null;
  const lockedEndMajorNodeId = orderedMajorNodes.at(-1)?.id ?? lockedStartMajorNodeId;
  // 이 함수는 major 시작/끝 앵커 노드의 기준 배치를 계산합니다.
  function getAnchoredMajorPlacement(node: StoryNode, nodeSize: NodeSize) {
    const fallbackPlacement = getFallbackNodePlacementWithinBounds(
      node,
      orderedNodes,
      laneCanvasBounds,
      nodeSize
    );
    const snappedPlacement = snapMajorNodePlacementToTimelineAnchors(
      node.level,
      fallbackPlacement,
      timelineAnchors,
      nodeSize
    );
    const alignedMajorAnchorX = timelineAnchors.railCenterX - nodeSize.width / 2;

    if (node.id === lockedStartMajorNodeId) {
      return {
        ...snappedPlacement,
        x: alignedMajorAnchorX,
        y: timelineAnchors.startNodeY
      };
    }

    return snappedPlacement;
  }

  const baseNodePlacements = new Map<string, { x: number; y: number }>();

  for (const node of visibleNodes) {
    const nodeSize = getNodeSize(effectiveNodeSizes, node.id);

    const fallbackPlacement = getFallbackNodePlacementWithinBounds(
      node,
      orderedNodes,
      laneCanvasBounds,
      nodeSize
    );
    const alignedPlacement =
      node.level === "major"
        ? getAnchoredMajorPlacement(node, nodeSize)
        : fallbackPlacement;

    baseNodePlacements.set(node.id, alignedPlacement);
  }
  const laneLayoutsByLevel = buildLaneLayoutsByLevel({
    basePlacements: baseNodePlacements,
    gap: 8,
    nodes: visibleNodes,
    nodeSizes: effectiveNodeSizes,
    priorityNodeIdsByLevel: {
      major: [lockedStartMajorNodeId]
    }
  });
  const nodePlacements = getLaneLayoutNodePlacements(laneLayoutsByLevel);
  const visualNodePlacements = new Map(nodePlacements);

  if (activeNodeDragPreview) {
    visualNodePlacements.set(activeNodeDragPreview.nodeId, activeNodeDragPreview.placement);
  }

  const majorLaneTimelineLocalCenterX =
    timelineAnchors.railCenterX - laneCanvasBounds.major.left;
  const connectionLines = buildConnectionLines(
    visibleNodes,
    visualNodePlacements,
    effectiveNodeSizes
  );
  const activeConnection =
    hoveredConnectionId !== null
      ? connectionLines.find((line) => line.id === hoveredConnectionId) ?? null
      : null;
  const lowestNodeBottom = Math.max(
    0,
    ...visibleNodes.map((node) => {
      const placement =
        activeNodeDragPreview?.nodeId === node.id
          ? activeNodeDragPreview.placement
          : nodePlacements.get(node.id);
      const nodeSize = getNodeSize(effectiveNodeSizes, node.id);
      return (placement?.y ?? 0) + nodeSize.height;
    })
  );
  const visualMajorPlacements = orderedMajorNodes
    .map((node) => {
      const placement =
        activeNodeDragPreview?.nodeId === node.id
          ? activeNodeDragPreview.placement
          : nodePlacements.get(node.id);

      if (!placement) {
        return null;
      }

      const nodeSize = getNodeSize(effectiveNodeSizes, node.id);

      return {
        id: node.id,
        bottomY: placement.y + nodeSize.height,
        topY: placement.y
      };
    })
    .filter(
      (
        entry
      ): entry is {
        id: string;
        bottomY: number;
        topY: number;
      } => {
        return entry !== null;
      }
    );
  const visualStartMajorNodeId =
    [...visualMajorPlacements].sort((left, right) => left.topY - right.topY)[0]?.id ?? null;
  const visualEndMajorNodeId =
    [...visualMajorPlacements].sort((left, right) => right.bottomY - left.bottomY)[0]?.id ?? null;
  const timelineEndFollowerNodeId =
    canvasDragStateRef.current?.kind === "timeline-end"
      ? canvasDragStateRef.current.followerNodeId
      : null;
  const startMajorNodeId = visualStartMajorNodeId ?? lockedStartMajorNodeId;
  const endMajorNodeId =
    timelineEndFollowerNodeId ?? visualEndMajorNodeId ?? lockedEndMajorNodeId;
  const endMajorPlacement =
    endMajorNodeId === null
      ? null
      : activeNodeDragPreview?.nodeId === endMajorNodeId
        ? activeNodeDragPreview.placement
        : (nodePlacements.get(endMajorNodeId) ?? null);
  const endMajorNodeSize =
    endMajorNodeId === null
      ? null
      : getNodeSize(effectiveNodeSizes, endMajorNodeId);
  const endMajorBottomY =
    endMajorPlacement && endMajorNodeSize
      ? endMajorPlacement.y + endMajorNodeSize.height
      : minimumTimelineEndY;
  const effectiveTimelineEndY = Math.max(
    minimumTimelineEndY,
    endMajorBottomY
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

  // 이 함수는 같은 레벨 노드의 중심 Y를 기준으로 삽입 인덱스를 계산합니다.
  function getInsertIndexForCanvasY(
    level: StoryNodeLevel,
    targetCenterY: number,
    excludedNodeId?: string
  ) {
    const sortedLevelNodesByCenterY = [...visibleNodes]
      .filter((node) => node.level === level && node.id !== excludedNodeId)
      .map((node) => {
        const placement = nodePlacements.get(node.id);
        const size = getNodeSize(effectiveNodeSizes, node.id);

        return {
          centerY: (placement?.y ?? 0) + size.height / 2,
          node
        };
      })
      .sort((left, right) => {
        return left.centerY - right.centerY;
      });

    if (sortedLevelNodesByCenterY.length === 0) {
      if (excludedNodeId) {
        const originalIndex = orderedNodes.findIndex((node) => node.id === excludedNodeId);
        return originalIndex === -1 ? orderedNodes.length : originalIndex;
      }

      return orderedNodes.length;
    }

    const firstEntry = sortedLevelNodesByCenterY[0];

    if (!firstEntry) {
      return orderedNodes.length;
    }

    const anchorEntry =
      targetCenterY <= firstEntry.centerY
        ? firstEntry
        : sortedLevelNodesByCenterY.find((entry) => entry.centerY > targetCenterY);
    const anchorNode = anchorEntry?.node;

    if (!anchorNode) {
      const lastSameLevelIndex = orderedNodes
        .map((node, index) => ({ node, index }))
        .filter(({ node }) => node.level === level && node.id !== excludedNodeId)
        .at(-1)?.index;
      if (lastSameLevelIndex === undefined) {
        const originalIndex = orderedNodes.findIndex((node) => node.id === excludedNodeId);

        return originalIndex === -1 ? orderedNodes.length : originalIndex;
      }

      return Math.min(lastSameLevelIndex + 1, orderedNodes.length);
    }

    const orderedIndex = orderedNodes.findIndex((node) => node.id === anchorNode.id);

    return orderedIndex === -1 ? orderedNodes.length : orderedIndex;
  }

  // 이 함수는 배치 중심 Y에 가장 가까운 부모 노드를 찾습니다.
  function getNearestParentIdForCanvasY(
    level: StoryNodeLevel,
    targetCenterY: number,
    excludedNodeIds?: Set<string>
  ) {
    return resolveNearestParentIdByY({
      excludedNodeIds,
      level,
      nodePlacements,
      nodes: visibleNodes,
      nodeSizes: effectiveNodeSizes,
      targetCenterY
    });
  }

  // 이 함수는 major 노드 기준의 타임라인 끝 후보를 계산합니다.
  function getProjectedLowestMajorNodeBottom(
    overrideNodeId?: string,
    overridePlacement?: { x: number; y: number },
    overrideSize?: NodeSize
  ) {
    return Math.max(
      0,
      ...visibleNodes
        .filter((node) => node.level === "major")
        .map((node) => {
          const placement =
            node.id === overrideNodeId && overridePlacement
              ? overridePlacement
              : nodePlacements.get(node.id);
          const nodeSize =
            node.id === overrideNodeId && overrideSize
              ? overrideSize
              : getNodeSize(effectiveNodeSizes, node.id);

          return (placement?.y ?? 0) + nodeSize.height;
        })
    );
  }

  // 이 함수는 timeline-end 드래그 시 end major 노드의 미리보기 배치를 계산합니다.
  function getTimelineEndFollowerPlacement(
    followerNodeId: string,
    nextTimelineEndY: number,
    followerNodeSize: NodeSize
  ) {
    const currentLaneCanvasBounds = laneCanvasBoundsRef.current;

    if (!currentLaneCanvasBounds) {
      return null;
    }

    const clampedTimelineEndY = Math.max(initialTimelineEndY, nextTimelineEndY);
    const dynamicTimelineAnchors = getTimelineAnchorPositions(
      clampedTimelineEndY,
      currentLaneCanvasBounds.major,
      followerNodeSize
    );
    const followerPlacement = nodePlacementsRef.current.get(followerNodeId);

    return snapMajorNodePlacementToTimelineAnchors(
      "major",
      {
        x: followerPlacement?.x ?? dynamicTimelineAnchors.snappedNodeX,
        y: clampedTimelineEndY - followerNodeSize.height
      },
      dynamicTimelineAnchors,
      followerNodeSize
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

  // 이 함수는 드래그 중인 노드의 미리보기 위치를 함께 갱신합니다.
  function updateNodeDragPreview(
    preview: {
      nodeId: string;
      placement: {
        x: number;
        y: number;
      };
    } | null
  ) {
    const currentPreview = activeNodeDragPreviewRef.current;
    const isSamePreview =
      currentPreview?.nodeId === preview?.nodeId &&
      currentPreview?.placement.x === preview?.placement.x &&
      currentPreview?.placement.y === preview?.placement.y;

    if (isSamePreview) {
      return;
    }

    activeNodeDragPreviewRef.current = preview;
    setActiveNodeDragPreview(preview);
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

    if (viewport && canStartCanvasPan(event.target)) {
      viewport.focus({
        preventScroll: true
      });
    }

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

  function maybeExtendTimelineForDraggedNode(
    clientY: number,
    level: StoryNodeLevel,
    nodeSize: NodeSize
  ) {
    if (level !== "major") {
      return;
    }

    const stagePoint = getStagePointFromClient(0, clientY);

    if (!stagePoint) {
      return;
    }

    const nextBottom = stagePoint.y + nodeSize.height / 2;

    if (nextBottom > effectiveTimelineEndY) {
      setTimelineEndY(Math.max(initialTimelineEndY, nextBottom));
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
    if (isSingleMajorAnchorNode) {
      return;
    }

    const stageRect = canvasStageRef.current?.getBoundingClientRect();

    if (!stageRect) {
      return;
    }

    event.preventDefault();
    event.stopPropagation();
    const followerNodeId = endMajorNodeIdRef.current;
    canvasDragStateRef.current = {
      followerNodeId,
      followerNodeSize:
        followerNodeId !== null ? getNodeSize(nodeSizesRef.current, followerNodeId) : null,
      kind: "timeline-end",
      stageTop: stageRect.top
    };
  }

  // 이 함수는 노드 본문 드래그를 포인터 기반으로 시작합니다.
  function beginNodeDrag(
    nodeId: string,
    level: StoryNodeLevel,
    event: ReactPointerEvent<HTMLElement>
  ) {
    if (
      event.button !== 0 ||
      isBusy ||
      isNodeResizingRef.current ||
      isInteractiveTarget(event.target)
    ) {
      return;
    }

    const node = nodesById.get(nodeId);

    if (!node || node.isFixed) {
      return;
    }

    const stagePoint = getStagePointFromClient(event.clientX, event.clientY);

    if (!stagePoint) {
      return;
    }

    const nodeSize = getNodeSize(effectiveNodeSizes, nodeId);
    const placement =
      nodePlacements.get(nodeId) ??
      getFallbackNodePlacementWithinBounds(node, orderedNodes, laneCanvasBounds, nodeSize);

    event.preventDefault();
    event.stopPropagation();
    event.currentTarget.setPointerCapture?.(event.pointerId);
    setDragPayload(null);
    flushSelectedNodeDraftBeforeSelection(nodeId);
    setSelectedNodeId(nodeId);
    rewireHoverTargetIdRef.current = null;
    setRewireHoverTargetId(null);
    setRewirePreviewPoint(null);
    setRewireNodeId(null);
    canvasDragStateRef.current = {
      kind: "node-drag-pending",
      level,
      nodeId,
      nodeSize,
      pointerOffsetX: stagePoint.x - placement.x,
      pointerOffsetY: stagePoint.y - placement.y,
      pointerStartX: event.clientX,
      pointerStartY: event.clientY
    };
  }

  function beginNodeResize(
    nodeId: string,
    direction: NodeResizeDirection,
    event: ReactPointerEvent<HTMLButtonElement>
  ) {
    if (event.button !== 0 || isBusy) {
      return;
    }

    const node = nodesById.get(nodeId);

    if (!node || node.isFixed) {
      return;
    }

    const nodeSize = getNodeSize(effectiveNodeSizes, nodeId);

    event.preventDefault();
    event.stopPropagation();
    event.currentTarget.setPointerCapture?.(event.pointerId);
    isNodeResizingRef.current = true;
    pendingNodeResizeSizeRef.current = {
      nodeId,
      size: nodeSize
    };
    setActiveNodeResizeId(nodeId);
    setDragPayload(null);
    flushSelectedNodeDraftBeforeSelection(nodeId);
    setSelectedNodeId(nodeId);
    canvasDragStateRef.current = {
      direction,
      initialHeight: nodeSize.height,
      initialWidth: nodeSize.width,
      kind: "node-resize",
      level: node.level,
      nodeId,
      pointerStartX: event.clientX,
      pointerStartY: event.clientY
    };
  }

  // 이 함수는 포트나 연결선 hit path에서 rewire 드래그를 시작합니다.
  function beginRewireDrag(
    nodeId: string,
    event: ReactMouseEvent<HTMLButtonElement | SVGPathElement>,
    options: {
      connectionId?: string | null;
      parentId?: string | null;
    } = {}
  ) {
    const stagePoint = getStagePointFromClient(event.clientX, event.clientY);

    if (!stagePoint) {
      return;
    }

    event.preventDefault();
    event.stopPropagation();
    flushSelectedNodeDraftBeforeSelection(nodeId);
    setSelectedNodeId(nodeId);
    setRewireNodeId(nodeId);
    rewireHoverTargetIdRef.current = null;
    setRewireHoverTargetId(null);
    setHoveredConnectionId(options.connectionId ?? null);
    setRewirePreviewPoint({
      x: stagePoint.x,
      y: stagePoint.y
    });
    canvasDragStateRef.current = {
      connectionId: options.connectionId ?? null,
      kind: "rewire-drag",
      nodeId,
      parentId: options.parentId ?? null,
      stageLeft: stagePoint.stageRect.left,
      stageTop: stagePoint.stageRect.top
    };
  }

  // 인라인 오브젝트 mention을 저장용 objectId draft로 변환합니다.
  function createInlineObjectBindingDraft(nodeId: string, rawText: string) {
    const mentionNames = extractObjectMentionNames(rawText);
    const liveSnapshot = controller.getState()?.snapshot ?? snapshot;
    const currentNode =
      liveSnapshot.nodes.find((node) => node.id === nodeId) ??
      nodesById.get(nodeId) ??
      null;

    if (mentionNames.length === 0) {
      return {
        consumedCreateNames: [],
        objectIds:
          currentNode && extractObjectMentionNames(currentNode.text).length === 0
            ? currentNode.objectIds
            : [],
        objectsToCreate: []
      };
    }

    const targetEpisodeId = currentNode?.episodeId ?? liveSnapshot.project.activeEpisodeId;
    const scopeEpisodeIds = new Set(
      targetEpisodeId
        ? (
            sidebarFolders.find((folder) => folder.episodeIds.includes(targetEpisodeId))
              ?.episodeIds ?? [targetEpisodeId]
          )
        : []
    );
    const existingObjectIdsByName = new Map(
      liveSnapshot.objects
        .filter((object) => scopeEpisodeIds.has(object.episodeId))
        .map((object) => [normalizeObjectMentionMatchName(object.name), object.id])
    );
    const nextObjectIds: string[] = [];

    for (const mentionName of mentionNames) {
      const normalizedName = normalizeObjectMentionMatchName(mentionName);
      const objectId = existingObjectIdsByName.get(normalizedName) ?? null;

      if (!objectId) {
        if (!explicitMentionCreateNamesRef.current.has(normalizedName)) {
          continue;
        }

        nextObjectIds.push(`__create__:${normalizedName}`);
        existingObjectIdsByName.set(normalizedName, `__create__:${normalizedName}`);
        continue;
      }

      if (objectId && !nextObjectIds.includes(objectId)) {
        nextObjectIds.push(objectId);
      }
    }

    const objectsToCreate: StoryObjectDraft[] = [];
    const consumedCreateNames: string[] = [];
    const resolvedObjectIds = nextObjectIds.filter((objectId) => {
      if (!objectId.startsWith("__create__:")) {
        return true;
      }

      const normalizedName = objectId.slice("__create__:".length);
      const mentionName =
        mentionNames.find(
          (name) => normalizeObjectMentionMatchName(name) === normalizedName
        ) ?? "";

      if (!mentionName) {
        return false;
      }

      objectsToCreate.push({
        category: "thing",
        name: mentionName,
        summary: ""
      });
      consumedCreateNames.push(normalizedName);
      return false;
    });

    return {
      consumedCreateNames,
      objectIds: resolvedObjectIds,
      objectsToCreate
    };
  }

  function syncInlineObjectMentions(nodeId: string, rawText: string) {
    inlineMentionSignatureRef.current[nodeId] = getObjectMentionSignature(rawText);
  }

  // 현재 인라인 draft가 사용자 입력으로 변경됐음을 표시합니다.
  function markInlineNodeDraftDirty() {
    inlineDraftDirtyRef.current = true;
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

  function syncSelectedNodeInputHeight(
    nodeId: string,
    input: HTMLTextAreaElement | null,
    options?: {
      preserveManualHeight?: boolean;
    }
  ) {
    if (!input) {
      return;
    }

    if (input.dataset.nodeId && input.dataset.nodeId !== nodeId) {
      return;
    }

    // 표시 텍스트 높이를 기준으로 입력 영역과 카드 높이를 동기화합니다.
    const inputShell = input.closest(".node-inline-input-shell");
    const previewElement = inputShell?.querySelector<HTMLElement>(".node-inline-preview");
    input.style.height = "0px";
    const inputContentHeight = input.scrollHeight;
    const visualTextHeight = previewElement?.scrollHeight ?? 0;
    const stableVisualTextHeight =
      visualTextHeight > 0 && visualTextHeight <= inputContentHeight + 4 ? visualTextHeight : 0;
    const nextInputHeight = Math.max(28, inputContentHeight, stableVisualTextHeight);
    input.style.height = `${nextInputHeight}px`;

    // 텍스트 영역 외 카드 크롬(패딩/헤더) 높이를 보정합니다.
    const nodeFrameVerticalPadding = 42;
    const requiredHeight = Math.max(
      nodeCardHeight,
      Math.ceil(nextInputHeight + nodeFrameVerticalPadding)
    );

    setNodeSizes((current) => {
      const existing = current[nodeId] ?? getNodeSize(effectiveNodeSizes, nodeId);
      const previousAutoHeight = autoNodeHeightsRef.current[nodeId] ?? nodeCardHeight;
      const isAutoSized = Math.abs(existing.height - previousAutoHeight) <= 1;

      if (options?.preserveManualHeight && !isAutoSized) {
        return current;
      }

      if (!isAutoSized && requiredHeight <= existing.height) {
        return current;
      }

      const nextHeight = Math.max(requiredHeight, isAutoSized ? requiredHeight : existing.height);

      autoNodeHeightsRef.current[nodeId] = nextHeight;

      if (nextHeight === existing.height) {
        return current;
      }

      return {
        ...current,
        [nodeId]: {
          ...existing,
          height: nextHeight
        }
      };
    });
  }

  function applyObjectMentionSelection(
    objectName: string,
    withTrailingSpace = false
  ) {
    if (!objectMentionQuery || !selectedNode || selectedNode.isFixed) {
      return;
    }

    const mentionText = `${getObjectToken(objectName)}${withTrailingSpace ? " " : ""}`;
    const nextText = `${inlineNodeTextDraft.slice(0, objectMentionQuery.start)}${mentionText}${inlineNodeTextDraft.slice(objectMentionQuery.end)}`;
    const nextCaret = objectMentionQuery.start + mentionText.length;
    const normalizedObjectName = normalizeObjectMentionMatchName(objectName);
    const selectsCreateCandidate =
      objectMentionCreateCandidate !== null &&
      normalizeObjectMentionMatchName(objectMentionCreateCandidate.name) ===
        normalizedObjectName &&
      !activeEpisodeObjects.some(
        (object) => normalizeObjectMentionMatchName(object.name) === normalizedObjectName
      );

    if (selectsCreateCandidate) {
      explicitMentionCreateNamesRef.current.add(normalizedObjectName);
    }

    markInlineNodeDraftDirty();
    setInlineNodeTextDraft(nextText);
    setObjectMentionQuery(null);
    setObjectMentionMenuPosition(null);
    setActiveObjectMentionIndex(0);
    syncInlineObjectMentions(selectedNode.id, nextText);
    void persistInlineNodeContent(
      selectedNode,
      nextText,
      extractInlineKeywords(nextText)
    );

    window.requestAnimationFrame(() => {
      selectedNodeInputRef.current?.focus();
      selectedNodeInputRef.current?.setSelectionRange(nextCaret, nextCaret);
      syncSelectedNodeInputHeight(selectedNode.id, selectedNodeInputRef.current);
    });
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

    const draftNodeSize = {
      height: nodeCardHeight,
      width: nodeCardWidth
    };
    const laneResolvedPlacement =
      level === "major"
        ? placement
        : resolveLaneDropPlacement({
            layout: laneLayoutsByLevel[level],
            minY: laneCanvasBounds[level].startY,
            nodeId: "__draft__",
            nodeSize: draftNodeSize,
            targetPlacement: placement
          });
    const resolvedPlacement =
      level === "major"
        ? snapMajorNodePlacementToTimelineAnchors(
            level,
            laneResolvedPlacement,
            timelineAnchors,
            draftNodeSize
          )
        : laneResolvedPlacement;

    const createdNodeId = await controller.createNode(
      level,
      getInsertIndexForCanvasY(level, resolvedPlacement.y + nodeCardHeight / 2),
      {
        canvasHeight: draftNodeSize.height,
        canvasWidth: draftNodeSize.width,
        canvasX: resolvedPlacement.x,
        canvasY: resolvedPlacement.y,
        parentId: getNearestParentIdForCanvasY(
          level,
          resolvedPlacement.y + draftNodeSize.height / 2
        )
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

    const nodeSize = getNodeSize(effectiveNodeSizes, nodeId);
    const laneResolvedPlacement =
      level === "major"
        ? placement
        : resolveLaneDropPlacement({
            layout: laneLayoutsByLevel[level],
            minY: laneCanvasBounds[level].startY,
            nodeId,
            nodeSize,
            targetPlacement: placement
          });

    if (level === "major") {
      const requiredTimelineEndY = Math.max(
        initialTimelineEndY,
        effectiveTimelineEndY,
        laneResolvedPlacement.y + nodeSize.height
      );
      const dynamicTimelineAnchors = getTimelineAnchorPositions(
        requiredTimelineEndY,
        laneCanvasBounds.major,
        nodeSize
      );
      const snappedPlacement = snapMajorNodePlacementToTimelineAnchors(
        level,
        laneResolvedPlacement,
        dynamicTimelineAnchors,
        nodeSize
      );

      setTimelineEndY(
        Math.max(
          initialTimelineEndY,
          getProjectedLowestMajorNodeBottom(nodeId, snappedPlacement, nodeSize)
        )
      );

      await controller.updateNodePlacement(nodeId, {
        canvasHeight: nodeSize.height,
        canvasWidth: nodeSize.width,
        canvasX: snappedPlacement.x,
        canvasY: snappedPlacement.y
      });
      const targetInsertIndex = getInsertIndexForCanvasY(
        level,
        snappedPlacement.y + nodeSize.height / 2,
        nodeId
      );
      await controller.moveNode(
        nodeId,
        targetInsertIndex
      );
      setSelectedNodeId(nodeId);
      setRewireNodeId(null);
      return;
    }

    await controller.updateNodePlacement(nodeId, {
      canvasHeight: nodeSize.height,
      canvasWidth: nodeSize.width,
      canvasX: laneResolvedPlacement.x,
      canvasY: laneResolvedPlacement.y
    });
    const targetInsertIndex = getInsertIndexForCanvasY(
      level,
      laneResolvedPlacement.y + nodeSize.height / 2,
      nodeId
    );
    await controller.moveNode(nodeId, targetInsertIndex, {
      preserveParent: true
    });
    setSelectedNodeId(nodeId);
    setRewireNodeId(null);
  }
  moveNodeFreelyRef.current = moveNodeFreely;

  async function handleLaneClick(
    level: StoryNodeLevel,
    event: ReactMouseEvent<HTMLElement>
  ) {
    if (!draftVisible) {
      if (event.target === event.currentTarget && !isInteractiveTarget(event.target)) {
        flushSelectedNodeDraftBeforeSelection(null);
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
      getNodeSize(effectiveNodeSizes, dragPayload.nodeId)
    );

    if (!placement) {
      return;
    }

    await moveNodeFreely(dragPayload.nodeId, dragPayload.level, placement);
    setDragPayload(null);
  }

  // 이 함수는 삭제될 노드의 직접 자식을 가장 가까운 상위 레인 부모로 연결합니다.
  function getChildReconnectParentIdsForDelete(nodeId: string) {
    const remainingNodes = orderedNodes.filter((node) => node.id !== nodeId);
    const remainingNodesById = new Map(remainingNodes.map((node) => [node.id, node]));
    const remainingVisibleNodes = remainingNodes.filter(
      (node) => !hasCollapsedAncestor(node, remainingNodesById)
    );
    const childParentIds = new Map<string, string | null>();

    for (const childNode of orderedNodes.filter((node) => node.parentId === nodeId)) {
      const childSize = getNodeSize(effectiveNodeSizes, childNode.id);
      const childPlacement =
        nodePlacements.get(childNode.id) ??
        getFallbackNodePlacementWithinBounds(
          childNode,
          orderedNodes,
          laneCanvasBounds,
          childSize
        );
      const excludedNodeIds = collectDescendantIds(orderedNodes, childNode.id);

      excludedNodeIds.add(nodeId);
      childParentIds.set(
        childNode.id,
        resolveNearestParentIdByY({
          excludedNodeIds,
          level: childNode.level,
          nodePlacements,
          nodes: remainingVisibleNodes,
          nodeSizes: effectiveNodeSizes,
          targetCenterY: childPlacement.y + childSize.height / 2
        })
      );
    }

    return childParentIds;
  }

  // 이 함수는 노드 삭제 후 남은 major 기준으로 타임라인을 자연스럽게 줄입니다.
  async function deleteNodeAndAdjustCanvas(nodeId: string) {
    const deletedNodeIds = new Set([nodeId]);
    const childParentIds = getChildReconnectParentIdsForDelete(nodeId);

    await controller.deleteNodeAndReconnectChildren(nodeId, childParentIds);

    const remainingNodes = orderedNodes.filter((node) => !deletedNodeIds.has(node.id));
    const remainingNodesById = new Map(remainingNodes.map((node) => [node.id, node]));
    const remainingVisibleNodes = remainingNodes.filter(
      (node) => !hasCollapsedAncestor(node, remainingNodesById)
    );
    const remainingLowestMajorBottom = Math.max(
      0,
      ...remainingVisibleNodes
        .filter((node) => node.level === "major")
        .map((node) => {
          const nodeSize = getNodeSize(effectiveNodeSizes, node.id);
          const placement =
            nodePlacements.get(node.id) ??
            getFallbackNodePlacementWithinBounds(
              node,
              remainingNodes,
              laneCanvasBounds,
              nodeSize
            );

          return placement.y + nodeSize.height;
        })
    );
    const nextTimelineEndY = Math.max(initialTimelineEndY, remainingLowestMajorBottom);

    setTimelineEndY((currentTimelineEndY) =>
      nextTimelineEndY < currentTimelineEndY ? nextTimelineEndY : currentTimelineEndY
    );
  }

  async function persistInlineNodeContent(
    node: StoryNode,
    nextText: string,
    nextKeywords: string[],
    options: {
      skipLocalStateSync?: boolean;
    } = {}
  ) {
    const resolvedContent = resolveInlineNodeContent(nextText, nextKeywords);
    const currentNode = nodesById.get(node.id) ?? node;
    const objectBindingDraft = createInlineObjectBindingDraft(node.id, resolvedContent.text);
    const canSyncLocalState = () =>
      options.skipLocalStateSync !== true && selectedNodeIdRef.current === node.id;

    if (currentNode.isFixed) {
      if (canSyncLocalState()) {
        const currentInlineText = buildInlineEditorText(currentNode.text, currentNode.keywords);

        setInlineNodeTextDraft(currentInlineText);
        setSelectedAiKeywords(currentNode.keywords);
        inlineDraftDirtyRef.current = false;
      }
      return false;
    }

    const hasKeywordChange = haveKeywordListsChanged(
      currentNode.keywords,
      resolvedContent.keywords
    );
    const hasObjectBindingChange =
      currentNode.objectIds.length !== objectBindingDraft.objectIds.length ||
      currentNode.objectIds.some(
        (objectId, index) => objectId !== objectBindingDraft.objectIds[index]
      ) ||
      objectBindingDraft.objectsToCreate.length > 0;

    if (
      resolvedContent.text === currentNode.text.trim() &&
      !hasKeywordChange &&
      !hasObjectBindingChange
    ) {
      if (canSyncLocalState()) {
        setInlineNodeTextDraft(resolvedContent.text);
        setSelectedAiKeywords(resolvedContent.keywords);
        inlineDraftDirtyRef.current = false;
      }
      return false;
    }

    const didMutate = await controller.updateNodeContentAndObjectBindings(node.id, {
      contentMode: resolvedContent.contentMode,
      keywords: resolvedContent.keywords,
      objectIds: objectBindingDraft.objectIds,
      objectsToCreate: objectBindingDraft.objectsToCreate,
      text: resolvedContent.text
    });

    for (const normalizedName of objectBindingDraft.consumedCreateNames) {
      explicitMentionCreateNamesRef.current.delete(normalizedName);
    }

    if (canSyncLocalState()) {
      setInlineNodeTextDraft(resolvedContent.text);
      setSelectedAiKeywords(resolvedContent.keywords);
      setObjectMentionQuery(null);
      setObjectMentionMenuPosition(null);
      setActiveObjectMentionIndex(0);
      inlineDraftDirtyRef.current = false;
    }

    return didMutate;
  }

  // 이 함수는 노드 선택 전환 직전에 현재 인라인 draft를 안전하게 저장합니다.
  function flushSelectedNodeDraftBeforeSelection(nextNodeId: string | null) {
    if (!selectedNode || selectedNode.isFixed || selectedNode.id === nextNodeId) {
      return;
    }

    void flushSelectedNodeDraftBeforeHistoryAction();
  }

  // history 실행 직전 현재 선택 노드의 draft 저장을 단일 promise로 공유합니다.
  async function flushSelectedNodeDraftBeforeHistoryAction() {
    if (inlineDraftFlushPromiseRef.current) {
      return inlineDraftFlushPromiseRef.current;
    }

    if (!selectedNode || selectedNode.isFixed) {
      return "unchanged" satisfies InlineDraftFlushResult;
    }

    if (!inlineDraftDirtyRef.current) {
      return "unchanged" satisfies InlineDraftFlushResult;
    }

    const flushPromise = persistInlineNodeContent(
      selectedNode,
      inlineNodeTextDraft,
      selectedAiKeywords
    )
      .then((didMutate) =>
        didMutate
          ? ("changed" satisfies InlineDraftFlushResult)
          : ("unchanged" satisfies InlineDraftFlushResult)
      )
      .finally(() => {
        inlineDraftFlushPromiseRef.current = null;
      });

    inlineDraftFlushPromiseRef.current = flushPromise;
    return flushPromise;
  }

  // history 적용 후 선택 노드 draft와 keyword cloud 상태를 최신 snapshot에 맞춥니다.
  function syncSelectedNodeAfterHistoryAction() {
    const historySnapshot = controller.getState()?.snapshot;

    if (!historySnapshot) {
      return;
    }

    const activeHistoryEpisodeId = historySnapshot.project.activeEpisodeId;
    const activeHistoryNodes = sortNodesByOrder(
      historySnapshot.nodes.filter((node) => node.episodeId === activeHistoryEpisodeId)
    );
    const selectedHistoryNode =
      (selectedNodeIdRef.current
        ? activeHistoryNodes.find((node) => node.id === selectedNodeIdRef.current)
        : null) ??
      (selectedNode
        ? activeHistoryNodes.find((node) => node.id === selectedNode.id)
        : null) ??
      activeHistoryNodes[0] ??
      null;

    keywordSuggestionPoolRef.current = null;
    inlineDraftDirtyRef.current = false;

    if (!selectedHistoryNode) {
      setSelectedNodeId(null);
      setInlineNodeTextDraft("");
      setSelectedAiKeywords([]);
      setAiPanelNodeId(null);
      setRecommendationError(null);
      setObjectMentionQuery(null);
      setObjectMentionMenuPosition(null);
      setActiveObjectMentionIndex(0);
      return;
    }

    const nextInlineText = buildInlineEditorText(
      selectedHistoryNode.text,
      selectedHistoryNode.keywords
    );

    inlineMentionSignatureRef.current[selectedHistoryNode.id] =
      getObjectMentionSignature(nextInlineText);
    setSelectedNodeId(selectedHistoryNode.id);
    setInlineNodeTextDraft(nextInlineText);
    setSelectedAiKeywords(selectedHistoryNode.keywords);
    setRecommendationError(null);
    setObjectMentionQuery(null);
    setObjectMentionMenuPosition(null);
    setActiveObjectMentionIndex(0);

    if (aiPanelNodeId !== null && aiPanelNodeId !== selectedHistoryNode.id) {
      setAiPanelNodeId(null);
    }

    window.requestAnimationFrame(() => {
      syncSelectedNodeInputHeight(selectedHistoryNode.id, selectedNodeInputRef.current);
    });
  }

  // undo는 dirty draft를 먼저 history에 넣은 뒤 이전 snapshot으로 되돌립니다.
  async function runUndoWithInlineDraftFlush() {
    await flushSelectedNodeDraftBeforeHistoryAction();
    await runUndo();
    syncSelectedNodeAfterHistoryAction();
  }

  // redo는 dirty draft가 새 history를 만들면 오래된 redo를 실행하지 않습니다.
  async function runRedoWithInlineDraftFlush() {
    const flushResult = await flushSelectedNodeDraftBeforeHistoryAction();

    if (flushResult === "changed") {
      syncSelectedNodeAfterHistoryAction();
      return;
    }

    await runRedo();
    syncSelectedNodeAfterHistoryAction();
  }

  runUndoWithInlineDraftFlushRef.current = runUndoWithInlineDraftFlush;
  runRedoWithInlineDraftFlushRef.current = runRedoWithInlineDraftFlush;

  async function openKeywordSuggestions(
    node: StoryNode,
    options?: { refresh?: boolean }
  ) {
    if (node.isFixed) {
      setAiPanelNodeId(null);
      setRecommendationError(null);
      return;
    }

    const parentNode = node.parentId ? nodesById.get(node.parentId) ?? null : null;
    const inlineDraft =
      selectedNode?.id === node.id
        ? inlineNodeTextDraft
        : buildInlineEditorText(node.text, node.keywords);
    const nextSelectedKeywords = extractInlineKeywords(inlineDraft);
    const requestNode = {
      ...node,
      keywords: nextSelectedKeywords,
      text: inlineDraft
    };
    const requestId = keywordRequestIdRef.current + 1;
    const isRefreshRequest = options?.refresh === true;
    const openSlotCount = Math.max(0, keywordCloudSlotCount - nextSelectedKeywords.length);
    const maxSuggestions = getKeywordSuggestionBatchSize(openSlotCount);
    const signatureRequest = createKeywordRecommendationRequest(snapshot, requestNode, parentNode, {
      maxSuggestions,
      selectedKeywords: nextSelectedKeywords
    });
    const contextSignature = createKeywordSuggestionContextSignature(signatureRequest);
    const matchingPool =
      keywordSuggestionPoolRef.current?.contextSignature === contextSignature
        ? keywordSuggestionPoolRef.current
        : null;
    const displayedSuggestionsForRefresh = isRefreshRequest
      ? buildDisplayedKeywordSuggestions(
          nextSelectedKeywords,
          keywordSuggestions,
          keywordRefreshCycle
        )
      : [];
    const excludedSuggestionLabels = isRefreshRequest
      ? createKeywordSuggestionExclusionLabels(displayedSuggestionsForRefresh, matchingPool)
      : [];
    const refreshNonce = isRefreshRequest ? `${node.id}:${requestId}:${Date.now()}` : undefined;
    const pooledSuggestions = matchingPool
      ? cleanKeywordSuggestionBatch(matchingPool.unusedSuggestions, [
          ...nextSelectedKeywords,
          ...displayedSuggestionsForRefresh.map((suggestion) => suggestion.label)
        ])
      : [];
    const pooledPage =
      isRefreshRequest && openSlotCount > 0 && pooledSuggestions.length >= openSlotCount
        ? takeKeywordSuggestionPage(pooledSuggestions, openSlotCount)
        : null;
    const fallbackPooledPage =
      isRefreshRequest && openSlotCount > 0 && pooledSuggestions.length > 0
        ? takeKeywordSuggestionPage(pooledSuggestions, openSlotCount)
        : null;

    keywordRequestIdRef.current = requestId;
    if (!matchingPool) {
      keywordSuggestionPoolRef.current = null;
    }

    setAiPanelNodeId(node.id);
    setSelectedAiKeywords(nextSelectedKeywords);
    setRecommendationError(null);
    window.requestAnimationFrame(() => {
      centerCanvasViewportOnNode(node.id, "smooth", 240);
    });

    if (openSlotCount <= 0) {
      setKeywordSuggestions([]);
      setKeywordRefreshCycle(0);
      setIsLoadingKeywords(false);
      return;
    }

    if (pooledPage && matchingPool) {
      keywordSuggestionPoolRef.current = updateKeywordSuggestionPool(
        contextSignature,
        matchingPool,
        pooledPage.pageSuggestions,
        pooledPage.remainingSuggestions
      );
      setKeywordSuggestions(pooledPage.pageSuggestions);
      setKeywordRefreshCycle(0);
      setIsLoadingKeywords(false);
      return;
    }

    if (!isRefreshRequest) {
      setKeywordSuggestions([]);
    }

    setIsLoadingKeywords(true);

    try {
      const response = await recommendationClient.getKeywordSuggestions(
        createKeywordRecommendationRequest(snapshot, requestNode, parentNode, {
          cacheBypass: isRefreshRequest,
          excludedSuggestionLabels,
          maxSuggestions,
          ...(refreshNonce ? { refreshNonce } : {}),
          selectedKeywords: nextSelectedKeywords
        })
      );

      if (keywordRequestIdRef.current !== requestId) {
        return;
      }

      const cleanSuggestions = cleanKeywordSuggestionBatch(
        response.suggestions,
        nextSelectedKeywords
      );
      const { pageSuggestions, remainingSuggestions } = takeKeywordSuggestionPage(
        cleanSuggestions,
        openSlotCount
      );

      keywordSuggestionPoolRef.current = updateKeywordSuggestionPool(
        contextSignature,
        matchingPool,
        pageSuggestions,
        remainingSuggestions
      );
      setKeywordSuggestions(pageSuggestions);
      setKeywordRefreshCycle((current) => (isRefreshRequest ? current + 1 : 0));
    } catch (error) {
      if (keywordRequestIdRef.current !== requestId) {
        return;
      }

      if (fallbackPooledPage && matchingPool) {
        keywordSuggestionPoolRef.current = updateKeywordSuggestionPool(
          contextSignature,
          matchingPool,
          fallbackPooledPage.pageSuggestions,
          fallbackPooledPage.remainingSuggestions
        );
        setKeywordSuggestions(fallbackPooledPage.pageSuggestions);
        setKeywordRefreshCycle(0);
      }

      setRecommendationError(toMessage(error));
    } finally {
      if (keywordRequestIdRef.current === requestId) {
        setIsLoadingKeywords(false);
      }
    }
  }

  async function toggleAiKeyword(node: StoryNode, keyword: string) {
    if (node.isFixed) {
      return;
    }

    const baseText =
      selectedNode?.id === node.id
        ? inlineNodeTextDraft
        : buildInlineEditorText(node.text, node.keywords);
    const selectionStart = selectedNodeInputRef.current?.selectionStart ?? baseText.length;
    const selectionEnd = selectedNodeInputRef.current?.selectionEnd ?? selectionStart;
    const { nextCaret, nextText } = toggleInlineKeywordToken(
      baseText,
      keyword,
      selectionStart,
      selectionEnd
    );
    const nextKeywords = extractInlineKeywords(nextText);

    markInlineNodeDraftDirty();
    setInlineNodeTextDraft(nextText);
    setSelectedAiKeywords(nextKeywords);
    setRecommendationError(null);
    await persistInlineNodeContent(node, nextText, nextKeywords);

    if (selectedNode?.id === node.id) {
      setInlineNodeTextDraft(nextText);
      setSelectedAiKeywords(nextKeywords);
      window.requestAnimationFrame(() => {
        selectedNodeInputRef.current?.focus();
        selectedNodeInputRef.current?.setSelectionRange(nextCaret, nextCaret);
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
              ? normalizeObjectMentionMatchName(object.name) ===
                normalizeObjectMentionMatchName(objectMentionQuery.query)
              : normalizeObjectMentionMatchName(objectMentionQuery.query)
                ? normalizeObjectMentionMatchName(object.name).startsWith(
                    normalizeObjectMentionMatchName(objectMentionQuery.query)
                  )
                : true
          )
          .sort((left, right) => left.name.localeCompare(right.name))
          .slice(0, 8);
  const objectMentionCreateCandidate =
    objectMentionQuery?.mode === "mention" && selectedNode && !selectedNode.isFixed
      ? getObjectMentionCreateCandidate(objectMentionQuery.query, activeEpisodeObjects)
      : null;
  const displayedKeywordSuggestions = buildDisplayedKeywordSuggestions(
    selectedAiKeywords,
    keywordSuggestions,
    keywordRefreshCycle
  );

  if (activeEpisodeId) {
    majorAnchorNodeIdsByEpisodeRef.current[activeEpisodeId] = {
      endId: endMajorNodeId,
      startId: startMajorNodeId
    };
  }
  const isSingleMajorAnchorNode =
    startMajorNodeId !== null && startMajorNodeId === endMajorNodeId;

  nodePlacementsRef.current = nodePlacements;
  visibleNodesRef.current = visibleNodes;
  laneCanvasBoundsRef.current = laneCanvasBounds;
  nodeSizesRef.current = effectiveNodeSizes;
  timelineAnchorsRef.current = timelineAnchors;
  endMajorNodeIdRef.current = endMajorNodeId;
  stageHeightRef.current = stageHeight;
  selectedNodeIdRef.current = selectedNodeId;

  const renderedNodes = visibleNodes.map((node) => {
    const nodeSize = getNodeSize(effectiveNodeSizes, node.id);
    const isSelected = selectedNode?.id === node.id;
    const isDragging = activeNodeDragPreview?.nodeId === node.id;
    const isRewireSource = rewireNode?.id === node.id || activeConnection?.childId === node.id;
    const isRewireTarget = candidateParentIds.has(node.id) || activeConnection?.parentId === node.id;
    const isHoveredRewireTarget =
      rewireHoverTargetId === node.id || activeConnection?.parentId === node.id;
    const isStartMajorNode = node.id === startMajorNodeId;
    const isEndMajorNode = node.id === endMajorNodeId;
    const placement =
      activeNodeDragPreview?.nodeId === node.id
        ? activeNodeDragPreview.placement
        : (nodePlacements.get(node.id) ??
          getFallbackNodePlacementWithinBounds(node, orderedNodes, laneCanvasBounds, nodeSize));
    const activeKeywords = isSelected ? selectedAiKeywords : node.keywords;
    const displayText = isSelected ? inlineNodeTextDraft : node.text;
    const hasVisibleKeywords = activeKeywords.length > 0;
    const displayBodyText = extractDisplayText(displayText);
    const isReadOnlySelectedNode = isSelected && (node.isFixed ?? false);
    const shouldShowPlaceholder =
      (!isSelected || isReadOnlySelectedNode) && !displayBodyText && !hasVisibleKeywords;
    const selectedNodeTitle =
      extractDisplayText(displayText) || activeKeywords.join(" ") || getNodeHeadline(node);

    return (
      <CanvasNodeCard
        activeKeywords={activeKeywords}
        activeObjectMentionIndex={activeObjectMentionIndex}
        aiPanelNodeId={aiPanelNode?.id ?? null}
        applyObjectMentionSelection={applyObjectMentionSelection}
        beginNodeDrag={beginNodeDrag}
        beginNodeResize={beginNodeResize}
        centerCanvasViewportOnNode={centerCanvasViewportOnNode}
        displayBodyText={displayBodyText}
        displayedKeywordSuggestions={displayedKeywordSuggestions}
        displayText={displayText}
        flushSelectedNodeDraft={flushSelectedNodeDraftBeforeHistoryAction}
        getViewportMenuPosition={getViewportMenuPosition}
        hasVisibleKeywords={hasVisibleKeywords}
        inlineNodeTextDraft={inlineNodeTextDraft}
        isBusy={isBusy}
        isDragging={isDragging}
        isEndMajorNode={isEndMajorNode}
        isHoveredRewireTarget={isHoveredRewireTarget}
        isLoadingKeywords={isLoadingKeywords}
        isNodeMoreMenuOpen={isNodeMoreMenuOpen}
        isRewireSource={isRewireSource}
        isRewireTarget={isRewireTarget}
        isSelected={isSelected}
        isStartMajorNode={isStartMajorNode}
        key={node.id}
        markInlineNodeDraftDirty={markInlineNodeDraftDirty}
        node={node}
        nodeCardRefs={nodeCardRefs}
        nodeMenuButtonRefs={nodeMenuButtonRefs}
        nodeSize={nodeSize}
        objectMentionCreateCandidate={objectMentionCreateCandidate}
        objectMentionQuery={objectMentionQuery}
        objectMentionSuggestions={objectMentionSuggestions}
        onBeforeSelectNode={flushSelectedNodeDraftBeforeSelection}
        onClearRewireHoverTarget={() => {
          rewireHoverTargetIdRef.current = null;
        }}
        onRewireNode={(sourceNodeId, targetNodeId) =>
          controller.rewireNode(sourceNodeId, targetNodeId)
        }
        openKeywordSuggestions={openKeywordSuggestions}
        placement={placement}
        recommendationError={recommendationError}
        rewireNode={rewireNode}
        selectedAiKeywords={selectedAiKeywords}
        selectedNodeInputRef={selectedNodeInputRef}
        selectedNodeTitle={selectedNodeTitle}
        setActiveObjectMentionIndex={setActiveObjectMentionIndex}
        setAiPanelNodeId={setAiPanelNodeId}
        setInlineNodeTextDraft={setInlineNodeTextDraft}
        setIsNodeMoreMenuOpen={setIsNodeMoreMenuOpen}
        setNodeMenuPosition={setNodeMenuPosition}
        setObjectMentionMenuPosition={setObjectMentionMenuPosition}
        setObjectMentionQuery={setObjectMentionQuery}
        setRecommendationError={setRecommendationError}
        setRewireHoverTargetId={setRewireHoverTargetId}
        setRewireNodeId={setRewireNodeId}
        setRewirePreviewPoint={setRewirePreviewPoint}
        setSelectedAiKeywords={setSelectedAiKeywords}
        setSelectedNodeId={setSelectedNodeId}
        shouldFocusSelectedNodeRef={shouldFocusSelectedNodeRef}
        shouldShowPlaceholder={shouldShowPlaceholder}
        suppressNodeClickRef={suppressNodeClickRef}
        syncInlineObjectMentions={syncInlineObjectMentions}
        syncSelectedNodeInputHeight={syncSelectedNodeInputHeight}
        toggleAiKeyword={toggleAiKeyword}
        toggleNodeCollapsed={(nodeId, nextCollapsed) =>
          controller.updateNodeVisualState(nodeId, {
            isCollapsed: nextCollapsed
          })
        }
        updateObjectMentionQueryFromInput={updateObjectMentionQueryFromInput}
      />
    );
  });
  const rewirePreviewLine =
    rewireNode && rewirePreviewPoint
      ? (() => {
          const sourcePlacement = nodePlacements.get(rewireNode.id);
          const sourceSize = getNodeSize(effectiveNodeSizes, rewireNode.id);

          if (!sourcePlacement) {
            return null;
          }

          const hoveredTarget =
            rewireHoverTargetId !== null ? nodesById.get(rewireHoverTargetId) ?? null : null;
          const hoveredPlacement =
            hoveredTarget !== null ? nodePlacements.get(hoveredTarget.id) ?? null : null;
          const hoveredSize =
            hoveredTarget !== null ? getNodeSize(effectiveNodeSizes, hoveredTarget.id) : null;

          if (hoveredTarget && hoveredPlacement && hoveredSize) {
            return buildNodeConnectionPath({
              isSameLevel: hoveredTarget.level === rewireNode.level,
              sourcePlacement: hoveredPlacement,
              sourceSize: hoveredSize,
              targetPlacement: sourcePlacement,
              targetSize: sourceSize
            }).path;
          }

          const startX = rewirePreviewPoint.x;
          const startY = rewirePreviewPoint.y;
          const endX = sourcePlacement.x + sourceSize.width / 2;
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
  const deleteFolderTarget =
    deleteFolderId !== null
      ? sidebarFolders.find((folder) => folder.id === deleteFolderId) ?? null
      : null;
  const deleteObjectTarget =
    deleteObjectId !== null
      ? snapshot.objects.find((object) => object.id === deleteObjectId) ?? null
      : null;
  const profileName =
    state.session.displayName ??
    state.session.accountId ??
    `${copy.workspace.brand} User`;
  const { folderIdByEpisodeId, rootEpisodes, visibleFolders } = buildSidebarEpisodeCollections({
    episodes: snapshot.episodes,
    folders: sidebarFolders,
    pinMap: folderEpisodePins,
    query: episodeSearchQuery,
    rootScopeId: rootFolderScopeId
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
    const summary = normalizeObjectSummaryInput(objectEditorDraft.summary).trim();

    if (!name) {
      setDetailError("Object name is required.");
      return;
    }

    if (detailMode === "create-object") {
      const nextObjectId = await controller.createObject({
        ...objectEditorDraft,
        name,
        summary
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
      summary
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
    const nextValue =
      field === "summary" && typeof value === "string"
        ? normalizeObjectSummaryInput(value)
        : value;

    setObjectEditorDraft((current) => ({
      ...current,
      [field]: nextValue
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

  function requestDeleteObject(objectId: string) {
    setDeleteObjectId(objectId);
    setObjectMenuId(null);
    setObjectMenuPosition(null);
  }

  async function confirmDeleteObject() {
    if (!deleteObjectTarget) {
      setDeleteObjectId(null);
      return;
    }

    await deleteObjectFromLibrary(deleteObjectTarget.id);
    setDeleteObjectId(null);
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
            {!selectedNode.isFixed ? (
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
            ) : null}
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
                const nextIsFixed = !(selectedNode.isFixed ?? false);

                if (nextIsFixed) {
                  setAiPanelNodeId(null);
                  setRecommendationError(null);
                }

                void controller.updateNodeVisualState(selectedNode.id, {
                  isFixed: nextIsFixed
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
    (objectMentionSuggestions.length > 0 || objectMentionCreateCandidate)
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
            {objectMentionCreateCandidate ? (
              <button
                aria-selected={
                  activeObjectMentionIndex === objectMentionSuggestions.length
                }
                className={`button-secondary object-mention-option${
                  activeObjectMentionIndex === objectMentionSuggestions.length
                    ? " is-active"
                    : ""
                }`}
                onMouseDown={(event) => {
                  event.preventDefault();
                  applyObjectMentionSelection(objectMentionCreateCandidate.name);
                }}
                type="button"
              >
                {`Create "${objectMentionCreateCandidate.name}" as object`}
              </button>
            ) : null}
          </section>
        )
      : null;

  const detailPanel = (
    <WorkspaceObjectPanel
      detailError={detailError}
      detailMode={detailMode}
      isCanvasFullscreen={isCanvasFullscreen}
      objectEditorDraft={objectEditorDraft}
      onClose={closeDetailPanel}
      onDraftChange={handleObjectDraftChange}
      onSave={() => {
        void saveObjectDetails();
      }}
      selectedObject={selectedObject}
      selectedObjectEpisodeTitle={selectedObjectEpisodeTitle}
      showSelectedObjectEpisode={
        selectedObject ? folderIdByEpisodeId.has(selectedObject.episodeId) : false
      }
    />
  );

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

      return current.map((folder) => {
        const nextEpisodeIds = folder.episodeIds.filter((entry) => entry !== episodeId);

        if (folder.id === folderId) {
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
    setEpisodeMenuId(null);
    setEpisodeMenuPosition(null);
    setFolderPickerEpisodeId(null);
    setFolderPickerPosition(null);
  }

  async function dissolveEpisodeFromFolder(
    episodeId: string,
    options?: { skipLocalization?: boolean }
  ) {
    if (!options?.skipLocalization) {
      await controller.localizeObjectReferencesForEpisode(episodeId);
    }

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

  async function toggleEpisodeInFolderPicker(folderId: string, episodeId: string) {
    const targetFolder = sidebarFolders.find((folder) => folder.id === folderId) ?? null;
    const isAlreadyInFolder = targetFolder?.episodeIds.includes(episodeId) ?? false;

    if (isAlreadyInFolder) {
      await controller.localizeObjectReferencesForEpisode(episodeId);
    }

    setSidebarFolders((current) => {
      const timestamp = new Date().toISOString();
      const nextTargetFolder = current.find((folder) => folder.id === folderId);
      const nextAlreadyInFolder = nextTargetFolder?.episodeIds.includes(episodeId) ?? false;

      return current.map((folder) => {
        const nextEpisodeIds = folder.episodeIds.filter((entry) => entry !== episodeId);

        if (folder.id === folderId && !nextAlreadyInFolder) {
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

  async function deleteFolder(folderId: string) {
    const deletedFolder = sidebarFolders.find((folder) => folder.id === folderId) ?? null;

    if (deletedFolder) {
      for (const episodeId of deletedFolder.episodeIds) {
        await controller.localizeObjectReferencesForEpisode(episodeId);
      }
    }

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

  async function requestDeleteFolder(folderId: string) {
    setDeleteFolderId(folderId);
    setFolderMenuId(null);
    setFolderMenuPosition(null);
    setFolderEpisodePickerFolderId(null);
    setFolderEpisodePickerPosition(null);
  }

  async function confirmDeleteFolder() {
    if (!deleteFolderTarget) {
      setDeleteFolderId(null);
      return;
    }

    await deleteFolder(deleteFolderTarget.id);
    setDeleteFolderId(null);
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
      await dissolveEpisodeFromFolder(deleteEpisodeTarget.id, {
        skipLocalization: true
      });
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

  return (
    <div
      className={`workspace-shell${detailMode === null ? " workspace-shell-details-closed" : ""}${
        isSidebarCollapsed ? " workspace-shell-sidebar-collapsed" : ""
      }`}
      onFocusCapture={(event) => {
        setWorkspaceHistoryScope(
          resolveWorkspaceInteractionScope(event.target, canvasViewportRef.current)
        );
      }}
      onPointerDownCapture={(event) => {
        setWorkspaceHistoryScope(
          resolveWorkspaceInteractionScope(event.target, canvasViewportRef.current)
        );
      }}
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
              <form
                className="sidebar-section sidebar-inline-panel"
                onKeyDown={(event) => {
                  if (event.key !== "Escape") {
                    return;
                  }

                  event.preventDefault();
                  setIsFolderCreatorVisible(false);
                  setFolderNameDraft("");
                }}
                onSubmit={(event) => {
                  event.preventDefault();
                  createFolderFromSidebar();
                }}
              >
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
                  <button type="submit">
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
              </form>
            ) : null}

            <WorkspaceSidebarRecents
              activeEpisodeId={activeEpisode?.id ?? null}
              activeFolderId={activeFolder?.id ?? null}
              draggedSidebarEpisodeId={draggedSidebarEpisodeId}
              episodeMenuButtonRefs={episodeMenuButtonRefs}
              episodeMenuId={episodeMenuId}
              episodeMenuPosition={episodeMenuPosition}
              episodeRenameDraft={episodeRenameDraft}
              folderEpisodePickerFolderId={folderEpisodePickerFolderId}
              folderEpisodePickerPosition={folderEpisodePickerPosition}
              folderEpisodePins={folderEpisodePins}
              folderIdByEpisodeId={folderIdByEpisodeId}
              folderMenuButtonRefs={folderMenuButtonRefs}
              folderMenuId={folderMenuId}
              folderMenuPosition={folderMenuPosition}
              folderPickerEpisodeId={folderPickerEpisodeId}
              folderRenameDraft={folderRenameDraft}
              getViewportMenuPosition={getViewportMenuPosition}
              onBeginEpisodeRename={beginEpisodeRename}
              onBeginFolderRename={beginFolderRename}
              onDeleteFolder={requestDeleteFolder}
              onDissolveEpisodeFromFolder={dissolveEpisodeFromFolder}
              onReorderEpisodeWithinFolder={reorderEpisodeWithinFolder}
              onSelectEpisodeFromSidebar={selectEpisodeFromSidebar}
              onSubmitEpisodeRename={submitEpisodeRename}
              onSubmitFolderRename={submitFolderRename}
              onToggleEpisodeInFolderPicker={toggleEpisodeInFolderPicker}
              onToggleEpisodePin={toggleEpisodePin}
              onToggleFolderCollapsed={toggleFolderCollapsed}
              onToggleFolderPin={toggleFolderPin}
              onToggleFolderSort={toggleFolderSort}
              renamingEpisodeId={renamingEpisodeId}
              renamingFolderId={renamingFolderId}
              rootEpisodes={rootEpisodes}
              rootFolderScopeId={rootFolderScopeId}
              setDeleteEpisodeId={setDeleteEpisodeId}
              setDraggedSidebarEpisodeId={setDraggedSidebarEpisodeId}
              setEpisodeMenuId={setEpisodeMenuId}
              setEpisodeMenuPosition={setEpisodeMenuPosition}
              setEpisodeRenameDraft={setEpisodeRenameDraft}
              setFolderEpisodePickerFolderId={setFolderEpisodePickerFolderId}
              setFolderEpisodePickerPosition={setFolderEpisodePickerPosition}
              setFolderMenuId={setFolderMenuId}
              setFolderMenuPosition={setFolderMenuPosition}
              setFolderPickerEpisodeId={setFolderPickerEpisodeId}
              setFolderPickerPosition={setFolderPickerPosition}
              setFolderRenameDraft={setFolderRenameDraft}
              setObjectMenuId={setObjectMenuId}
              setObjectMenuPosition={setObjectMenuPosition}
              setRenamingEpisodeId={setRenamingEpisodeId}
              setRenamingFolderId={setRenamingFolderId}
              setSidebarFolders={setSidebarFolders}
              snapshotEpisodes={snapshot.episodes}
              sortingFolderId={sortingFolderId}
              visibleFolders={visibleFolders}
            />

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
                  <strong>{isAuthenticated ? profileName : signInLabel}</strong>
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
                  {!isAuthenticated && !isGoogleSignInEnabled ? (
                    <p className="support-copy sidebar-profile-auth-error" role="status">
                      {copy.persistence.signInWithGoogleNotConfigured}
                    </p>
                  ) : null}
                  {!isAuthenticated && isAuthSignInInProgress ? (
                    <p className="support-copy sidebar-profile-auth-error" role="status">
                      {copy.persistence.signingIn}
                    </p>
                  ) : null}
                  {!isAuthenticated && !isGoogleSignInEnabled ? null : authSignInError ? (
                    <p className="support-copy sidebar-profile-auth-error" role="status">
                      {authSignInError}
                    </p>
                  ) : null}
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
                        disabled={isAuthBusy || !isGoogleSignInEnabled}
                        onClick={handleSignInWithGoogle}
                        type="button"
                      >
                        {isAuthSignInInProgress ? copy.persistence.signingIn : signInLabel}
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
                    data-object-id={object.id}
                    data-testid={`object-row-${object.id}`}
                    key={object.id}
                    onFocus={(event) => {
                      if (event.target === event.currentTarget) {
                        setSelectedObjectId(object.id);
                      }
                    }}
                    tabIndex={0}
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
                    requestDeleteObject(objectMenuId);
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
            ref={canvasViewportRef}
            tabIndex={0}
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
                  dragPayload.level,
                  getNodeSize(effectiveNodeSizes, dragPayload.nodeId)
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
              aria-label="Node connections"
              className="connection-layer"
              role="group"
              viewBox={`0 0 ${stageWidth} ${stageHeight}`}
            >
              <defs>
                <marker
                  id="canvas-arrowhead"
                  markerHeight="7"
                  markerWidth="7"
                  orient="auto"
                  refX="6.3"
                  refY="3.5"
                  viewBox="0 0 7 7"
                >
                  <path d="M 0.8 0.8 L 6.2 3.5 L 0.8 6.2 L 2.2 3.5 Z" />
                </marker>
                <marker
                  id="canvas-active-arrowhead"
                  markerHeight="7"
                  markerWidth="7"
                  orient="auto"
                  refX="6.3"
                  refY="3.5"
                  viewBox="0 0 7 7"
                >
                  <path
                    className="connection-active-arrowhead"
                    d="M 0.8 0.8 L 6.2 3.5 L 0.8 6.2 L 2.2 3.5 Z"
                  />
                </marker>
                <marker
                  id="canvas-preview-arrowhead"
                  markerHeight="7"
                  markerWidth="7"
                  orient="auto"
                  refX="6.3"
                  refY="3.5"
                  viewBox="0 0 7 7"
                >
                  <path
                    className="connection-preview-arrowhead"
                    d="M 0.8 0.8 L 6.2 3.5 L 0.8 6.2 L 2.2 3.5 Z"
                  />
                </marker>
              </defs>
              {connectionLines.map((line) => {
                const parentNode = nodesById.get(line.parentId) ?? null;
                const childNode = nodesById.get(line.childId) ?? null;
                const isActiveConnection =
                  hoveredConnectionId === line.id || rewireNode?.id === line.childId;

                return (
                  <g
                    className={`connection-line-group${
                      isActiveConnection ? " is-active" : ""
                    }`}
                    key={line.id}
                  >
                    <path
                      className="connection-parent-line"
                      d={line.path}
                      markerEnd={
                        isActiveConnection
                          ? "url(#canvas-active-arrowhead)"
                          : "url(#canvas-arrowhead)"
                      }
                    />
                    <path
                      aria-label={`Adjust connection from ${parentNode ? getNodeHeadline(parentNode) : "parent node"} to ${childNode ? getNodeHeadline(childNode) : "child node"}`}
                      className="connection-hit-line"
                      d={line.hitPath}
                      data-child-id={line.childId}
                      data-parent-id={line.parentId}
                      data-testid={`connection-hit-${line.childId}`}
                      onMouseDown={(event) => {
                        beginRewireDrag(line.childId, event, {
                          connectionId: line.id,
                          parentId: line.parentId
                        });
                      }}
                      onMouseEnter={() => {
                        setHoveredConnectionId(line.id);
                      }}
                      onMouseLeave={() => {
                        setHoveredConnectionId((current) =>
                          current === line.id && rewireNode?.id !== line.childId
                            ? null
                            : current
                        );
                      }}
                      role="button"
                      tabIndex={0}
                    />
                  </g>
                );
              })}
              {rewirePreviewLine ? (
                <path
                  className="connection-preview-line"
                  d={rewirePreviewLine}
                  markerEnd="url(#canvas-preview-arrowhead)"
                />
              ) : null}
            </svg>
            {aiPanelNodeId === null ? (
              <div className="connection-handle-layer">
                {connectionLines.map((line) => {
                  const isActiveConnection =
                    hoveredConnectionId === line.id || rewireNode?.id === line.childId;

                  return isActiveConnection ? (
                    <button
                      aria-label="Drag Connection"
                      className="connection-line-grip"
                      disabled={isBusy}
                      key={`${line.id}-grip`}
                      onMouseDown={(event) => {
                        beginRewireDrag(line.childId, event, {
                          connectionId: line.id,
                          parentId: line.parentId
                        });
                      }}
                      style={
                        {
                          left: `${line.midX}px`,
                          top: `${line.midY}px`
                        } as CSSProperties
                      }
                      type="button"
                    >
                      <span aria-hidden="true" />
                    </button>
                  ) : null;
                })}
                {connectionLines.flatMap((line) => [
                  <button
                    aria-label="Adjust Connection"
                    className={`connection-port connection-port-line${
                      rewireNode?.id === line.childId || hoveredConnectionId === line.id ? " is-active" : ""
                    }`}
                    disabled={isBusy}
                    key={`${line.id}-start`}
                    onMouseDown={(event) => {
                      beginRewireDrag(line.childId, event, {
                        connectionId: line.id,
                        parentId: line.parentId
                      });
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
                      rewireNode?.id === line.childId || hoveredConnectionId === line.id ? " is-active" : ""
                    }`}
                    disabled={isBusy}
                    key={`${line.id}-end`}
                    onMouseDown={(event) => {
                      beginRewireDrag(line.childId, event, {
                        connectionId: line.id,
                        parentId: line.parentId
                      });
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
                          dragPayload.level,
                          getNodeSize(effectiveNodeSizes, dragPayload.nodeId)
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
                          disabled={isSingleMajorAnchorNode}
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
                    {laneLayoutsByLevel[lane.level].blocks
                      .filter((block) => block.kind === "spacer")
                      .map((block) => (
                        <CanvasLaneSpacer
                          height={block.height}
                          key={block.id}
                          role={block.role}
                          y={block.top}
                        />
                      ))}
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
            disabled={!canUseCanvasUndo}
            onClick={() => {
              if (!canUseCanvasUndo) {
                return;
              }

              void runUndoWithInlineDraftFlush();
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
            disabled={!canUseCanvasRedo}
            onClick={() => {
              if (!canUseCanvasRedo) {
                return;
              }

              void runRedoWithInlineDraftFlush();
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
            autoFocus
            className="modal-card"
            onKeyDown={(event) => {
              if (event.key !== "Enter") {
                return;
              }

              event.preventDefault();
              void deleteNodeAndAdjustCanvas(deleteTarget.id);
              setDeleteTargetId(null);
              setSelectedNodeId(null);
              setRewireNodeId(null);
            }}
            role="dialog"
            tabIndex={-1}
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
                  void deleteNodeAndAdjustCanvas(deleteTarget.id);
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
            autoFocus
            className="modal-card"
            onKeyDown={(event) => {
              if (event.key !== "Enter") {
                return;
              }

              event.preventDefault();
              void confirmDeleteEpisode();
            }}
            role="dialog"
            tabIndex={-1}
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

      {deleteFolderTarget ? (
        <div className="modal-backdrop" role="presentation">
          <section
            aria-labelledby="delete-folder-title"
            aria-modal="true"
            autoFocus
            className="modal-card"
            onKeyDown={(event) => {
              if (event.key !== "Enter") {
                return;
              }

              event.preventDefault();
              void confirmDeleteFolder();
            }}
            role="dialog"
            tabIndex={-1}
          >
            <span className="eyebrow">Delete Folder</span>
            <h3 id="delete-folder-title">{deleteFolderTarget.name}</h3>
            <p>This folder will be removed. Stories inside it will remain in Recent Stories.</p>
            <div className="control-row">
              <button
                className="button-secondary"
                onClick={() => {
                  setDeleteFolderId(null);
                }}
                type="button"
              >
                {copy.persistence.cancel}
              </button>
              <button
                onClick={() => {
                  void confirmDeleteFolder();
                }}
                type="button"
              >
                {copy.persistence.delete}
              </button>
            </div>
          </section>
        </div>
      ) : null}

      {deleteObjectTarget ? (
        <div className="modal-backdrop" role="presentation">
          <section
            aria-labelledby="delete-object-title"
            aria-modal="true"
            autoFocus
            className="modal-card"
            onKeyDown={(event) => {
              if (event.key !== "Enter") {
                return;
              }

              event.preventDefault();
              void confirmDeleteObject();
            }}
            role="dialog"
            tabIndex={-1}
          >
            <span className="eyebrow">Delete Object</span>
            <h3 id="delete-object-title">{deleteObjectTarget.name}</h3>
            <p>This object will be removed from the library and detached from canvas nodes.</p>
            <div className="control-row">
              <button
                className="button-secondary"
                onClick={() => {
                  setDeleteObjectId(null);
                }}
                type="button"
              >
                {copy.persistence.cancel}
              </button>
              <button
                onClick={() => {
                  void confirmDeleteObject();
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

type SidebarStorageRestoreState = {
  folders: string | null;
  pinnedObjectIds: string | null;
  pins: string | null;
  scopeKey: string | null;
};

// 사이드바 로컬 UI 저장 범위를 계정과 프로젝트 기준으로 계산합니다.
function getSidebarStorageScopeKey(cacheScopeKey: string, projectId: string) {
  return `${cacheScopeKey}:${projectId}`;
}

