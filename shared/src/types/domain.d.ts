export type AppEnvironment = "local" | "dev" | "staging-like";
export type WorkspaceRegion = "navigation" | "objects" | "canvas" | "details" | "drawer";
export type EntityId = string;
export type StoryObjectCategory = "person" | "place" | "thing";
export type StoryNodeLevel = "major" | "minor" | "detail";
export type StoryNodeContentMode = "empty" | "keywords" | "text";
export interface StoryProject {
    id: EntityId;
    title: string;
    summary: string;
    activeEpisodeId: EntityId;
    createdAt: string;
    updatedAt: string;
}
export interface StoryEpisode {
    id: EntityId;
    projectId: EntityId;
    title: string;
    objective: string;
    endpoint: string;
    createdAt: string;
    updatedAt: string;
}
export interface StoryObject {
    id: EntityId;
    projectId: EntityId;
    category: StoryObjectCategory;
    name: string;
    summary: string;
    createdAt: string;
    updatedAt: string;
}
export interface StoryNode {
    id: EntityId;
    projectId: EntityId;
    episodeId: EntityId;
    parentId: EntityId | null;
    level: StoryNodeLevel;
    contentMode: StoryNodeContentMode;
    keywords: string[];
    text: string;
    objectIds: EntityId[];
    isCollapsed?: boolean;
    isImportant?: boolean;
    isFixed?: boolean;
    canvasX?: number;
    canvasY?: number;
    orderIndex: number;
    createdAt: string;
    updatedAt: string;
}
export interface TemporaryDrawerItem {
    id: EntityId;
    projectId: EntityId;
    episodeId: EntityId;
    sourceNodeId: EntityId | null;
    label: string;
    note: string;
    createdAt: string;
    updatedAt: string;
}
export interface StoryWorkspaceSnapshot {
    project: StoryProject;
    episodes: StoryEpisode[];
    objects: StoryObject[];
    nodes: StoryNode[];
    temporaryDrawer: TemporaryDrawerItem[];
}
//# sourceMappingURL=domain.d.ts.map
