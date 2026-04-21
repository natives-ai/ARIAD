import type {
  StoryWorkspaceSnapshot,
  TemporaryDrawerItem
} from "@scenaairo/shared";
import type { PersistedEntityKind } from "@scenaairo/shared";

import { createStableId } from "./stableId";

function nextId(kind: PersistedEntityKind, createId?: (kind: PersistedEntityKind) => string) {
  return createId ? createId(kind) : createStableId(kind);
}

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
      summary: "A persistence baseline for a recurring webtoon episode workspace.",
      title: "Weekly Episode Workspace",
      updatedAt: now
    },
    temporaryDrawer: [drawerItem]
  };
}
