// 이 파일은 오브젝트 상세/생성 패널 렌더링을 담당합니다.
import type { ClipboardEvent } from "react";
import type { StoryObject, StoryObjectCategory } from "@scenaairo/shared";

import { copy } from "../../copy";
import type { StoryObjectDraft } from "../../persistence/controller";
import { objectCategoryOptions } from "./workspaceShell.constants";
import { formatObjectCategory } from "./workspaceShell.common";
import type { DetailEditorMode } from "./workspaceShell.types";

type ObjectDraftChangeHandler = (
  field: keyof StoryObjectDraft,
  value: StoryObjectDraft[keyof StoryObjectDraft]
) => void;

// 오브젝트 설명 입력을 한 줄 문자열로 정리합니다.
function normalizeObjectSummaryLine(value: string) {
  return value.replace(/\s*\r?\n+\s*/g, " ");
}

// 붙여넣기 텍스트를 현재 선택 영역에 삽입합니다.
function buildObjectSummaryPasteValue(input: HTMLInputElement, pastedText: string) {
  const selectionStart = input.selectionStart ?? input.value.length;
  const selectionEnd = input.selectionEnd ?? selectionStart;

  return normalizeObjectSummaryLine(
    `${input.value.slice(0, selectionStart)}${pastedText}${input.value.slice(selectionEnd)}`
  );
}

// 오브젝트 설명 붙여넣기를 한 줄 값으로 저장합니다.
function handleObjectSummaryPaste(
  event: ClipboardEvent<HTMLInputElement>,
  onDraftChange: ObjectDraftChangeHandler
) {
  event.preventDefault();
  onDraftChange(
    "summary",
    buildObjectSummaryPasteValue(event.currentTarget, event.clipboardData.getData("text"))
  );
}

type WorkspaceObjectPanelProps = {
  detailError: string | null;
  detailMode: DetailEditorMode | null;
  isCanvasFullscreen: boolean;
  objectEditorDraft: StoryObjectDraft;
  onClose: () => void;
  onDraftChange: ObjectDraftChangeHandler;
  onSave: () => void;
  selectedObject: StoryObject | null;
  selectedObjectEpisodeTitle: string | null;
  showSelectedObjectEpisode: boolean;
};

// 이 컴포넌트는 워크스페이스 우측 오브젝트 상세/생성 패널을 렌더링합니다.
export function WorkspaceObjectPanel({
  detailError,
  detailMode,
  isCanvasFullscreen,
  objectEditorDraft,
  onClose,
  onDraftChange,
  onSave,
  selectedObject,
  selectedObjectEpisodeTitle,
  showSelectedObjectEpisode
}: WorkspaceObjectPanelProps) {
  if (detailMode === null) {
    return null;
  }

  return (
    <aside className={`panel panel-details${isCanvasFullscreen ? " panel-details-floating" : ""}`}>
      <div className="detail-panel-header">
        <span className="visually-hidden">{copy.workspace.details}</span>
        <button
          aria-label={copy.persistence.closeDetails}
          className="button-secondary detail-close-button"
          onClick={onClose}
          type="button"
        >
          x
        </button>
      </div>

      {detailError ? <p className="recommendation-error">{detailError}</p> : null}

      {detailMode === "object" && selectedObject ? (
        <form
          className="detail-editor"
          data-testid="detail-editor"
          onSubmit={(event) => {
            event.preventDefault();
            onSave();
          }}
        >
          {showSelectedObjectEpisode ? (
            <div className="field-stack">
              <span>{copy.workspace.objectEpisode}</span>
              <span>{selectedObjectEpisodeTitle ?? copy.workspace.objectEpisodeMissing}</span>
            </div>
          ) : null}
          <label className="field-stack">
            <span>{copy.workspace.objectName}</span>
            <input
              onChange={(event) => {
                onDraftChange("name", event.target.value);
              }}
              type="text"
              value={objectEditorDraft.name}
            />
          </label>
          <label className="field-stack">
            <span>{copy.workspace.objectCategory}</span>
            <select
              onChange={(event) => {
                onDraftChange("category", event.target.value as StoryObjectCategory);
              }}
              value={objectEditorDraft.category}
            >
              {objectCategoryOptions.map((category) => (
                <option key={category} value={category}>
                  {formatObjectCategory(category)}
                </option>
              ))}
            </select>
          </label>
          <label className="field-stack">
            <span>{copy.workspace.objectSummary}</span>
            <input
              onChange={(event) => {
                onDraftChange("summary", normalizeObjectSummaryLine(event.target.value));
              }}
              onPaste={(event) => {
                handleObjectSummaryPaste(event, onDraftChange);
              }}
              type="text"
              value={objectEditorDraft.summary}
            />
          </label>
          <div className="control-row">
            <button type="submit">{copy.persistence.saveObject}</button>
          </div>
        </form>
      ) : detailMode === "create-object" ? (
        <form
          className="detail-editor"
          data-testid="detail-editor"
          onSubmit={(event) => {
            event.preventDefault();
            onSave();
          }}
        >
          <label className="field-stack">
            <span>{copy.workspace.objectName}</span>
            <input
              onChange={(event) => {
                onDraftChange("name", event.target.value);
              }}
              placeholder="Heroine's Mother"
              type="text"
              value={objectEditorDraft.name}
            />
          </label>
          <label className="field-stack">
            <span>{copy.workspace.objectCategory}</span>
            <select
              onChange={(event) => {
                onDraftChange("category", event.target.value as StoryObjectCategory);
              }}
              value={objectEditorDraft.category}
            >
              {objectCategoryOptions.map((category) => (
                <option key={category} value={category}>
                  {formatObjectCategory(category)}
                </option>
              ))}
            </select>
          </label>
          <label className="field-stack">
            <span>{copy.workspace.objectSummary}</span>
            <input
              onChange={(event) => {
                onDraftChange("summary", normalizeObjectSummaryLine(event.target.value));
              }}
              onPaste={(event) => {
                handleObjectSummaryPaste(event, onDraftChange);
              }}
              placeholder="Relationship pressure, location note, or prop detail."
              type="text"
              value={objectEditorDraft.summary}
            />
          </label>
          <div className="control-row">
            <button type="submit">{copy.workspace.createObject}</button>
          </div>
        </form>
      ) : null}
    </aside>
  );
}
