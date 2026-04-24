import type { StoryNode, TemporaryDrawerItem } from "@ariad/shared";

import { sortNodesByOrder } from "./nodeTree";

interface DrawerNodeTreePayload {
  nodes: StoryNode[];
  rootId: string | null;
  type: "story_node_tree";
  version: 1;
}

function capitalize(value: string) {
  return value.charAt(0).toUpperCase() + value.slice(1);
}

function stripInlineFormattingMarkers(value: string) {
  return value
    .replace(/\u2063([^\u2064\n]+?)\u2064/g, "$1")
    .replace(/\u2065([^\u2066\n]+?)\u2066/g, "$1")
    .replace(/@([^@\n]+?)@/g, "$1");
}

export function getNodeHeadline(node: Pick<StoryNode, "contentMode" | "keywords" | "text">) {
  switch (node.contentMode) {
    case "keywords":
      return node.keywords.length > 0 ? node.keywords.join(", ") : "Empty node";
    case "text":
      return stripInlineFormattingMarkers(node.text).trim() || "Empty node";
    case "empty":
      return "Empty node";
  }
}

export function getNodeDrawerLabel(node: StoryNode) {
  return `${capitalize(node.level)} beat: ${getNodeHeadline(node)}`;
}

export function serializeDrawerPayload(nodes: StoryNode[], rootId: string) {
  const orderedNodes = sortNodesByOrder(nodes);
  const payload: DrawerNodeTreePayload = {
    nodes: orderedNodes,
    rootId,
    type: "story_node_tree",
    version: 1
  };

  return JSON.stringify(payload);
}

export function parseDrawerPayload(note: string) {
  try {
    const parsed = JSON.parse(note) as Partial<DrawerNodeTreePayload>;

    if (
      parsed?.version !== 1 ||
      parsed.type !== "story_node_tree" ||
      !Array.isArray(parsed.nodes)
    ) {
      return null;
    }

    return {
      nodes: parsed.nodes.filter(
        (node): node is StoryNode =>
          typeof node?.id === "string" &&
          typeof node?.projectId === "string" &&
          typeof node?.episodeId === "string" &&
          typeof node?.level === "string"
      ),
      rootId: typeof parsed.rootId === "string" ? parsed.rootId : null
    };
  } catch {
    return null;
  }
}

export function getDrawerItemPreview(item: TemporaryDrawerItem) {
  const payload = parseDrawerPayload(item.note);

  if (!payload || payload.nodes.length === 0) {
    return {
      detail: item.note,
      label: item.label,
      nodeCount: 1,
      rootLevel: null as StoryNode["level"] | null
    };
  }

  const rootNode =
    payload.nodes.find((node) => node.id === payload.rootId) ?? payload.nodes[0]!;

  return {
    detail:
      payload.nodes.length === 1
        ? getNodeHeadline(rootNode)
        : `${payload.nodes.length} linked nodes parked in this drawer item.`,
    label: item.label,
    nodeCount: payload.nodes.length,
    rootLevel: rootNode.level
  };
}
