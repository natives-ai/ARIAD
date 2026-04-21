import type { EntityId } from "./domain.js";
export type PersistenceMode = "guest" | "authenticated";
export type PersistedEntityKind = "project" | "episode" | "object" | "node" | "temporary_drawer";
export interface ProjectLinkageMetadata {
    entityId: EntityId;
    cloudLinked: boolean;
    linkedAccountId: string | null;
    lastImportedAt: string | null;
    lastSyncedAt: string | null;
}
export interface GlobalProjectRegistryEntry {
    projectId: EntityId;
    title: string;
    summary: string;
    cloudLinked: boolean;
    linkedAccountId: string | null;
    lastOpenedAt: string;
    updatedAt: string;
}
export interface GlobalProjectRegistry {
    activeProjectId: EntityId | null;
    projects: GlobalProjectRegistryEntry[];
}
//# sourceMappingURL=persistence.d.ts.map