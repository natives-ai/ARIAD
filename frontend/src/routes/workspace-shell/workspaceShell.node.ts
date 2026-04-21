// 이 파일은 WorkspaceShell 노드 복제 보조 함수를 제공합니다.
import type { StoryNode } from "@scenaairo/shared";

export function cloneCopiedNodes(nodes: StoryNode[]) {
  return nodes.map((node) => ({
    ...node,
    keywords: [...node.keywords],
    objectIds: [...node.objectIds]
  }));
}
