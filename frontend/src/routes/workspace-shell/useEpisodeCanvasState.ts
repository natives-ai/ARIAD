// 이 파일은 에피소드 단위 캔버스 UI 상태를 관리합니다.
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { StoryNode } from "@scenaairo/shared";

import type { WorkspacePersistenceController } from "../../persistence/controller";
import { sortNodesByOrder } from "../../persistence/nodeTree";
import {
  initialLaneDividerXs,
  initialTimelineEndY
} from "./workspaceShell.constants";
import {
  parseStoredEpisodeCanvasUiState,
  sanitizeEpisodeCanvasUiState,
  type EpisodeCanvasUiState
} from "./workspaceShell.storage";
import type { NodeSize } from "./workspaceShell.types";

type LaneDividerState = {
  detailEdge: number;
  first: number;
  second: number;
};

type EpisodeCanvasHistoryState = {
  laneDividerXs: LaneDividerState;
  nodeSizes: Record<string, NodeSize>;
  timelineEndY: number;
};

type UseEpisodeCanvasStateParams = {
  activeEpisodeId: string | null;
  cacheScopeKey: string;
  controller: Pick<WorkspacePersistenceController, "getState" | "redo" | "undo">;
  snapshotNodes: StoryNode[];
  storagePrefix: string;
};

// 상태 객체를 복사해 참조를 분리합니다.
function cloneLaneDividerState(value: LaneDividerState): LaneDividerState {
  return {
    detailEdge: value.detailEdge,
    first: value.first,
    second: value.second
  };
}

// 노드 크기 맵을 복사하고 정렬해 저장 순서를 고정합니다.
function cloneNodeSizeState(nodeSizes: Record<string, NodeSize>) {
  return Object.fromEntries(
    (Object.entries(nodeSizes) as Array<[string, NodeSize]>)
      .map(([nodeId, size]) => [nodeId, { ...size }] as const)
      .sort(([left], [right]) => left.localeCompare(right))
  );
}

// 스냅샷 기반 undo/redo 복원 키를 만듭니다.
function getEpisodeCanvasHistorySignature(
  episodeId: string | null,
  nodes: StoryNode[]
) {
  if (!episodeId) {
    return null;
  }

  const nodeSignature = nodes
    .map(
      (node) =>
        `${node.id}:${node.orderIndex}:${node.parentId ?? ""}:${node.level}:${node.canvasX ?? ""}:${node.canvasY ?? ""}:${node.canvasWidth ?? ""}:${node.canvasHeight ?? ""}`
    )
    .join("|");

  return `${episodeId}::${nodeSignature}`;
}

// 에피소드 UI 상태 저장키를 만듭니다.
function getEpisodeCanvasUiStorageKey(
  storagePrefix: string,
  cacheScopeKey: string,
  episodeId: string
) {
  return `${storagePrefix}:${cacheScopeKey}:episode-canvas-ui:${episodeId}`;
}

// 예전 스코프 미포함 저장키를 계산합니다.
function getLegacyEpisodeCanvasUiStorageKey(storagePrefix: string, episodeId: string) {
  return `${storagePrefix}:episode-canvas-ui:${episodeId}`;
}

// 로컬 저장값을 기본값으로 보정합니다.
function sanitizeEpisodeCanvasUiDefaults(
  storedState: EpisodeCanvasUiState,
  activeEpisodeNodes: StoryNode[]
) {
  return sanitizeEpisodeCanvasUiState(storedState, activeEpisodeNodes, {
    laneDividerXs: {
      detailEdge: initialLaneDividerXs.detailEdge,
      first: initialLaneDividerXs.first,
      second: initialLaneDividerXs.second
    },
    timelineEndY: initialTimelineEndY
  });
}

// 상태를 복원하고, undo/redo 동작 시 캔버스 UI를 되돌립니다.
export function useEpisodeCanvasState({
  activeEpisodeId,
  cacheScopeKey,
  controller,
  snapshotNodes,
  storagePrefix
}: UseEpisodeCanvasStateParams) {
  const [laneDividerXs, setLaneDividerXs] = useState<LaneDividerState>(() => ({
    detailEdge: initialLaneDividerXs.detailEdge,
    first: initialLaneDividerXs.first,
    second: initialLaneDividerXs.second
  }));
  const [timelineEndY, setTimelineEndY] = useState(initialTimelineEndY);
  const [nodeSizes, setNodeSizes] = useState<Record<string, NodeSize>>({});

  const laneDividerXsRef = useRef(laneDividerXs);
  const nodeSizesRef = useRef<Record<string, NodeSize>>({});
  const timelineEndYRef = useRef(timelineEndY);
  const activeEpisodeNodesRef = useRef<StoryNode[]>([]);
  const episodeCanvasHistoryRef = useRef<Record<string, EpisodeCanvasHistoryState>>({});
  const isHydratingRef = useRef(false);

  const activeEpisodeNodes = useMemo(() => {
    if (!activeEpisodeId) {
      return [] as StoryNode[];
    }

    return sortNodesByOrder(
      snapshotNodes.filter((node) => node.episodeId === activeEpisodeId)
    );
  }, [activeEpisodeId, snapshotNodes]);
  const activeEpisodeCanvasHistorySignature = useMemo(() => {
    return getEpisodeCanvasHistorySignature(activeEpisodeId, activeEpisodeNodes);
  }, [activeEpisodeId, activeEpisodeNodes]);
  const activeEpisodeNodeIds = useMemo(() => {
    return activeEpisodeNodes
      .map((node) => node.id)
      .sort()
      .join("|");
  }, [activeEpisodeNodes]);

  // 최신 상태를 ref로 항상 유지합니다.
  useEffect(() => {
    laneDividerXsRef.current = laneDividerXs;
  }, [laneDividerXs]);

  useEffect(() => {
    timelineEndYRef.current = timelineEndY;
  }, [timelineEndY]);

  useEffect(() => {
    nodeSizesRef.current = nodeSizes;
  }, [nodeSizes]);

  useEffect(() => {
    activeEpisodeNodesRef.current = activeEpisodeNodes;
  }, [activeEpisodeNodes]);

  // 에피소드 전환 시 localStorage에서 캔버스 UI를 복원합니다.
  /* eslint-disable react-hooks/set-state-in-effect */
  useEffect(() => {
    isHydratingRef.current = true;

    if (!activeEpisodeId) {
      setLaneDividerXs({
        detailEdge: initialLaneDividerXs.detailEdge,
        first: initialLaneDividerXs.first,
        second: initialLaneDividerXs.second
      });
      setTimelineEndY(initialTimelineEndY);
      setNodeSizes({});
      queueMicrotask(() => {
        isHydratingRef.current = false;
      });
      return;
    }

    const storageKey = getEpisodeCanvasUiStorageKey(
      storagePrefix,
      cacheScopeKey,
      activeEpisodeId
    );
    const legacyStorageKey = getLegacyEpisodeCanvasUiStorageKey(
      storagePrefix,
      activeEpisodeId
    );
    const storedValue =
      window.localStorage.getItem(storageKey) ??
      window.localStorage.getItem(legacyStorageKey);
    const parsedState = parseStoredEpisodeCanvasUiState(storageKey
      ? storedValue
      : null,
      {
        laneDividerXs: {
          detailEdge: initialLaneDividerXs.detailEdge,
          first: initialLaneDividerXs.first,
          second: initialLaneDividerXs.second
        },
        timelineEndY: initialTimelineEndY
      });
    const sanitizedState = sanitizeEpisodeCanvasUiDefaults(
      parsedState,
      activeEpisodeNodesRef.current
    );

    setLaneDividerXs(cloneLaneDividerState(sanitizedState.laneDividerXs));
    setTimelineEndY(sanitizedState.timelineEndY);
    setNodeSizes(cloneNodeSizeState(sanitizedState.nodeSizes));

    // 구버전 키 값이 있으면 현재 스코프 키로 승격해 다음부터 단일 경로를 사용합니다.
    if (
      window.localStorage.getItem(storageKey) === null &&
      window.localStorage.getItem(legacyStorageKey) !== null
    ) {
      window.localStorage.setItem(storageKey, JSON.stringify(sanitizedState));
    }

    queueMicrotask(() => {
      isHydratingRef.current = false;
    });
  }, [
    activeEpisodeId,
    activeEpisodeNodeIds,
    cacheScopeKey,
    storagePrefix
  ]);
  /* eslint-enable react-hooks/set-state-in-effect */

  // 현재 시그니처 기준으로 undo/redo 복원용 UI 이력을 저장합니다.
  useEffect(() => {
    if (!activeEpisodeCanvasHistorySignature) {
      return;
    }

    episodeCanvasHistoryRef.current[activeEpisodeCanvasHistorySignature] = {
      laneDividerXs: cloneLaneDividerState(laneDividerXs),
      nodeSizes: cloneNodeSizeState(nodeSizes),
      timelineEndY
    };
  }, [activeEpisodeCanvasHistorySignature, laneDividerXs, nodeSizes, timelineEndY]);

  // 에피소드별 캔버스 UI 상태를 localStorage에 영속화합니다.
  useEffect(() => {
    if (!activeEpisodeId || isHydratingRef.current) {
      return;
    }

    const storageKey = getEpisodeCanvasUiStorageKey(
      storagePrefix,
      cacheScopeKey,
      activeEpisodeId
    );
    const persistState: EpisodeCanvasUiState = {
      laneDividerXs: cloneLaneDividerState(laneDividerXs),
      nodeSizes: cloneNodeSizeState(nodeSizes),
      timelineEndY
    };

    window.localStorage.setItem(storageKey, JSON.stringify(persistState));
  }, [
    activeEpisodeId,
    cacheScopeKey,
    laneDividerXs,
    nodeSizes,
    storagePrefix,
    timelineEndY
  ]);

  // undo/redo 직후 해당 스냅샷 시그니처의 UI를 복원합니다.
  const restoreCanvasUiFromSnapshotHistory = useCallback(() => {
    const snapshot = controller.getState()?.snapshot;

    if (!snapshot) {
      return;
    }

    const historyEpisodeId =
      snapshot.project.activeEpisodeId ??
      snapshot.episodes.find((episode) => episode.id === snapshot.project.activeEpisodeId)?.id ??
      snapshot.episodes[0]?.id ??
      null;

    if (!historyEpisodeId) {
      return;
    }

    const historyNodes = sortNodesByOrder(
      snapshot.nodes.filter((node) => node.episodeId === historyEpisodeId)
    );
    const historySignature = getEpisodeCanvasHistorySignature(
      historyEpisodeId,
      historyNodes
    );

    if (!historySignature) {
      return;
    }

    const storedState = episodeCanvasHistoryRef.current[historySignature];

    if (!storedState) {
      return;
    }

    if (JSON.stringify(storedState.laneDividerXs) !== JSON.stringify(laneDividerXsRef.current)) {
      setLaneDividerXs(cloneLaneDividerState(storedState.laneDividerXs));
    }

    if (storedState.timelineEndY !== timelineEndYRef.current) {
      setTimelineEndY(storedState.timelineEndY);
    }

    if (JSON.stringify(storedState.nodeSizes) !== JSON.stringify(nodeSizesRef.current)) {
      setNodeSizes(cloneNodeSizeState(storedState.nodeSizes));
    }
  }, [controller]);

  const runUndo = useCallback(async () => {
    await controller.undo();
    restoreCanvasUiFromSnapshotHistory();
  }, [controller, restoreCanvasUiFromSnapshotHistory]);

  const runRedo = useCallback(async () => {
    await controller.redo();
    restoreCanvasUiFromSnapshotHistory();
  }, [controller, restoreCanvasUiFromSnapshotHistory]);

  return {
    laneDividerXs,
    nodeSizes,
    nodeSizesRef,
    runRedo,
    runUndo,
    setLaneDividerXs,
    setNodeSizes,
    setTimelineEndY,
    timelineEndY
  };
}
