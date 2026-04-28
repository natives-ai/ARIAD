// 이 파일은 워크스페이스 사이드바 상태 정리 함수를 검증합니다.
import type { StoryEpisode } from "@scenaairo/shared";
import { describe, expect, it } from "vitest";

import {
  sanitizeEpisodePinMap,
  sanitizeSidebarFolders
} from "./workspaceShell.sidebar";
import type { SidebarFolder } from "./workspaceShell.types";

// 테스트용 에피소드 객체를 생성합니다.
function createEpisode(id: string): StoryEpisode {
  return {
    createdAt: "2026-04-28T00:00:00.000Z",
    endpoint: "Endpoint",
    id,
    objective: "Objective",
    projectId: "project-1",
    title: id,
    updatedAt: "2026-04-28T00:00:00.000Z"
  };
}

// 테스트용 사이드바 폴더 객체를 생성합니다.
function createFolder(id: string, name: string, episodeIds: string[]): SidebarFolder {
  return {
    createdAt: "2026-04-28T00:00:00.000Z",
    episodeIds,
    id,
    isCollapsed: false,
    isPinned: false,
    name,
    updatedAt: "2026-04-28T00:00:00.000Z"
  };
}

describe("workspaceShell.sidebar sanitizeSidebarFolders", () => {
  it("drops restore-time folders that no longer contain valid episodes", () => {
    const episodes = [createEpisode("episode-a")];
    const folders = [
      createFolder("folder-stale", "Legacy Folder", ["missing-episode"]),
      createFolder("folder-valid", "Act One", ["episode-a"])
    ];

    expect(
      sanitizeSidebarFolders(folders, episodes, { dropEmptyFolders: true })
    ).toEqual([createFolder("folder-valid", "Act One", ["episode-a"])]);
  });

  it("keeps empty folders during live sanitization by default", () => {
    const folders = [
      createFolder("folder-empty", "Empty Drafts", []),
      createFolder("folder-stale", "Legacy Folder", ["missing-episode"])
    ];

    expect(sanitizeSidebarFolders(folders, [])).toEqual([
      createFolder("folder-empty", "Empty Drafts", []),
      createFolder("folder-stale", "Legacy Folder", [])
    ]);
  });
});

describe("workspaceShell.sidebar sanitizeEpisodePinMap", () => {
  it("removes pins that do not belong to current episodes", () => {
    expect(
      sanitizeEpisodePinMap(
        {
          folder: ["episode-a", "missing-episode"],
          stale: ["missing-episode"]
        },
        [createEpisode("episode-a")]
      )
    ).toEqual({
      folder: ["episode-a"]
    });
  });
});
