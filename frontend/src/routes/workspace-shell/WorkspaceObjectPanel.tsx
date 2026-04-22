// 이 파일은 오브젝트 상세/생성 패널 렌더링을 담당합니다.
import type { StoryObject, StoryObjectCategory } from "@scenaairo/shared";

import { copy } from "../../copy";
import type { StoryObjectDraft } from "../../persistence/controller";
import { objectCategoryOptions } from "./workspaceShell.constants";
import { formatObjectCategory } from "./workspaceShell.common";
import type { DetailEditorMode } from "./workspaceShell.types";

type WorkspaceObjectPanelProps = {
  detailError: string | null;
  detailMode: DetailEditorMode | null;
  isCanvasFullscreen: boolean;
  objectEditorDraft: StoryObjectDraft;
  onClose: () => void;
  onDraftChange: (
    field: keyof StoryObjectDraft,
    value: StoryObjectDraft[keyof StoryObjectDraft]
  ) => void;
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
            <textarea
              onChange={(event) => {
                onDraftChange("summary", event.target.value);
              }}
              rows={4}
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
            <textarea
              onChange={(event) => {
                onDraftChange("summary", event.target.value);
              }}
              placeholder="Relationship pressure, location note, or prop detail."
              rows={4}
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
