// 이 파일은 초기 로컬 워크스페이스 샘플 데이터를 생성합니다.
import type {
  StoryWorkspaceSnapshot,
  TemporaryDrawerItem
} from "@scenaairo/shared";
import type { PersistedEntityKind } from "@scenaairo/shared";

import { createStableId } from "./stableId";

function nextId(kind: PersistedEntityKind, createId?: (kind: PersistedEntityKind) => string) {
  return createId ? createId(kind) : createStableId(kind);
}

const sampleProjectTitle = "Weekly Episode Workspace";
const sampleProjectSummary = "A persistence baseline for a recurring webtoon episode workspace.";
const sampleEpisodeTitles = ["Episode 12", "Episode 11", "Episode 10", "Episode 9"] as const;
const sampleDrawerLabel = "Unused confrontation beat";
const sampleObjectName = "Heroine's Mother";
const sampleNodeKeywords = ["meeting", "pressure", "hesitation"] as const;

// 샘플 워크스페이스 시그니처와 일치하는지 판별합니다.
export function isLegacySampleWorkspaceSnapshot(snapshot: StoryWorkspaceSnapshot) {
  if (snapshot.project.title !== sampleProjectTitle) {
    return false;
  }

  if (snapshot.project.summary !== sampleProjectSummary) {
    return false;
  }

  if (snapshot.episodes.length !== sampleEpisodeTitles.length) {
    return false;
  }

  const episodeTitles = snapshot.episodes.map((episode) => episode.title);
  if (!sampleEpisodeTitles.every((title) => episodeTitles.includes(title))) {
    return false;
  }

  if (snapshot.nodes.length !== 1) {
    return false;
  }

  const sampleNode = snapshot.nodes[0];
  if (!sampleNode || sampleNode.level !== "major" || sampleNode.contentMode !== "keywords") {
    return false;
  }

  if (
    sampleNodeKeywords.length !== sampleNode.keywords.length ||
    !sampleNodeKeywords.every((keyword) => sampleNode.keywords.includes(keyword))
  ) {
    return false;
  }

  if (snapshot.objects.length !== 1 || snapshot.objects[0]?.name !== sampleObjectName) {
    return false;
  }

  if (
    snapshot.temporaryDrawer.length !== 1 ||
    snapshot.temporaryDrawer[0]?.label !== sampleDrawerLabel
  ) {
    return false;
  }

  return true;
}

// 이 함수는 인증 계정의 빈 상태를 표현하는 최소 워크스페이스 껍데기를 생성합니다.
export function createEmptyWorkspaceShell(
  now: string,
  createId?: (kind: PersistedEntityKind) => string
): StoryWorkspaceSnapshot {
  return {
    episodes: [],
    nodes: [],
    objects: [],
    project: {
      activeEpisodeId: "",
      createdAt: now,
      id: nextId("project", createId),
      summary: "Create your first project to start structuring this account workspace.",
      title: "New Workspace",
      updatedAt: now
    },
    temporaryDrawer: []
  };
}

// 이 함수는 최초 프로젝트 생성 액션에서 사용할 비샘플 기본 워크스페이스를 생성합니다.
export function createStarterWorkspace(
  now: string,
  createId?: (kind: PersistedEntityKind) => string
): StoryWorkspaceSnapshot {
  const projectId = nextId("project", createId);
  const activeEpisodeId = nextId("episode", createId);

  return {
    episodes: [
      {
        createdAt: now,
        endpoint: "Define the closing turn for this episode.",
        id: activeEpisodeId,
        objective: "Outline the next structural beat for this episode.",
        projectId,
        title: "Episode 1",
        updatedAt: now
      }
    ],
    nodes: [],
    objects: [],
    project: {
      activeEpisodeId,
      createdAt: now,
      id: projectId,
      summary: "Start building your structure draft from an empty project.",
      title: "My Workspace",
      updatedAt: now
    },
    temporaryDrawer: []
  };
}

// 이 함수는 게스트 모드에서 보여줄 샘플 워크스페이스를 생성합니다.
export function createSampleWorkspace(
  now: string,
  createId?: (kind: PersistedEntityKind) => string
): StoryWorkspaceSnapshot {
  const projectId = nextId("project", createId);
  const activeEpisodeId = nextId("episode", createId);
  const episode11Id = nextId("episode", createId);
  const episode10Id = nextId("episode", createId);
  const episode9Id = nextId("episode", createId);
  const objectId = nextId("object", createId);
  const activeNodeId = nextId("node", createId);
  const drawerId = nextId("temporary_drawer", createId);

  const drawerItem: TemporaryDrawerItem = {
    createdAt: now,
    episodeId: activeEpisodeId,
    id: drawerId,
    label: "Unused confrontation beat",
    note: "Hold this in reserve if the mother enters one scene earlier.",
    projectId,
    sourceNodeId: activeNodeId,
    updatedAt: now
  };

  return {
    episodes: [
      {
        createdAt: now,
        endpoint: "The heroine's mother tells the male lead to leave.",
        id: activeEpisodeId,
        objective: "Bridge the cafe meeting to the episode-ending ultimatum.",
        projectId,
        title: "Episode 12",
        updatedAt: now
      },
      {
        createdAt: "2026-04-15T10:18:00.000Z",
        endpoint: "The second warning lands before the cafe door closes.",
        id: episode11Id,
        objective: "Tighten the confrontation so the heroine hesitates earlier.",
        projectId,
        title: "Episode 11",
        updatedAt: "2026-04-15T10:18:00.000Z"
      },
      {
        createdAt: "2026-04-14T08:35:00.000Z",
        endpoint: "The neighborhood rumor reaches the heroine first.",
        id: episode10Id,
        objective: "Seed the pressure before the mother steps in directly.",
        projectId,
        title: "Episode 10",
        updatedAt: "2026-04-14T08:35:00.000Z"
      },
      {
        createdAt: "2026-04-13T07:05:00.000Z",
        endpoint: "The cafe owner notices the argument before the couple reacts.",
        id: episode9Id,
        objective: "Keep a quieter fallback beat ready for pacing changes.",
        projectId,
        title: "Episode 9",
        updatedAt: "2026-04-13T07:05:00.000Z"
      }
    ],
    nodes: [
      {
        canvasX: 62,
        canvasY: 56,
        contentMode: "keywords",
        createdAt: now,
        episodeId: activeEpisodeId,
        id: activeNodeId,
        isCollapsed: false,
        isFixed: false,
        isImportant: false,
        keywords: ["meeting", "pressure", "hesitation"],
        level: "major",
        objectIds: [objectId],
        orderIndex: 1,
        parentId: null,
        projectId,
        text: "",
        updatedAt: now
      }
    ],
    objects: [
      {
        category: "person",
        createdAt: now,
        episodeId: activeEpisodeId,
        id: objectId,
        name: "Heroine's Mother",
        projectId,
        summary: "An authority figure who sharpens the episode's closing turn.",
        updatedAt: now
      }
    ],
    project: {
      activeEpisodeId,
      createdAt: now,
      id: projectId,
      summary: sampleProjectSummary,
      title: sampleProjectTitle,
      updatedAt: now
    },
    temporaryDrawer: [drawerItem]
  };
}
