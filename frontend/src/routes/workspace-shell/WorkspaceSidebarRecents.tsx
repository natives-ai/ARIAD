// 이 파일은 사이드바 최근 스토리/폴더 목록 섹션 렌더링을 담당합니다.
import {
  type CSSProperties,
  type ChangeEvent,
  type Dispatch,
  type MutableRefObject,
  type SetStateAction
} from "react";

import type { StoryEpisode } from "@scenaairo/shared";

import { copy } from "../../copy";
import { renderViewportOverlay } from "./workspaceShell.common";
import { SidebarItemIcon, getScopedPinnedEpisodes, sortEpisodesForScope, type VisibleSidebarFolder } from "./workspaceShell.sidebar";
import type { EpisodePinMap, SidebarFolder } from "./workspaceShell.types";

type MenuPosition = {
  left: number;
  top: number;
} | null;

type WorkspaceSidebarRecentsProps = {
  activeEpisodeId: string | null;
  activeFolderId: string | null;
  draggedSidebarEpisodeId: string | null;
  episodeMenuButtonRefs: MutableRefObject<Map<string, HTMLButtonElement>>;
  episodeMenuId: string | null;
  episodeMenuPosition: MenuPosition;
  episodeRenameDraft: string;
  folderEpisodePickerFolderId: string | null;
  folderEpisodePickerPosition: MenuPosition;
  folderEpisodePins: EpisodePinMap;
  folderIdByEpisodeId: Map<string, string>;
  folderMenuButtonRefs: MutableRefObject<Map<string, HTMLButtonElement>>;
  folderMenuId: string | null;
  folderMenuPosition: MenuPosition;
  folderPickerEpisodeId: string | null;
  folderRenameDraft: string;
  getViewportMenuPosition: (
    rect: DOMRect,
    direction?: "adjacent-inline" | "right-start"
  ) => {
    left: number;
    top: number;
  };
  onBeginEpisodeRename: (episode: StoryEpisode) => void;
  onBeginFolderRename: (folder: SidebarFolder) => void;
  onDeleteFolder: (folderId: string) => Promise<void>;
  onDissolveEpisodeFromFolder: (episodeId: string) => Promise<void>;
  onReorderEpisodeWithinFolder: (
    folderId: string,
    draggedEpisodeId: string,
    targetEpisodeId: string
  ) => void;
  onSelectEpisodeFromSidebar: (episodeId: string) => Promise<void>;
  onSubmitEpisodeRename: () => Promise<void>;
  onSubmitFolderRename: (folderId: string) => void;
  onToggleEpisodeInFolderPicker: (folderId: string, episodeId: string) => Promise<void>;
  onToggleEpisodePin: (episodeId: string) => void;
  onToggleFolderCollapsed: (folderId: string) => void;
  onToggleFolderPin: (folderId: string) => void;
  onToggleFolderSort: (folderId: string) => void;
  renamingEpisodeId: string | null;
  renamingFolderId: string | null;
  rootEpisodes: StoryEpisode[];
  rootFolderScopeId: string;
  setDeleteEpisodeId: Dispatch<SetStateAction<string | null>>;
  setDraggedSidebarEpisodeId: Dispatch<SetStateAction<string | null>>;
  setEpisodeMenuId: Dispatch<SetStateAction<string | null>>;
  setEpisodeMenuPosition: Dispatch<SetStateAction<MenuPosition>>;
  setEpisodeRenameDraft: Dispatch<SetStateAction<string>>;
  setFolderEpisodePickerFolderId: Dispatch<SetStateAction<string | null>>;
  setFolderEpisodePickerPosition: Dispatch<SetStateAction<MenuPosition>>;
  setFolderMenuId: Dispatch<SetStateAction<string | null>>;
  setFolderMenuPosition: Dispatch<SetStateAction<MenuPosition>>;
  setFolderPickerEpisodeId: Dispatch<SetStateAction<string | null>>;
  setFolderPickerPosition: Dispatch<SetStateAction<MenuPosition>>;
  setFolderRenameDraft: Dispatch<SetStateAction<string>>;
  setObjectMenuId: Dispatch<SetStateAction<string | null>>;
  setObjectMenuPosition: Dispatch<SetStateAction<MenuPosition>>;
  setRenamingEpisodeId: Dispatch<SetStateAction<string | null>>;
  setRenamingFolderId: Dispatch<SetStateAction<string | null>>;
  setSidebarFolders: Dispatch<SetStateAction<SidebarFolder[]>>;
  snapshotEpisodeCount: number;
  snapshotEpisodes: StoryEpisode[];
  sortingFolderId: string | null;
  visibleFolders: VisibleSidebarFolder[];
};

// 이 함수는 사이드바 에피소드 항목을 렌더링합니다.
function renderEpisodeItem(
  episode: StoryEpisode,
  scopeId: string,
  props: WorkspaceSidebarRecentsProps
) {
  const {
    activeEpisodeId,
    draggedSidebarEpisodeId,
    episodeMenuButtonRefs,
    episodeMenuId,
    episodeMenuPosition,
    episodeRenameDraft,
    folderIdByEpisodeId,
    folderEpisodePins,
    getViewportMenuPosition,
    onBeginEpisodeRename,
    onDissolveEpisodeFromFolder,
    onReorderEpisodeWithinFolder,
    onSelectEpisodeFromSidebar,
    onSubmitEpisodeRename,
    onToggleEpisodePin,
    renamingEpisodeId,
    setDeleteEpisodeId,
    setDraggedSidebarEpisodeId,
    setEpisodeMenuId,
    setEpisodeMenuPosition,
    setEpisodeRenameDraft,
    setFolderEpisodePickerFolderId,
    setFolderEpisodePickerPosition,
    setFolderMenuId,
    setFolderMenuPosition,
    setFolderPickerEpisodeId,
    setFolderPickerPosition,
    setRenamingEpisodeId,
    snapshotEpisodeCount,
    sortingFolderId
  } = props;
  const isActive = episode.id === activeEpisodeId;
  const isPinned = getScopedPinnedEpisodes(folderEpisodePins, scopeId).includes(episode.id);
  const isRenaming = renamingEpisodeId === episode.id;
  const currentFolderId = folderIdByEpisodeId.get(episode.id) ?? null;
  const isSortable = sortingFolderId !== null && sortingFolderId === currentFolderId;

  return (
    <li
      className={`sidebar-episode-item${isActive ? " is-active" : ""}${isSortable ? " is-sortable" : ""}`}
      draggable={isSortable}
      key={episode.id}
      onDragEnd={() => {
        setDraggedSidebarEpisodeId(null);
      }}
      onDragOver={(event) => {
        if (!isSortable || !draggedSidebarEpisodeId || draggedSidebarEpisodeId === episode.id) {
          return;
        }

        event.preventDefault();
      }}
      onDragStart={() => {
        if (!isSortable) {
          return;
        }

        setDraggedSidebarEpisodeId(episode.id);
      }}
      onDrop={(event) => {
        if (!isSortable || !draggedSidebarEpisodeId || !currentFolderId) {
          return;
        }

        event.preventDefault();
        onReorderEpisodeWithinFolder(currentFolderId, draggedSidebarEpisodeId, episode.id);
        setDraggedSidebarEpisodeId(null);
      }}
    >
      {isRenaming ? (
        <form
          className="sidebar-episode-rename"
          onSubmit={(event) => {
            event.preventDefault();
            void onSubmitEpisodeRename();
          }}
        >
          <input
            onChange={(event: ChangeEvent<HTMLInputElement>) => {
              setEpisodeRenameDraft(event.target.value);
            }}
            type="text"
            value={episodeRenameDraft}
          />
          <div className="control-row">
            <button type="submit">{copy.persistence.saveEpisode}</button>
            <button
              className="button-secondary"
              onClick={() => {
                setRenamingEpisodeId(null);
                setEpisodeRenameDraft("");
              }}
              type="button"
            >
              {copy.persistence.cancel}
            </button>
          </div>
        </form>
      ) : (
        <div className={`sidebar-story-shell${isActive ? " is-active" : ""}`}>
          <button
            className={`sidebar-episode-link${isActive ? " is-active" : ""}`}
            onClick={() => {
              void onSelectEpisodeFromSidebar(episode.id);
            }}
            type="button"
          >
            <span className="sidebar-episode-title-row">
              <SidebarItemIcon kind="episode" />
              <strong>{episode.title}</strong>
            </span>
          </button>
          <div className="sidebar-episode-actions">
            <button
              aria-label={`${isPinned ? copy.persistence.unpinEpisode : copy.persistence.pinEpisode} ${episode.title}`}
              className="button-secondary sidebar-inline-pin-button"
              onClick={() => {
                onToggleEpisodePin(episode.id);
              }}
              type="button"
            >
              {isPinned ? copy.persistence.unpinEpisode : copy.persistence.pinEpisode}
            </button>
            <button
              aria-label={`${copy.workspace.utilities} ${episode.title}`}
              className="button-secondary sidebar-episode-menu-button"
              onClick={(event) => {
                const rect = event.currentTarget.getBoundingClientRect();
                setFolderMenuId(null);
                setFolderMenuPosition(null);
                setFolderEpisodePickerFolderId(null);
                setFolderEpisodePickerPosition(null);
                setFolderPickerEpisodeId(null);
                setFolderPickerPosition(null);
                setEpisodeMenuId((current) => {
                  const nextId = current === episode.id ? null : episode.id;
                  setEpisodeMenuPosition(
                    nextId ? getViewportMenuPosition(rect) : null
                  );
                  return nextId;
                });
              }}
              ref={(element) => {
                if (element) {
                  episodeMenuButtonRefs.current.set(episode.id, element);
                } else {
                  episodeMenuButtonRefs.current.delete(episode.id);
                }
              }}
              type="button"
            >
              ...
            </button>
            {episodeMenuId === episode.id
              ? renderViewportOverlay(
                  <div
                    className="sidebar-episode-menu sidebar-episode-menu-overlay"
                    style={
                      episodeMenuPosition
                        ? ({
                            left: `${episodeMenuPosition.left}px`,
                            top: `${episodeMenuPosition.top}px`
                          } as CSSProperties)
                        : undefined
                    }
                  >
                    <button
                      className="button-secondary"
                      onClick={() => {
                        onBeginEpisodeRename(episode);
                      }}
                      type="button"
                    >
                      {copy.persistence.renameEpisode}
                    </button>
                    {currentFolderId ? (
                      <button
                        className="button-secondary"
                        onClick={() => {
                          void onDissolveEpisodeFromFolder(episode.id);
                        }}
                        type="button"
                      >
                        {copy.persistence.dissolveEpisode}
                      </button>
                    ) : (
                      <button
                        className="button-secondary"
                        onClick={(event) => {
                          const rect = event.currentTarget.getBoundingClientRect();
                          setFolderPickerEpisodeId((current) => {
                            const nextId = current === episode.id ? null : episode.id;
                            setFolderPickerPosition(
                              nextId ? getViewportMenuPosition(rect, "right-start") : null
                            );
                            return nextId;
                          });
                        }}
                        type="button"
                      >
                        {copy.persistence.addToFolder}
                      </button>
                    )}
                    <button
                      className="button-secondary"
                      disabled={snapshotEpisodeCount <= 1}
                      onClick={() => {
                        setDeleteEpisodeId(episode.id);
                        setEpisodeMenuId(null);
                        setEpisodeMenuPosition(null);
                        setFolderPickerEpisodeId(null);
                      }}
                      type="button"
                    >
                      {copy.persistence.delete}
                    </button>
                  </div>
                )
              : null}
          </div>
        </div>
      )}
    </li>
  );
}

// 이 함수는 사이드바 폴더 항목을 렌더링합니다.
function renderFolderItem(folder: VisibleSidebarFolder, props: WorkspaceSidebarRecentsProps) {
  const {
    activeFolderId,
    folderEpisodePickerFolderId,
    folderEpisodePickerPosition,
    folderEpisodePins,
    folderMenuButtonRefs,
    folderMenuId,
    folderMenuPosition,
    folderRenameDraft,
    getViewportMenuPosition,
    onBeginFolderRename,
    onDeleteFolder,
    onSubmitFolderRename,
    onToggleEpisodeInFolderPicker,
    onToggleFolderCollapsed,
    onToggleFolderPin,
    onToggleFolderSort,
    renamingFolderId,
    rootFolderScopeId,
    setEpisodeMenuId,
    setEpisodeMenuPosition,
    setFolderEpisodePickerFolderId,
    setFolderEpisodePickerPosition,
    setFolderMenuId,
    setFolderMenuPosition,
    setFolderPickerEpisodeId,
    setFolderPickerPosition,
    setFolderRenameDraft,
    setObjectMenuId,
    setObjectMenuPosition,
    setRenamingFolderId,
    setSidebarFolders,
    snapshotEpisodes,
    sortingFolderId
  } = props;
  const isRenaming = renamingFolderId === folder.id;
  const isSorting = sortingFolderId === folder.id;
  const isActive = activeFolderId === folder.id;

  return (
    <li className={`sidebar-folder-item${isActive ? " is-active" : ""}`} key={folder.id}>
      {isRenaming ? (
        <form
          className="sidebar-episode-rename"
          onSubmit={(event) => {
            event.preventDefault();
            onSubmitFolderRename(folder.id);
          }}
        >
          <input
            onChange={(event: ChangeEvent<HTMLInputElement>) => {
              setFolderRenameDraft(event.target.value);
            }}
            type="text"
            value={folderRenameDraft}
          />
          <div className="control-row">
            <button type="submit">{copy.persistence.saveEpisode}</button>
            <button
              className="button-secondary"
              onClick={() => {
                setRenamingFolderId(null);
                setFolderRenameDraft("");
              }}
              type="button"
            >
              {copy.persistence.cancel}
            </button>
          </div>
        </form>
      ) : (
        <div className={`sidebar-folder-card${isActive ? " is-active" : ""}`}>
          <button
            className={`sidebar-folder-button${isActive ? " is-active" : ""}`}
            onClick={() => {
              setSidebarFolders((current) =>
                current.map((entry) =>
                  entry.id === folder.id
                    ? { ...entry, isCollapsed: !entry.isCollapsed }
                    : entry
                )
              );
            }}
            type="button"
          >
            <span className="sidebar-folder-copy">
              <SidebarItemIcon kind="folder" />
              <strong>{folder.name}</strong>
            </span>
          </button>
          <div className="sidebar-folder-actions">
            <button
              aria-label={`${folder.isPinned ? copy.persistence.unpinEpisode : copy.persistence.pinEpisode} ${folder.name}`}
              className="button-secondary sidebar-inline-pin-button"
              onClick={() => {
                onToggleFolderPin(folder.id);
              }}
              type="button"
            >
              {folder.isPinned ? copy.persistence.unpinEpisode : copy.persistence.pinEpisode}
            </button>
            <button
              aria-label={`${copy.workspace.utilities} ${folder.name}`}
              className="button-secondary sidebar-episode-menu-button"
              onClick={(event) => {
                const rect = event.currentTarget.getBoundingClientRect();
                setEpisodeMenuId(null);
                setEpisodeMenuPosition(null);
                setFolderMenuId((current) => {
                  const nextId = current === folder.id ? null : folder.id;
                  setFolderMenuPosition(nextId ? getViewportMenuPosition(rect) : null);
                  setFolderEpisodePickerFolderId(null);
                  setFolderEpisodePickerPosition(null);
                  return nextId;
                });
                setFolderPickerPosition(null);
                setFolderPickerEpisodeId(null);
                setObjectMenuId(null);
                setObjectMenuPosition(null);
              }}
              ref={(element) => {
                if (element) {
                  folderMenuButtonRefs.current.set(folder.id, element);
                } else {
                  folderMenuButtonRefs.current.delete(folder.id);
                }
              }}
              type="button"
            >
              ...
            </button>
          </div>
          {folderMenuId === folder.id
            ? renderViewportOverlay(
                <div
                  className="sidebar-folder-menu-overlay sidebar-episode-menu"
                  style={
                    folderMenuPosition
                      ? ({
                          left: `${folderMenuPosition.left}px`,
                          top: `${folderMenuPosition.top}px`
                        } as CSSProperties)
                      : undefined
                  }
                >
                  <button
                    className="button-secondary"
                    onClick={() => {
                      onBeginFolderRename(folder);
                    }}
                    type="button"
                  >
                    {copy.persistence.renameEpisode}
                  </button>
                  <button
                    className="button-secondary"
                    onClick={() => {
                      onToggleFolderCollapsed(folder.id);
                    }}
                    type="button"
                  >
                    {folder.isCollapsed ? copy.persistence.unfold : copy.persistence.fold}
                  </button>
                  <button
                    className="button-secondary"
                    onClick={(event) => {
                      const rect = event.currentTarget.getBoundingClientRect();
                      setFolderEpisodePickerFolderId((current) => {
                        const nextId = current === folder.id ? null : folder.id;
                        setFolderEpisodePickerPosition(
                          nextId ? getViewportMenuPosition(rect, "right-start") : null
                        );
                        return nextId;
                      });
                    }}
                    type="button"
                  >
                    {copy.persistence.addEpisodes}
                  </button>
                  <button
                    className="button-secondary"
                    onClick={() => {
                      onToggleFolderSort(folder.id);
                    }}
                    type="button"
                  >
                    {isSorting ? copy.persistence.cancel : copy.persistence.sortStories}
                  </button>
                  <button
                    className="button-secondary"
                    onClick={() => {
                      void onDeleteFolder(folder.id);
                    }}
                    type="button"
                  >
                    {copy.persistence.delete}
                  </button>
                </div>
              )
            : null}
          {folderEpisodePickerFolderId === folder.id && folderEpisodePickerPosition
            ? renderViewportOverlay(
                <div
                  className="sidebar-folder-picker sidebar-folder-picker-popout"
                  style={
                    {
                      left: `${folderEpisodePickerPosition.left}px`,
                      top: `${folderEpisodePickerPosition.top}px`
                    } as CSSProperties
                  }
                >
                  {sortEpisodesForScope(
                    snapshotEpisodes,
                    rootFolderScopeId,
                    folderEpisodePins
                  ).map((episodeOption) => {
                    const isInFolder = folder.episodeIds.includes(episodeOption.id);

                    return (
                      <button
                        className={`button-secondary sidebar-picker-option${
                          isInFolder ? " is-selected" : ""
                        }`}
                        key={`${folder.id}-${episodeOption.id}`}
                        onClick={() => {
                          void onToggleEpisodeInFolderPicker(folder.id, episodeOption.id);
                        }}
                        type="button"
                      >
                        <span className="sidebar-picker-option-prefix">
                          {isInFolder ? "-" : "+"}
                        </span>
                        <span className="sidebar-picker-option-label">
                          {episodeOption.title}
                        </span>
                      </button>
                    );
                  })}
                </div>
              )
            : null}
        </div>
      )}
      {!folder.isCollapsed && folder.visibleEpisodes.length > 0 ? (
        <ul className="sidebar-folder-episode-list">
          {folder.visibleEpisodes.map((episode) =>
            renderEpisodeItem(episode, folder.id, props)
          )}
        </ul>
      ) : null}
    </li>
  );
}

// 이 컴포넌트는 사이드바의 최근 스토리/폴더 목록 섹션을 렌더링합니다.
export function WorkspaceSidebarRecents(props: WorkspaceSidebarRecentsProps) {
  const { rootEpisodes, rootFolderScopeId, visibleFolders } = props;

  return (
    <section className="sidebar-section sidebar-recents-section">
      <div className="sidebar-section-header">
        <strong>{copy.workspace.recentStories}</strong>
      </div>

      <div className="sidebar-recents-scroll">
        {visibleFolders.length > 0 || rootEpisodes.length > 0 ? (
          <>
            {visibleFolders.length > 0 ? (
              <ul className="sidebar-folder-list">
                {visibleFolders.map((folder) => renderFolderItem(folder, props))}
              </ul>
            ) : null}

            {rootEpisodes.length > 0 ? (
              <ul
                className={`sidebar-episode-list sidebar-root-episode-list${
                  visibleFolders.length > 0 ? " has-folders" : ""
                }`}
              >
                {rootEpisodes.map((episode) =>
                  renderEpisodeItem(episode, rootFolderScopeId, props)
                )}
              </ul>
            ) : null}
          </>
        ) : (
          <p className="support-copy">{copy.workspace.recentStoriesEmpty}</p>
        )}
      </div>
    </section>
  );
}
