// 이 파일은 WorkspaceShell 사이드바 전용 함수와 아이콘 컴포넌트를 제공합니다.
import type { StoryEpisode } from "@scenaairo/shared";

import type { EpisodePinMap, SidebarFolder } from "./workspaceShell.types";

export type VisibleSidebarFolder = SidebarFolder & {
  visibleEpisodes: StoryEpisode[];
  visibleInSearch: boolean;
};

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

export type SidebarFolderSanitizeOptions = {
  dropEmptyFolders?: boolean;
};

// 이 함수는 현재 에피소드 목록에 맞게 사이드바 폴더를 정리합니다.
export function sanitizeSidebarFolders(
  folders: SidebarFolder[],
  episodes: StoryEpisode[],
  options: SidebarFolderSanitizeOptions = {}
) {
  const validEpisodeIds = new Set(episodes.map((episode) => episode.id));
  const seenEpisodeIds = new Set<string>();

  return folders.flatMap((folder) => {
    const episodeIds = folder.episodeIds.filter((episodeId) => {
      if (!validEpisodeIds.has(episodeId) || seenEpisodeIds.has(episodeId)) {
        return false;
      }

      seenEpisodeIds.add(episodeId);
      return true;
    });

    if (options.dropEmptyFolders && episodeIds.length === 0) {
      return [];
    }

    return [
      {
        ...folder,
        episodeIds
      }
    ];
  });
}

// 이 함수는 현재 에피소드 목록에 맞게 사이드바 고정 상태를 정리합니다.
export function sanitizeEpisodePinMap(pinMap: EpisodePinMap, episodes: StoryEpisode[]) {
  const validEpisodeIds = new Set(episodes.map((episode) => episode.id));
  const sanitizedEntries: Array<[string, string[]]> = [];

  for (const [scopeId, episodeIds] of Object.entries(pinMap)) {
    const validPinnedEpisodeIds = episodeIds.filter((episodeId) =>
      validEpisodeIds.has(episodeId)
    );

    if (validPinnedEpisodeIds.length > 0) {
      sanitizedEntries.push([scopeId, validPinnedEpisodeIds]);
    }
  }

  return Object.fromEntries(sanitizedEntries) satisfies EpisodePinMap;
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

// 이 함수는 에피소드별 소속 폴더 ID 맵을 생성합니다.
export function buildFolderIdByEpisodeId(folders: SidebarFolder[]) {
  const folderIdByEpisodeId = new Map<string, string>();

  for (const folder of folders) {
    for (const episodeId of folder.episodeIds) {
      folderIdByEpisodeId.set(episodeId, folder.id);
    }
  }

  return folderIdByEpisodeId;
}

// 이 함수는 특정 범위에서 고정된 에피소드 ID 목록을 반환합니다.
export function getScopedPinnedEpisodes(pinMap: EpisodePinMap, scopeId: string) {
  return pinMap[scopeId] ?? [];
}

// 이 함수는 범위별 고정 우선순위를 적용해 에피소드 목록을 정렬합니다.
export function sortEpisodesForScope(
  episodes: StoryEpisode[],
  scopeId: string,
  pinMap: EpisodePinMap
) {
  const pinnedIds = getScopedPinnedEpisodes(pinMap, scopeId);

  return [...episodes].sort((left, right) => {
    const leftPinned = pinnedIds.includes(left.id);
    const rightPinned = pinnedIds.includes(right.id);

    if (leftPinned !== rightPinned) {
      return leftPinned ? -1 : 1;
    }

    return right.updatedAt.localeCompare(left.updatedAt);
  });
}

// 이 함수는 폴더 내부 순서를 유지한 채 고정 우선순위를 적용합니다.
export function sortEpisodesForFolder(
  episodes: StoryEpisode[],
  scopeId: string,
  orderedEpisodeIds: string[],
  pinMap: EpisodePinMap
) {
  const pinnedIds = getScopedPinnedEpisodes(pinMap, scopeId);
  const orderIndexById = new Map(
    orderedEpisodeIds.map((episodeId, index) => [episodeId, index])
  );

  return [...episodes].sort((left, right) => {
    const leftPinned = pinnedIds.includes(left.id);
    const rightPinned = pinnedIds.includes(right.id);

    if (leftPinned !== rightPinned) {
      return leftPinned ? -1 : 1;
    }

    return (orderIndexById.get(left.id) ?? Number.MAX_SAFE_INTEGER) -
      (orderIndexById.get(right.id) ?? Number.MAX_SAFE_INTEGER);
  });
}

// 이 함수는 사이드바 루트/폴더 가시 목록을 한 번에 계산합니다.
export function buildSidebarEpisodeCollections(params: {
  episodes: StoryEpisode[];
  folders: SidebarFolder[];
  pinMap: EpisodePinMap;
  query: string;
  rootScopeId: string;
}) {
  const { episodes, folders, pinMap, query, rootScopeId } = params;
  const episodeSearchNormalized = query.trim().toLowerCase();
  const folderIdByEpisodeId = buildFolderIdByEpisodeId(folders);
  const rootEpisodes = sortEpisodesForScope(
    episodes.filter((episode) => !folderIdByEpisodeId.has(episode.id)),
    rootScopeId,
    pinMap
  ).filter((episode) => matchesEpisodeSearch(episode, query));
  const visibleFolders: VisibleSidebarFolder[] = folders
    .map((folder) => {
      const folderEpisodes = folder.episodeIds
        .map((episodeId) => episodes.find((episode) => episode.id === episodeId) ?? null)
        .filter((episode): episode is StoryEpisode => episode !== null);
      const folderMatches = episodeSearchNormalized
        ? folder.name.toLowerCase().includes(episodeSearchNormalized)
        : true;
      const filteredFolderEpisodes = folderMatches
        ? folderEpisodes
        : folderEpisodes.filter((episode) => matchesEpisodeSearch(episode, query));
      const visibleFolderEpisodes = sortEpisodesForFolder(
        filteredFolderEpisodes,
        folder.id,
        folder.episodeIds,
        pinMap
      );

      return {
        ...folder,
        visibleEpisodes: visibleFolderEpisodes,
        visibleInSearch:
          !episodeSearchNormalized || folderMatches || visibleFolderEpisodes.length > 0
      };
    })
    .filter((folder) => folder.visibleInSearch)
    .sort((left, right) => {
      if (left.isPinned !== right.isPinned) {
        return left.isPinned ? -1 : 1;
      }

      return right.updatedAt.localeCompare(left.updatedAt);
    });

  return {
    folderIdByEpisodeId,
    rootEpisodes,
    visibleFolders
  };
}

export function SidebarItemIcon({ kind }: { kind: "episode" | "folder" }) {
  return (
    <span
      aria-hidden="true"
      className={`sidebar-item-icon sidebar-item-icon-${kind}`}
    />
  );
}
