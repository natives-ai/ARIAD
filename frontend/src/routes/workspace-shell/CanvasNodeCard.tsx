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
  expandSelectionToObjectTokenBoundaries,
  getObjectTokenDeleteSelection,
  getSnappedObjectTokenCaret,
  hasObjectTokenInternalMutation,
  keywordCloudSlotCount,
  normalizeInlineObjectMentions,
  removeAdjacentKeywordTokenAtBoundary,
  removeSelectedObjectToken,
  renderTextWithObjectMentions,
  type ObjectMentionCreateCandidate
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
  objectMentionCreateCandidate: ObjectMentionCreateCandidate | null;
  objectMentionQuery: ObjectMentionQuery | null;
  objectMentionSuggestions: ObjectMentionSuggestion[];
  onBeforeSelectNode: (nextNodeId: string | null) => void;
  onClearRewireHoverTarget: () => void;
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
  objectMentionCreateCandidate,
  objectMentionQuery,
  objectMentionSuggestions,
  onBeforeSelectNode,
  onClearRewireHoverTarget,
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
  const keywordCloudEmptySlotCount = Math.max(
    0,
    keywordCloudSlotCount - displayedKeywordSuggestions.length
  );
  const isReadOnlySelectedNode = isSelected && node.isFixed;
  const resolvedShouldShowPlaceholder =
    shouldShowPlaceholder || (isReadOnlySelectedNode && !displayBodyText && !hasVisibleKeywords);
  const objectMentionOptionCount =
    objectMentionSuggestions.length + (objectMentionCreateCandidate ? 1 : 0);

  // 오브젝트 토큰 내부 커서를 토큰 경계로 이동합니다.
  function snapObjectTokenCaret(
    input: HTMLTextAreaElement,
    direction: "backward" | "forward" | "nearest" = "nearest"
  ) {
    const selectionStart = input.selectionStart ?? 0;
    const selectionEnd = input.selectionEnd ?? selectionStart;

    if (selectionStart !== selectionEnd) {
      const expandedSelection = expandSelectionToObjectTokenBoundaries(
        inlineNodeTextDraft,
        selectionStart,
        selectionEnd
      );

      if (expandedSelection) {
        input.setSelectionRange(
          expandedSelection.selectionStart,
          expandedSelection.selectionEnd
        );
      }

      return;
    }

    const snappedCaret = getSnappedObjectTokenCaret(
      inlineNodeTextDraft,
      selectionStart,
      direction
    );

    if (snappedCaret === null || snappedCaret === selectionStart) {
      return;
    }

    input.setSelectionRange(snappedCaret, snappedCaret);
  }

  return (
    <article
      className={`node-card node-card-level-${node.level} node-card-${node.contentMode}${isSelected ? " is-selected" : ""}${isDragging ? " is-dragging" : ""}${isRewireSource ? " is-rewire-source" : ""}${isRewireTarget ? " is-rewire-target" : ""}${isHoveredRewireTarget ? " is-rewire-hover-target" : ""}${node.isImportant ? " is-important" : ""}${node.isFixed ? " is-fixed" : ""}${node.isCollapsed ? " is-collapsed" : ""}${isStartMajorNode ? " is-start-node" : ""}${isEndMajorNode ? " is-end-node" : ""}${aiPanelNodeId === node.id && !node.isFixed ? " has-keyword-cloud" : ""}`}
      data-testid={`node-${node.id}`}
      draggable={false}
      onClick={() => {
        if (suppressNodeClickRef.current === node.id) {
          suppressNodeClickRef.current = null;
          return;
        }

        if (isRewireTarget && rewireNode) {
          void onRewireNode(rewireNode.id, node.id);
          onBeforeSelectNode(rewireNode.id);
          setSelectedNodeId(rewireNode.id);
          setRewireNodeId(null);
          onClearRewireHoverTarget();
          setRewireHoverTargetId(null);
          setRewirePreviewPoint(null);
          return;
        }

        shouldFocusSelectedNodeRef.current = true;
        onBeforeSelectNode(node.id);
        setSelectedNodeId(node.id);
      }}
      onDoubleClick={(event) => {
        if (isInteractiveTarget(event.target)) {
          return;
        }

        shouldFocusSelectedNodeRef.current = true;
        onBeforeSelectNode(node.id);
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
                onBeforeSelectNode(node.id);
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
        {isSelected && !node.isFixed ? (
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
                  const normalizedValue = normalizeInlineObjectMentions(event.target.value);
                  const nextValue = hasObjectTokenInternalMutation(
                    inlineNodeTextDraft,
                    normalizedValue
                  )
                    ? inlineNodeTextDraft
                    : normalizedValue;
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
                  snapObjectTokenCaret(event.currentTarget);
                  updateObjectMentionQueryFromInput(event.currentTarget);
                }}
                onKeyDown={(event) => {
                  const selectionStart = event.currentTarget.selectionStart ?? 0;
                  const selectionEnd = event.currentTarget.selectionEnd ?? 0;
                  const activeMentionSuggestion =
                    objectMentionSuggestions[activeObjectMentionIndex] ?? null;
                  const activeMentionCreateCandidate =
                    objectMentionCreateCandidate &&
                    activeObjectMentionIndex === objectMentionSuggestions.length
                      ? objectMentionCreateCandidate
                      : null;
                  const activeMentionName =
                    activeMentionSuggestion?.name ?? activeMentionCreateCandidate?.name ?? null;

                  if (event.key === "ArrowLeft" || event.key === "ArrowRight") {
                    window.requestAnimationFrame(() => {
                      if (!selectedNodeInputRef.current) {
                        return;
                      }

                      snapObjectTokenCaret(
                        selectedNodeInputRef.current,
                        event.key === "ArrowLeft" ? "backward" : "forward"
                      );
                      updateObjectMentionQueryFromInput(selectedNodeInputRef.current);
                    });
                  }

                  if (
                    selectionStart !== selectionEnd &&
                    (event.key === "Backspace" || event.key === "Delete")
                  ) {
                    const removableObjectToken = removeSelectedObjectToken(
                      inlineNodeTextDraft,
                      selectionStart,
                      selectionEnd
                    );

                    if (removableObjectToken) {
                      event.preventDefault();
                      setInlineNodeTextDraft(removableObjectToken.nextText);
                      setSelectedAiKeywords(extractInlineKeywords(removableObjectToken.nextText));
                      syncInlineObjectMentions(node.id, removableObjectToken.nextText);

                      window.requestAnimationFrame(() => {
                        selectedNodeInputRef.current?.focus();
                        selectedNodeInputRef.current?.setSelectionRange(
                          removableObjectToken.nextCaret,
                          removableObjectToken.nextCaret
                        );
                        syncSelectedNodeInputHeight(node.id, selectedNodeInputRef.current);
                      });
                      return;
                    }

                    const expandedObjectSelection = expandSelectionToObjectTokenBoundaries(
                      inlineNodeTextDraft,
                      selectionStart,
                      selectionEnd
                    );

                    if (expandedObjectSelection) {
                      event.preventDefault();
                      event.currentTarget.setSelectionRange(
                        expandedObjectSelection.selectionStart,
                        expandedObjectSelection.selectionEnd
                      );
                      return;
                    }
                  }

                  if (selectionStart === selectionEnd) {
                    const objectTokenDeleteSelection =
                      event.key === "Backspace"
                        ? getObjectTokenDeleteSelection(
                            inlineNodeTextDraft,
                            selectionStart,
                            "backward"
                          )
                        : event.key === "Delete"
                          ? getObjectTokenDeleteSelection(
                              inlineNodeTextDraft,
                              selectionStart,
                              "forward"
                            )
                          : null;

                    if (objectTokenDeleteSelection) {
                      event.preventDefault();
                      event.currentTarget.setSelectionRange(
                        objectTokenDeleteSelection.selectionStart,
                        objectTokenDeleteSelection.selectionEnd
                      );
                      return;
                    }

                    const removableKeywordToken =
                      event.key === "Backspace"
                        ? removeAdjacentKeywordTokenAtBoundary(
                            inlineNodeTextDraft,
                            selectionStart,
                            "backward"
                          )
                        : event.key === "Delete"
                          ? removeAdjacentKeywordTokenAtBoundary(
                              inlineNodeTextDraft,
                              selectionStart,
                              "forward"
                            )
                          : null;

                    if (removableKeywordToken) {
                      event.preventDefault();
                      setInlineNodeTextDraft(removableKeywordToken.nextText);
                      setSelectedAiKeywords(extractInlineKeywords(removableKeywordToken.nextText));
                      syncInlineObjectMentions(node.id, removableKeywordToken.nextText);

                      window.requestAnimationFrame(() => {
                        selectedNodeInputRef.current?.focus();
                        selectedNodeInputRef.current?.setSelectionRange(
                          removableKeywordToken.nextCaret,
                          removableKeywordToken.nextCaret
                        );
                        syncSelectedNodeInputHeight(node.id, selectedNodeInputRef.current);
                      });
                      return;
                    }
                  }

                  if (
                    activeMentionName &&
                    (event.key === "Enter" || event.key === "Tab")
                  ) {
                    event.preventDefault();
                    applyObjectMentionSelection(activeMentionName);
                    return;
                  }

                  if (objectMentionOptionCount > 0 && event.key === "ArrowDown") {
                    event.preventDefault();
                    setActiveObjectMentionIndex((current) =>
                      Math.min(current + 1, objectMentionOptionCount - 1)
                    );
                    return;
                  }

                  if (objectMentionOptionCount > 0 && event.key === "ArrowUp") {
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
                onBeforeInput={(event) => {
                  const selectionStart = event.currentTarget.selectionStart ?? 0;
                  const selectionEnd = event.currentTarget.selectionEnd ?? selectionStart;
                  const expandedObjectSelection = expandSelectionToObjectTokenBoundaries(
                    inlineNodeTextDraft,
                    selectionStart,
                    selectionEnd
                  );
                  const selectedObjectToken =
                    selectionStart !== selectionEnd &&
                    removeSelectedObjectToken(
                      inlineNodeTextDraft,
                      selectionStart,
                      selectionEnd
                    ) !== null;
                  const snappedCaret =
                    selectionStart === selectionEnd
                      ? getSnappedObjectTokenCaret(
                          inlineNodeTextDraft,
                          selectionStart,
                          "nearest"
                        )
                      : null;

                  if (
                    !selectedObjectToken &&
                    !expandedObjectSelection &&
                    snappedCaret === null
                  ) {
                    return;
                  }

                  event.preventDefault();

                  if (selectedObjectToken) {
                    return;
                  }

                  if (expandedObjectSelection) {
                    event.currentTarget.setSelectionRange(
                      expandedObjectSelection.selectionStart,
                      expandedObjectSelection.selectionEnd
                    );
                    return;
                  }

                  event.currentTarget.setSelectionRange(snappedCaret, snappedCaret);
                }}
                onKeyUp={(event) => {
                  snapObjectTokenCaret(event.currentTarget);
                  updateObjectMentionQueryFromInput(event.currentTarget);
                }}
                onPaste={(event) => {
                  const selectionStart = event.currentTarget.selectionStart ?? 0;
                  const selectionEnd = event.currentTarget.selectionEnd ?? selectionStart;
                  const expandedObjectSelection = expandSelectionToObjectTokenBoundaries(
                    inlineNodeTextDraft,
                    selectionStart,
                    selectionEnd
                  );
                  const selectedObjectToken =
                    selectionStart !== selectionEnd &&
                    removeSelectedObjectToken(
                      inlineNodeTextDraft,
                      selectionStart,
                      selectionEnd
                    ) !== null;
                  const snappedCaret =
                    selectionStart === selectionEnd
                      ? getSnappedObjectTokenCaret(
                          inlineNodeTextDraft,
                          selectionStart,
                          "nearest"
                        )
                      : null;

                  if (
                    !selectedObjectToken &&
                    !expandedObjectSelection &&
                    snappedCaret === null
                  ) {
                    return;
                  }

                  event.preventDefault();

                  if (expandedObjectSelection) {
                    event.currentTarget.setSelectionRange(
                      expandedObjectSelection.selectionStart,
                      expandedObjectSelection.selectionEnd
                    );
                    return;
                  }

                  if (snappedCaret !== null) {
                    event.currentTarget.setSelectionRange(snappedCaret, snappedCaret);
                  }
                }}
                onSelect={(event) => {
                  snapObjectTokenCaret(event.currentTarget);
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
        {resolvedShouldShowPlaceholder ? (
          <p className="node-simple-text is-placeholder">
            {isReadOnlySelectedNode ? "Type the beat" : displayText}
          </p>
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

      {aiPanelNodeId === node.id && !node.isFixed ? (
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

          <div
            className={`keyword-suggestion-grid${isLoadingKeywords ? " is-loading" : ""}`}
            data-testid="keyword-suggestion-grid"
          >
            {isLoadingKeywords
              ? Array.from({ length: keywordCloudSlotCount }).map((_, slotIndex) => (
                  <div
                    aria-hidden="true"
                    className="keyword-suggestion keyword-suggestion-skeleton"
                    data-testid={`keyword-suggestion-skeleton-${slotIndex}`}
                    key={`keyword-skeleton-${slotIndex}`}
                  >
                    <span />
                  </div>
                ))
              : (
                  <>
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
                    {Array.from({ length: keywordCloudEmptySlotCount }).map((_, slotIndex) => (
                      <div
                        aria-hidden="true"
                        className="keyword-suggestion keyword-suggestion-empty-slot"
                        key={`keyword-empty-${slotIndex}`}
                      />
                    ))}
                  </>
                )}
          </div>

          {!isLoadingKeywords && displayedKeywordSuggestions.length === 0 ? (
            <p className="support-copy">{copy.persistence.keywordCloudEmpty}</p>
          ) : null}
        </section>
      ) : null}
    </article>
  );
}
