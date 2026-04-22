// 이 파일은 캔버스 노드 카드 렌더링과 노드 내부 상호작용을 담당합니다.
import {
  type CSSProperties,
  type Dispatch,
  type MutableRefObject,
  type PointerEvent as ReactPointerEvent,
  type SetStateAction
} from "react";
import type { KeywordSuggestion } from "@scenaairo/recommendation";
import type { StoryNode } from "@scenaairo/shared";

import { copy } from "../../copy";
import { getNodeHeadline } from "../../persistence/drawerPayload";
import { isInteractiveTarget } from "./workspaceShell.canvas";
import {
  extractInlineKeywords,
  normalizeInlineObjectMentions,
  removeAdjacentInlineToken,
  removeInlineSelectionWithTokenBoundaries,
  renderTextWithObjectMentions
} from "./workspaceShell.inlineEditor";
import type {
  NodeResizeDirection,
  NodeSize,
  ObjectMentionQuery
} from "./workspaceShell.types";

type MenuPosition = {
  left: number;
  top: number;
} | null;

type ObjectMentionSuggestion = {
  id: string;
  name: string;
};

type CanvasNodeCardProps = {
  activeKeywords: string[];
  activeObjectMentionIndex: number;
  aiPanelNodeId: string | null;
  applyObjectMentionSelection: (objectName: string, withTrailingSpace?: boolean) => void;
  beginNodeDrag: (
    nodeId: string,
    level: StoryNode["level"],
    event: ReactPointerEvent<HTMLElement>
  ) => void;
  beginNodeResize: (
    nodeId: string,
    direction: NodeResizeDirection,
    event: ReactPointerEvent<HTMLButtonElement>
  ) => void;
  centerCanvasViewportOnNode: (nodeId: string) => void;
  displayBodyText: string;
  displayedKeywordSuggestions: KeywordSuggestion[];
  displayText: string;
  getViewportMenuPosition: (
    rect: DOMRect,
    direction?: "adjacent-inline" | "right-start"
  ) => {
    left: number;
    top: number;
  };
  hasVisibleKeywords: boolean;
  inlineNodeTextDraft: string;
  isBusy: boolean;
  isDragging: boolean;
  isEndMajorNode: boolean;
  isHoveredRewireTarget: boolean;
  isLoadingKeywords: boolean;
  isNodeMoreMenuOpen: boolean;
  isRewireSource: boolean;
  isRewireTarget: boolean;
  isSelected: boolean;
  isStartMajorNode: boolean;
  node: StoryNode;
  nodeCardRefs: MutableRefObject<Map<string, HTMLElement>>;
  nodeMenuButtonRefs: MutableRefObject<Map<string, HTMLButtonElement>>;
  nodeSize: NodeSize;
  objectMentionQuery: ObjectMentionQuery | null;
  objectMentionSuggestions: ObjectMentionSuggestion[];
  onRewireNode: (sourceNodeId: string, targetNodeId: string) => Promise<void>;
  openKeywordSuggestions: (node: StoryNode, options?: { refresh?: boolean }) => Promise<void>;
  persistInlineNodeContent: (
    node: StoryNode,
    nextText: string,
    nextKeywords: string[]
  ) => Promise<void>;
  placement: {
    x: number;
    y: number;
  };
  recommendationError: string | null;
  rewireNode: StoryNode | null;
  selectedAiKeywords: string[];
  selectedNodeInputRef: MutableRefObject<HTMLTextAreaElement | null>;
  selectedNodeTitle: string;
  setActiveObjectMentionIndex: Dispatch<SetStateAction<number>>;
  setAiPanelNodeId: Dispatch<SetStateAction<string | null>>;
  setInlineNodeTextDraft: Dispatch<SetStateAction<string>>;
  setIsNodeMoreMenuOpen: Dispatch<SetStateAction<boolean>>;
  setNodeMenuPosition: Dispatch<SetStateAction<MenuPosition>>;
  setObjectMentionMenuPosition: Dispatch<SetStateAction<MenuPosition>>;
  setObjectMentionQuery: Dispatch<SetStateAction<ObjectMentionQuery | null>>;
  setRecommendationError: Dispatch<SetStateAction<string | null>>;
  setRewireHoverTargetId: Dispatch<SetStateAction<string | null>>;
  setRewireNodeId: Dispatch<SetStateAction<string | null>>;
  setRewirePreviewPoint: Dispatch<SetStateAction<{ x: number; y: number } | null>>;
  setSelectedAiKeywords: Dispatch<SetStateAction<string[]>>;
  setSelectedNodeId: Dispatch<SetStateAction<string | null>>;
  shouldFocusSelectedNodeRef: MutableRefObject<boolean>;
  shouldShowPlaceholder: boolean;
  suppressNodeClickRef: MutableRefObject<string | null>;
  syncInlineObjectMentions: (nodeId: string, rawText: string) => void;
  syncSelectedNodeInputHeight: (
    nodeId: string,
    input: HTMLTextAreaElement | null,
    options?: {
      preserveManualHeight?: boolean;
    }
  ) => void;
  toggleAiKeyword: (node: StoryNode, keyword: string) => Promise<void>;
  toggleNodeCollapsed: (nodeId: string, nextCollapsed: boolean) => Promise<void>;
  updateObjectMentionQueryFromInput: (input: HTMLTextAreaElement, value?: string) => void;
};

// 이 컴포넌트는 단일 캔버스 노드 카드와 편집 상호작용을 렌더링합니다.
export function CanvasNodeCard({
  activeKeywords,
  activeObjectMentionIndex,
  aiPanelNodeId,
  applyObjectMentionSelection,
  beginNodeDrag,
  beginNodeResize,
  centerCanvasViewportOnNode,
  displayBodyText,
  displayedKeywordSuggestions,
  displayText,
  getViewportMenuPosition,
  hasVisibleKeywords,
  inlineNodeTextDraft,
  isBusy,
  isDragging,
  isEndMajorNode,
  isHoveredRewireTarget,
  isLoadingKeywords,
  isNodeMoreMenuOpen,
  isRewireSource,
  isRewireTarget,
  isSelected,
  isStartMajorNode,
  node,
  nodeCardRefs,
  nodeMenuButtonRefs,
  nodeSize,
  objectMentionQuery,
  objectMentionSuggestions,
  onRewireNode,
  openKeywordSuggestions,
  persistInlineNodeContent,
  placement,
  recommendationError,
  rewireNode,
  selectedAiKeywords,
  selectedNodeInputRef,
  selectedNodeTitle,
  setActiveObjectMentionIndex,
  setAiPanelNodeId,
  setInlineNodeTextDraft,
  setIsNodeMoreMenuOpen,
  setNodeMenuPosition,
  setObjectMentionMenuPosition,
  setObjectMentionQuery,
  setRecommendationError,
  setRewireHoverTargetId,
  setRewireNodeId,
  setRewirePreviewPoint,
  setSelectedAiKeywords,
  setSelectedNodeId,
  shouldFocusSelectedNodeRef,
  shouldShowPlaceholder,
  suppressNodeClickRef,
  syncInlineObjectMentions,
  syncSelectedNodeInputHeight,
  toggleAiKeyword,
  toggleNodeCollapsed,
  updateObjectMentionQueryFromInput
}: CanvasNodeCardProps) {
  return (
    <article
      className={`node-card node-card-level-${node.level} node-card-${node.contentMode}${isSelected ? " is-selected" : ""}${isDragging ? " is-dragging" : ""}${isRewireSource ? " is-rewire-source" : ""}${isRewireTarget ? " is-rewire-target" : ""}${isHoveredRewireTarget ? " is-rewire-hover-target" : ""}${node.isImportant ? " is-important" : ""}${node.isFixed ? " is-fixed" : ""}${node.isCollapsed ? " is-collapsed" : ""}${isStartMajorNode ? " is-start-node" : ""}${isEndMajorNode ? " is-end-node" : ""}${aiPanelNodeId === node.id ? " has-keyword-cloud" : ""}`}
      data-testid={`node-${node.id}`}
      draggable={false}
      onClick={() => {
        if (suppressNodeClickRef.current === node.id) {
          suppressNodeClickRef.current = null;
          return;
        }

        if (isRewireTarget && rewireNode) {
          void onRewireNode(rewireNode.id, node.id);
          setSelectedNodeId(rewireNode.id);
          setRewireNodeId(null);
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
      style={
        {
          left: `${placement.x}px`,
          top: `${placement.y}px`,
          height: `${nodeSize.height}px`,
          width: `${nodeSize.width}px`
        } as CSSProperties
      }
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
              void toggleNodeCollapsed(node.id, !(node.isCollapsed ?? false));
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
                        ? removeAdjacentInlineToken(
                            inlineNodeTextDraft,
                            selectionStart,
                            "backward"
                          )
                        : event.key === "Delete"
                          ? removeAdjacentInlineToken(
                              inlineNodeTextDraft,
                              selectionStart,
                              "forward"
                            )
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

      {aiPanelNodeId === node.id ? (
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
}
