// 이 파일은 에피소드 단위 캔버스 UI 상태와 undo/redo 복원을 관리합니다.
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { StoryNode } from "@scenaairo/shared";

import type { WorkspacePersistenceController } from "../../persistence/controller";
import { sortNodesByOrder } from "../../persistence/nodeTree";
import {
  initialLaneDividerXs,
  initialTimelineEndY
} from "./workspaceShell.constants";
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
  controller: Pick<WorkspacePersistenceController, "getState" | "redo" | "undo">;
  snapshotNodes: StoryNode[];
};

// 이 함수는 레인 분할 좌표 상태를 안전하게 복제합니다.
function cloneLaneDividerState(value: LaneDividerState): LaneDividerState {
  return {
    detailEdge: value.detailEdge,
    first: value.first,
    second: value.second
  };
}

// 이 함수는 노드 크기 맵을 깊은 복사합니다.
function cloneNodeSizeState(nodeSizes: Record<string, NodeSize>) {
  return Object.fromEntries(
    Object.entries(nodeSizes).map(([nodeId, size]) => [nodeId, { ...size }])
  );
}

// 이 함수는 에피소드 캔버스 히스토리 키를 생성합니다.
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
        `${node.id}:${node.orderIndex}:${node.parentId ?? ""}:${node.level}:${node.canvasX ?? ""}:${node.canvasY ?? ""}`
    )
    .join("|");

  return `${episodeId}::${nodeSignature}`;
}

// 이 훅은 에피소드 캔버스 상태와 undo/redo 복원을 제공합니다.
export function useEpisodeCanvasState({
  activeEpisodeId,
  controller,
  snapshotNodes
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
  const episodeCanvasHistoryRef = useRef<Record<string, EpisodeCanvasHistoryState>>({});

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

  useEffect(() => {
    laneDividerXsRef.current = laneDividerXs;
  }, [laneDividerXs]);

  useEffect(() => {
    timelineEndYRef.current = timelineEndY;
  }, [timelineEndY]);

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

    if (
      JSON.stringify(storedState.laneDividerXs) !==
      JSON.stringify(laneDividerXsRef.current)
    ) {
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
