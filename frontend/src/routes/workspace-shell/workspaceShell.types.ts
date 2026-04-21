// 이 파일은 WorkspaceShell에서 사용하는 타입 선언을 정의합니다.
import type { StoryNodeLevel } from "@scenaairo/shared";

export type DragPayload =
  | {
      kind: "draft";
    }
  | {
      kind: "node";
      level: StoryNodeLevel;
      nodeId: string;
    };

export type DetailEditorMode = "create-object" | "object";
export type ObjectSortMode =
  | "name-asc"
  | "name-desc"
  | "oldest"
  | "recent"
  | "usage-asc"
  | "usage-desc";

export interface SidebarFolder {
  createdAt: string;
  episodeIds: string[];
  id: string;
  isCollapsed: boolean;
  isPinned: boolean;
  name: string;
  updatedAt: string;
}

export type EpisodePinMap = Record<string, string[]>;
export type NodeResizeDirection = "diagonal" | "horizontal" | "vertical";

export interface NodeSize {
  height: number;
  width: number;
}

export interface ObjectMentionQuery {
  end: number;
  mode: "mention" | "word";
  query: string;
  start: number;
}
