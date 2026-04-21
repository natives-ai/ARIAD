// 이 파일은 WorkspaceShell 캔버스/편집 상수를 정의합니다.
import type { StoryNode, StoryNodeLevel, StoryObjectCategory } from "@scenaairo/shared";

import { copy } from "../../copy";

export const laneDefinitions: Array<{
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

export const initialStageWidth = 1050;
export const stageInnerLeft = 42;
export const stageInnerRight = 1012;
export const stageTopPadding = 36;
export const laneGap = 56;
export const laneDividerNodePadding = 40;
export const initialLaneDividerXs = {
  first: 355,
  second: 700,
  detailEdge: stageInnerRight
};
export const stageRightPadding = initialStageWidth - stageInnerRight;
export const minLaneWidth = 220;
export const maxCanvasContentRight = 2200;
export const maxCanvasContentBottom = 2800;
export const timelineRailWidth = 15;
export const timelineStartY = 58;
export const initialTimelineEndY = 450;
export const timelineHandleHeight = 30;
export const timelineNodeSnapThreshold = 28;
export const nodeCardWidth = 268;
export const nodeCardHeight = 102;
export const nodeVerticalSpacing = 148;
export const laneContentStartY = 56;
export const canvasBottomPadding = 8;
export const minimumCanvasHeight = 220;
export const minCanvasZoom = 0.7;
export const maxCanvasZoom = 1.8;
export const keywordTokenStart = "\u2063";
export const keywordTokenEnd = "\u2064";
export const objectTokenStart = "\u2065";
export const objectTokenEnd = "\u2066";
export const emptyNodes: StoryNode[] = [];
export const objectCategoryOptions: StoryObjectCategory[] = ["person", "place", "thing"];
export const rootFolderScopeId = "__root__";
