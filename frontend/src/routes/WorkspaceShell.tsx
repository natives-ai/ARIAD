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
import type { KeywordSuggestion } from "@scenaairo/recommendation";
import type {
  StoryEpisode,
  StoryNode,
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
  rootFolderScopeId
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
  resolveNodeOverlapPlacement,
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
  applyLaneVerticalReflow
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
  renderTextWithObjectMentions,
  buildDisplayedKeywordSuggestions,
  toggleInlineKeywordToken,
  removeInlineSelectionWithTokenBoundaries,
  removeAdjacentInlineToken,
  getObjectMentionSignature,
  deriveNodeContentMode
} from "./workspace-shell/workspaceShell.inlineEditor";
import { cloneCopiedNodes } from "./workspace-shell/workspaceShell.node";
import {
  parseStoredStringArray
} from "./workspace-shell/workspaceShell.storage";
import {
  parseStoredFolderList,
  parseStoredEpisodePinMap,
  sanitizeSidebarFolders,
  buildSidebarEpisodeCollections
} from "./workspace-shell/workspaceShell.sidebar";
import { WorkspaceSidebarRecents } from "./workspace-shell/WorkspaceSidebarRecents";
import { WorkspaceObjectPanel } from "./workspace-shell/WorkspaceObjectPanel";
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
  const [rewireNodeId, setRewireNodeId] = useState<string | null>(null);
  const [deleteTargetId, setDeleteTargetId] = useState<string | null>(null);
  const [isDrawerOpen, setIsDrawerOpen] = useState(false);
  const [aiPanelNodeId, setAiPanelNodeId] = useState<string | null>(null);
  const [keywordSuggestions, setKeywordSuggestions] = useState<KeywordSuggestion[]>([]);
  const [keywordRefreshCycle, setKeywordRefreshCycle] = useState(0);
  const [selectedAiKeywords, setSelectedAiKeywords] = useState<string[]>([]);
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
  const pendingMentionObjectIdsRef = useRef(new Map<string, Promise<string | null>>());
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

  const activeProjectId = state?.snapshot.project.id ?? null;
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
      setSelectedObjectId(scopedObjects[0]?.id ?? null);
    }
  }, [activeEpisodeId, selectedObjectId, sidebarFolders, state]);

  useEffect(() => {
    window.localStorage.setItem(
      `${env.storagePrefix}:sidebar-collapsed`,
      String(isSidebarCollapsed)
    );
  }, [env.storagePrefix, isSidebarCollapsed]);

  useEffect(() => {
    if (!activeProjectId) {
      return;
    }

    const foldersKey = `${env.storagePrefix}:${cacheScopeKey}:sidebar-folders:${activeProjectId}`;
    const pinsKey = `${env.storagePrefix}:${cacheScopeKey}:folder-episode-pins:${activeProjectId}`;
    setSidebarFolders(parseStoredFolderList(window.localStorage.getItem(foldersKey)));
    setFolderEpisodePins(parseStoredEpisodePinMap(window.localStorage.getItem(pinsKey)));
  }, [activeProjectId, cacheScopeKey, env.storagePrefix]);

  useEffect(() => {
    if (!activeProjectId) {
      return;
    }

    const foldersKey = `${env.storagePrefix}:${cacheScopeKey}:sidebar-folders:${activeProjectId}`;
    window.localStorage.setItem(foldersKey, JSON.stringify(sidebarFolders));
  }, [activeProjectId, cacheScopeKey, env.storagePrefix, sidebarFolders]);

  useEffect(() => {
    if (!activeProjectId) {
      return;
    }

    const pinsKey = `${env.storagePrefix}:${cacheScopeKey}:folder-episode-pins:${activeProjectId}`;
    window.localStorage.setItem(pinsKey, JSON.stringify(folderEpisodePins));
  }, [activeProjectId, cacheScopeKey, env.storagePrefix, folderEpisodePins]);

  useEffect(() => {
    if (!activeProjectId) {
      return;
    }

    const key = `${env.storagePrefix}:${cacheScopeKey}:pinned-objects:${activeProjectId}`;
    setPinnedObjectIds(parseStoredStringArray(window.localStorage.getItem(key)));
  }, [activeProjectId, cacheScopeKey, env.storagePrefix]);

  useEffect(() => {
    if (!activeProjectId) {
      return;
    }

    const key = `${env.storagePrefix}:${cacheScopeKey}:pinned-objects:${activeProjectId}`;
    window.localStorage.setItem(key, JSON.stringify(pinnedObjectIds));
  }, [activeProjectId, cacheScopeKey, env.storagePrefix, pinnedObjectIds]);

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

        setNodeSizes((current) => ({
          ...current,
          [dragState.nodeId]: {
            height: nextHeight,
            width: nextWidth
          }
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
        const currentLaneCanvasBounds = laneCanvasBoundsRef.current;
        const currentTimelineAnchors = timelineAnchorsRef.current;

        if (dragState.kind === "node-drag-pending") {
          canvasDragStateRef.current = activeDragState;
          suppressNodeClickRef.current = dragState.nodeId;
        }

        if (!currentLaneCanvasBounds || !currentTimelineAnchors) {
          return;
        }

        const stageRect = canvasStageRef.current?.getBoundingClientRect();

        if (!stageRect) {
          return;
        }

        const stagePoint = {
          stageRect,
          x: (event.clientX - stageRect.left) / canvasZoom,
          y: (event.clientY - stageRect.top) / canvasZoom
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
          activeDragState.level === "major" && activeDragState.nodeId === endMajorNodeIdRef.current
            ? getTimelineAnchorPositions(
                Math.max(
                  timelineStartY + 120,
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
        setTimelineEndY(
          Math.max(
            timelineStartY + 120,
            Math.max(
              0,
              ...visibleNodesRef.current.map((node) => {
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
        return;
      }

      if (dragState.kind !== "timeline-end") {
        return;
      }

      const nextTimelineEndY = Math.max(
        timelineStartY + 120,
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
      const dragState = canvasDragStateRef.current;
      canvasDragStateRef.current = null;
      setIsCanvasPanning(false);
      const activeNodeDragPreview = activeNodeDragPreviewRef.current;

      if (dragState?.kind === "node-resize") {
        isNodeResizingRef.current = false;
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
          const nextLowestBottom = Math.max(
            0,
            ...visibleNodesRef.current.map((node) => {
              const placement = nodePlacementsRef.current.get(node.id);
              const size = getNodeSize(nodeSizesRef.current, node.id);
              return (placement?.y ?? 0) + size.height;
            })
          );
          setTimelineEndY(Math.max(timelineStartY + 120, nextLowestBottom));
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
  }, [canvasZoom, state !== null]);

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
      setAuthSignInError(null);
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
      const viewport = canvasViewportRef.current;
      const targetElement = event.target instanceof Element ? event.target : null;
      const isCanvasEventTarget =
        targetElement !== null &&
        viewport !== null &&
        viewport.contains(targetElement);

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
      const canUseCanvasShortcuts = isCanvasEventTarget || isSelectedNodeInputTarget;
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
          (key === "v" && usesModifier && copiedNodeTreeRef.current !== null));

      // 인라인 편집 포커스에서는 텍스트 전용 undo/redo를 브라우저 기본 동작으로 유지합니다.
      if (isSelectedNodeInputTarget && usesModifier && (key === "z" || key === "y")) {
        return;
      }

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
          void runRedo();
        } else {
          void runUndo();
        }

        return;
      }

      if (usesModifier && key === "y") {
        event.preventDefault();
        void runRedo();
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
    runRedo,
    runUndo,
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
  const isGuestEmptyState =
    state.session.mode === "guest" &&
    state.linkage === null &&
    isWorkspaceEmptyState;
  const isEmptyStateBusy =
    isAuthSignInInProgress ||
    state.syncStatus === "importing" ||
    state.syncStatus === "syncing";

  if (isAuthenticatedEmptyState || isGuestEmptyState) {
    return (
      <div className="workspace-shell workspace-shell-loading">
        <section className="panel panel-canvas">
          <span className="eyebrow">Center</span>
          <h1>{copy.workspace.title}</h1>
          <p>
            {isAuthenticatedEmptyState
              ? copy.persistence.authenticatedEmptyState
              : copy.persistence.guestEmptyState}
          </p>
          <div className="control-row">
            {isAuthenticatedEmptyState ? (
              <>
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
              </>
            ) : (
              <>
                <button
                  disabled={isEmptyStateBusy}
                  onClick={() => {
                    setDetailError(null);
                    void controller.createEpisode().catch((error) => {
                      setDetailError(toMessage(error));
                    });
                  }}
                  type="button"
                >
                  {copy.persistence.addEpisodes}
                </button>
                <button
                  className="button-secondary"
                  disabled={isEmptyStateBusy}
                  onClick={handleSignInWithGoogle}
                  type="button"
                >
                  {isAuthSignInInProgress ? copy.persistence.signingIn : signInLabel}
                </button>
              </>
            )}
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
      .map((node) => getNodeSize(nodeSizes, node.id).width + laneDividerNodePadding * 2)
  );
  const minorLaneRequiredWidth = Math.max(
    minLaneWidth,
    ...visibleNodes
      .filter((node) => node.level === "minor")
      .map((node) => getNodeSize(nodeSizes, node.id).width + laneDividerNodePadding * 2)
  );
  const detailLaneRequiredWidth = Math.max(
    minLaneWidth,
    ...visibleNodes
      .filter((node) => node.level === "detail")
      .map((node) => getNodeSize(nodeSizes, node.id).width + laneDividerNodePadding * 2)
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
  const timelineAnchors = getTimelineAnchorPositions(
    timelineEndY,
    laneCanvasBounds.major,
    {
      height: nodeCardHeight,
      width: nodeCardWidth
    }
  );
  const orderedMajorNodes = orderedNodes.filter((node) => node.level === "major");
  const lockedStartMajorNodeId = orderedMajorNodes[0]?.id ?? null;
  const lockedEndMajorNodeId = orderedMajorNodes.at(-1)?.id ?? lockedStartMajorNodeId;
  const lockedMajorAnchorNodeIds = new Set(
    [lockedStartMajorNodeId].filter(
      (nodeId): nodeId is string => nodeId !== null
    )
  );
  const nodePlacements = new Map<string, { x: number; y: number }>();
  const visibleNodeIdsByLevel = {
    detail: visibleNodes.filter((entry) => entry.level === "detail").map((entry) => entry.id),
    major: visibleNodes.filter((entry) => entry.level === "major").map((entry) => entry.id),
    minor: visibleNodes.filter((entry) => entry.level === "minor").map((entry) => entry.id)
  } satisfies Record<StoryNodeLevel, string[]>;

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

  for (const node of visibleNodes) {
    if (node.level !== "major" || !lockedMajorAnchorNodeIds.has(node.id)) {
      continue;
    }

    const nodeSize = getNodeSize(nodeSizes, node.id);
    nodePlacements.set(node.id, getAnchoredMajorPlacement(node, nodeSize));
  }

  for (const node of visibleNodes) {
    const nodeSize = getNodeSize(nodeSizes, node.id);

    if (node.level === "major" && lockedMajorAnchorNodeIds.has(node.id)) {
      continue;
    }

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
    const resolvedPlacement = resolveNodeOverlapPlacement(
      node.id,
      alignedPlacement,
      nodeSize,
      nodePlacements,
      nodeSizes,
      visibleNodeIdsByLevel[node.level],
      {
        gap: 0
      }
    );

    nodePlacements.set(node.id, resolvedPlacement);
  }
  // major 레인은 구조 순서를 우선으로 최소 세로 간격만 보정해 자유 이동/재정렬 충돌을 줄입니다.
  applyLaneVerticalReflow(visibleNodeIdsByLevel.major, nodePlacements, nodeSizes, {
    gap: 8,
    lockedNodeIds: new Set(
      [lockedStartMajorNodeId].filter((nodeId): nodeId is string => nodeId !== null)
    )
  });
  // 같은 레인의 노드 높이가 바뀐 경우 최소 간격만큼 아래 노드를 밀어 겹침을 완화합니다.
  applyLaneVerticalReflow(visibleNodeIdsByLevel.minor, nodePlacements, nodeSizes);
  applyLaneVerticalReflow(visibleNodeIdsByLevel.detail, nodePlacements, nodeSizes);
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
        const size = getNodeSize(nodeSizes, node.id);

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

    const clampedTimelineEndY = Math.max(timelineStartY + 120, nextTimelineEndY);
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

    const nodeSize = getNodeSize(nodeSizes, nodeId);
    const placement =
      nodePlacements.get(nodeId) ??
      getFallbackNodePlacementWithinBounds(node, orderedNodes, laneCanvasBounds, nodeSize);

    event.preventDefault();
    event.stopPropagation();
    event.currentTarget.setPointerCapture?.(event.pointerId);
    setDragPayload(null);
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

    const nodeSize = getNodeSize(nodeSizes, nodeId);

    event.preventDefault();
    event.stopPropagation();
    event.currentTarget.setPointerCapture?.(event.pointerId);
    isNodeResizingRef.current = true;
    setDragPayload(null);
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
      liveSnapshot.nodes.find((node) => node.id === nodeId) ??
      nodesById.get(nodeId) ??
      null;
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
        .map((object) => [object.name.toLowerCase(), object.id])
    );
    const nextObjectIds: string[] = [];

    for (const mentionName of mentionNames) {
      const normalizedName = mentionName.toLowerCase();
      let objectId = existingObjectIdsByName.get(normalizedName) ?? null;

      if (!objectId) {
        const pendingObjectPromise = pendingMentionObjectIdsRef.current.get(normalizedName);

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
              pendingMentionObjectIdsRef.current.delete(normalizedName);
            });

          pendingMentionObjectIdsRef.current.set(normalizedName, createObjectPromise);
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
      const existing = getNodeSize(current, nodeId);
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
    if (!objectMentionQuery || !selectedNode) {
      return;
    }

    const mentionText = `${getObjectToken(objectName)}${withTrailingSpace ? " " : ""}`;
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
      getInsertIndexForCanvasY(level, resolvedPlacement.y + nodeCardHeight / 2),
      {
        canvasX: resolvedPlacement.x,
        canvasY: resolvedPlacement.y
      }
    );

    if (createdNodeId) {
      if (level === "major" && orderedNodes.every((node) => node.level !== "major")) {
        const timelineSpanHeight = Math.max(
          nodeCardHeight,
          Math.ceil(Math.max(120, effectiveTimelineEndY - timelineStartY))
        );

        setNodeSizes((current) => ({
          ...current,
          [createdNodeId]: {
            height: timelineSpanHeight,
            width: nodeCardWidth
          }
        }));
      }

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
      const intendedSnappedPlacement = snapMajorNodePlacementToTimelineAnchors(
        level,
        placement,
        timelineAnchors,
        nodeSize
      );
      const requiredTimelineEndY =
        nodeId === endMajorNodeId
          ? Math.max(timelineStartY + 120, intendedSnappedPlacement.y + nodeSize.height)
          : timelineEndY;
      const dynamicTimelineAnchors = getTimelineAnchorPositions(
        requiredTimelineEndY,
        laneCanvasBounds.major,
        nodeSize
      );
      const snappedPlacement = snapMajorNodePlacementToTimelineAnchors(
        level,
        intendedSnappedPlacement,
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

    const nextLowestBottom = getProjectedLowestNodeBottom(nodeId, resolvedPlacement, nodeSize);
    setTimelineEndY(Math.max(timelineStartY + 120, nextLowestBottom));

    await controller.updateNodePlacement(nodeId, {
      canvasX: resolvedPlacement.x,
      canvasY: resolvedPlacement.y
    });
    const targetInsertIndex = getInsertIndexForCanvasY(
      level,
      resolvedPlacement.y + nodeSize.height / 2,
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

  // 이 함수는 노드 삭제 후 남은 배치 기준으로 타임라인/캔버스 높이를 자연스럽게 줄입니다.
  async function deleteNodeTreeAndAdjustCanvas(nodeId: string) {
    const subtreeIds = new Set(collectSubtreeNodes(orderedNodes, nodeId).map((node) => node.id));

    await controller.deleteNodeTree(nodeId);

    const remainingNodes = orderedNodes.filter((node) => !subtreeIds.has(node.id));
    const remainingNodesById = new Map(remainingNodes.map((node) => [node.id, node]));
    const remainingVisibleNodes = remainingNodes.filter(
      (node) => !hasCollapsedAncestor(node, remainingNodesById)
    );
    const remainingLowestBottom = Math.max(
      0,
      ...remainingVisibleNodes.map((node) => {
        const nodeSize = getNodeSize(nodeSizes, node.id);
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
    const nextTimelineEndY = Math.max(timelineStartY + 120, remainingLowestBottom);

    if (nextTimelineEndY < timelineEndY) {
      setTimelineEndY(nextTimelineEndY);
    }
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

    setAiPanelNodeId(node.id);
    setKeywordSuggestions([]);
    setSelectedAiKeywords(nextSelectedKeywords);
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
    const { nextCaret, nextText } = toggleInlineKeywordToken(
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
    selectedAiKeywords,
    keywordSuggestions,
    keywordRefreshCycle
  );
  const visualMajorPlacements = orderedMajorNodes
    .map((node) => {
      const placement = nodePlacements.get(node.id);

      if (!placement) {
        return null;
      }

      const nodeSize = getNodeSize(nodeSizes, node.id);

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
  nodeSizesRef.current = nodeSizes;
  timelineAnchorsRef.current = timelineAnchors;
  endMajorNodeIdRef.current = endMajorNodeId;
  stageHeightRef.current = stageHeight;
  selectedNodeIdRef.current = selectedNodeId;

  const renderedNodes = visibleNodes.map((node) => {
    const nodeSize = getNodeSize(nodeSizes, node.id);
    const isSelected = selectedNode?.id === node.id;
    const isDragging = activeNodeDragPreview?.nodeId === node.id;
    const isRewireSource = rewireNode?.id === node.id;
    const isRewireTarget = candidateParentIds.has(node.id);
    const isHoveredRewireTarget = rewireHoverTargetId === node.id;
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
    const shouldShowPlaceholder = !isSelected && !displayBodyText && !hasVisibleKeywords;
    const selectedNodeTitle =
      extractDisplayText(displayText) || activeKeywords.join(" ") || getNodeHeadline(node);

    return (
      <article
        className={`node-card node-card-level-${node.level} node-card-${node.contentMode}${isSelected ? " is-selected" : ""}${isDragging ? " is-dragging" : ""}${isRewireSource ? " is-rewire-source" : ""}${isRewireTarget ? " is-rewire-target" : ""}${isHoveredRewireTarget ? " is-rewire-hover-target" : ""}${node.isImportant ? " is-important" : ""}${node.isFixed ? " is-fixed" : ""}${node.isCollapsed ? " is-collapsed" : ""}${isStartMajorNode ? " is-start-node" : ""}${isEndMajorNode ? " is-end-node" : ""}${aiPanelNode?.id === node.id ? " has-keyword-cloud" : ""}`}
        data-testid={`node-${node.id}`}
        draggable={false}
        key={node.id}
        onClick={() => {
          if (suppressNodeClickRef.current === node.id) {
            suppressNodeClickRef.current = null;
            return;
          }

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
        onPointerDown={(event) => {
          beginNodeDrag(node.id, node.level, event);
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
                  data-node-id={node.id}
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
                      selectionStart !== selectionEnd &&
                      (event.key === "Backspace" || event.key === "Delete")
                    ) {
                      const removableSelection = removeInlineSelectionWithTokenBoundaries(
                        inlineNodeTextDraft,
                        selectionStart,
                        selectionEnd
                      );

                      if (removableSelection) {
                        event.preventDefault();
                        setInlineNodeTextDraft(removableSelection.nextText);
                        setSelectedAiKeywords(extractInlineKeywords(removableSelection.nextText));
                        syncInlineObjectMentions(node.id, removableSelection.nextText);

                        window.requestAnimationFrame(() => {
                          selectedNodeInputRef.current?.focus();
                          selectedNodeInputRef.current?.setSelectionRange(
                            removableSelection.nextCaret,
                            removableSelection.nextCaret
                          );
                          syncSelectedNodeInputHeight(node.id, selectedNodeInputRef.current);
                        });
                        return;
                      }
                    }

                    if (
                      activeMentionSuggestion &&
                      (event.key === "Enter" ||
                        event.key === "Tab" ||
                        (objectMentionQuery?.mode === "mention" && event.key === " "))
                    ) {
                      event.preventDefault();
                      applyObjectMentionSelection(
                        activeMentionSuggestion.name,
                        objectMentionQuery?.mode === "mention" && event.key === " "
                      );
                      return;
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
        {isSelected && !node.isFixed ? (
          <>
            <button
              aria-label="Resize horizontally"
              className="node-resize-handle node-resize-handle-horizontal"
              onPointerDown={(event) => {
                beginNodeResize(node.id, "horizontal", event);
              }}
              type="button"
            />
            <button
              aria-label="Resize vertically"
              className="node-resize-handle node-resize-handle-vertical"
              onPointerDown={(event) => {
                beginNodeResize(node.id, "vertical", event);
              }}
              type="button"
            />
            <button
              aria-label="Resize diagonally"
              className="node-resize-handle node-resize-handle-diagonal"
              onPointerDown={(event) => {
                beginNodeResize(node.id, "diagonal", event);
              }}
              type="button"
            />
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
              ? hoveredPlacement.x + hoveredSize.width / 2
              : rewirePreviewPoint.x;
          const startY =
            hoveredPlacement && hoveredSize
              ? hoveredPlacement.y + hoveredSize.height / 2
              : rewirePreviewPoint.y;
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
              onDeleteFolder={deleteFolder}
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
              snapshotEpisodeCount={snapshot.episodes.length}
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
              void runUndo();
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
              void runRedo();
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
                  void deleteNodeTreeAndAdjustCanvas(deleteTarget.id);
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

