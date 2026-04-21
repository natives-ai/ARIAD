// 이 파일은 WorkspaceShell 사이드바 전용 함수와 아이콘 컴포넌트를 제공합니다.
import type { StoryEpisode } from "@scenaairo/shared";

import type { EpisodePinMap, SidebarFolder } from "./workspaceShell.types";

export function parseStoredFolderList(value: string | null) {
  if (!value) {
    return [];
  }

  try {
    const parsed = JSON.parse(value) as unknown;

    if (!Array.isArray(parsed)) {
      return [];
    }

    return parsed
      .filter((entry): entry is SidebarFolder => {
        if (!entry || typeof entry !== "object") {
          return false;
        }

        const candidate = entry as Partial<SidebarFolder>;

        return (
          typeof candidate.id === "string" &&
          typeof candidate.name === "string" &&
          Array.isArray(candidate.episodeIds) &&
          typeof candidate.createdAt === "string" &&
          typeof candidate.updatedAt === "string"
        );
      })
      .map((folder) => ({
        ...folder,
        episodeIds: folder.episodeIds.filter((entry): entry is string => typeof entry === "string"),
        isCollapsed: folder.isCollapsed ?? false,
        isPinned: folder.isPinned ?? false
      }));
  } catch {
    return [];
  }
}

export function parseStoredEpisodePinMap(value: string | null) {
  if (!value) {
    return {} satisfies EpisodePinMap;
  }

  try {
    const parsed = JSON.parse(value) as unknown;

    if (!parsed || typeof parsed !== "object") {
      return {} satisfies EpisodePinMap;
    }

    return Object.fromEntries(
      Object.entries(parsed as Record<string, unknown>).map(([key, entry]) => [
        key,
        Array.isArray(entry)
          ? entry.filter((value): value is string => typeof value === "string")
          : []
      ])
    );
  } catch {
    return {} satisfies EpisodePinMap;
  }
}

export function sanitizeSidebarFolders(folders: SidebarFolder[], episodes: StoryEpisode[]) {
  const validEpisodeIds = new Set(episodes.map((episode) => episode.id));
  const seenEpisodeIds = new Set<string>();

  return folders.map((folder) => {
    const episodeIds = folder.episodeIds.filter((episodeId) => {
      if (!validEpisodeIds.has(episodeId) || seenEpisodeIds.has(episodeId)) {
        return false;
      }

      seenEpisodeIds.add(episodeId);
      return true;
    });

    return {
      ...folder,
      episodeIds
    };
  });
}

export function matchesEpisodeSearch(episode: StoryEpisode, query: string) {
  if (!query.trim()) {
    return true;
  }

  const normalizedQuery = query.trim().toLowerCase();

  return (
    episode.title.toLowerCase().includes(normalizedQuery) ||
    episode.objective.toLowerCase().includes(normalizedQuery) ||
    episode.endpoint.toLowerCase().includes(normalizedQuery)
  );
}

export function SidebarItemIcon({ kind }: { kind: "episode" | "folder" }) {
  return (
    <span
      aria-hidden="true"
      className={`sidebar-item-icon sidebar-item-icon-${kind}`}
    />
  );
}
