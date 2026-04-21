// 이 파일은 WorkspaceShell 로컬 저장값 파싱 함수를 제공합니다.
import type { StoryNode } from "@scenaairo/shared";

import { nodeCardHeight, nodeCardWidth } from "./workspaceShell.constants";
import type { NodeSize } from "./workspaceShell.types";

export function parseStoredStringArray(value: string | null) {
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

export function parseStoredNodeSizeMap(value: string | null) {
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

export function sanitizeNodeSizeMap(
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
