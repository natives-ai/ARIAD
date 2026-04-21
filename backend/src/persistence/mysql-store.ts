// 이 파일은 MySQL 기반 프로젝트 영속화 저장소를 제공합니다.

import mysql from "mysql2/promise";
import type { Pool, PoolConnection, RowDataPacket } from "mysql2/promise";
import type {
  CloudSyncOperation,
  GetProjectResponse,
  GlobalProjectRegistryEntry,
  ImportProjectResponse,
  ListProjectsResponse,
  ProjectLinkageMetadata,
  SyncProjectResponse
} from "@scenaairo/shared";
import type {
  EntityId,
  StoryEpisode,
  StoryNode,
  StoryObject,
  StoryWorkspaceSnapshot,
  TemporaryDrawerItem
} from "@scenaairo/shared";

interface StoredProjectRecord {
  linkage: ProjectLinkageMetadata;
  snapshot: StoryWorkspaceSnapshot;
}

interface MySqlPersistenceStoreOptions {
  database: string;
  host: string;
  password: string;
  port: number;
  user: string;
  now?: () => string;
}

interface CloudProjectRow extends RowDataPacket {
  account_id: string;
  linkage_json: unknown;
  project_id: string;
  snapshot_json: unknown;
}

// 배열에서 같은 ID 항목을 치환하거나 추가합니다.
function upsertById<T extends { id: EntityId }>(items: T[], item: T): T[] {
  const next = items.filter((entry) => entry.id !== item.id);
  next.push(item);
  return next;
}

// 배열에서 특정 ID 항목을 제거합니다.
function removeById<T extends { id: EntityId }>(items: T[], entityId: EntityId): T[] {
  return items.filter((entry) => entry.id !== entityId);
}

// 스냅샷 객체를 깊은 복사합니다.
function cloneSnapshot(snapshot: StoryWorkspaceSnapshot): StoryWorkspaceSnapshot {
  return JSON.parse(JSON.stringify(snapshot)) as StoryWorkspaceSnapshot;
}

// 에피소드 목록을 생성 시간 순으로 정렬합니다.
function sortEpisodes(episodes: StoryEpisode[]): StoryEpisode[] {
  return [...episodes].sort((left, right) => left.createdAt.localeCompare(right.createdAt));
}

// 오브젝트 목록을 생성 시간 순으로 정렬합니다.
function sortObjects(objects: StoryObject[]): StoryObject[] {
  return [...objects].sort((left, right) => left.createdAt.localeCompare(right.createdAt));
}

// 노드 목록을 순서 인덱스 기준으로 정렬합니다.
function sortNodes(nodes: StoryNode[]): StoryNode[] {
  return [...nodes].sort((left, right) => left.orderIndex - right.orderIndex);
}

// 임시 서랍 항목을 생성 시간 순으로 정렬합니다.
function sortDrawer(items: TemporaryDrawerItem[]): TemporaryDrawerItem[] {
  return [...items].sort((left, right) => left.createdAt.localeCompare(right.createdAt));
}

// 스냅샷을 복제하고 내부 컬렉션 정렬 규칙을 표준화합니다.
function normalizeSnapshot(snapshot: StoryWorkspaceSnapshot): StoryWorkspaceSnapshot {
  return {
    ...cloneSnapshot(snapshot),
    episodes: sortEpisodes(snapshot.episodes),
    nodes: sortNodes(snapshot.nodes),
    objects: sortObjects(snapshot.objects),
    temporaryDrawer: sortDrawer(snapshot.temporaryDrawer)
  };
}

// 프로젝트 루트 ID가 동기화 대상과 일치하는지 검증합니다.
function ensureProjectShell(snapshot: StoryWorkspaceSnapshot, projectId: EntityId) {
  if (snapshot.project.id !== projectId) {
    throw new Error("project_mismatch");
  }
}

// 노드/서랍의 부모가 되는 에피소드 존재 여부를 검증합니다.
function ensureEpisodeExists(snapshot: StoryWorkspaceSnapshot, episodeId: EntityId) {
  if (!snapshot.episodes.some((episode) => episode.id === episodeId)) {
    throw new Error("missing_episode_dependency");
  }
}

// 노드가 참조하는 상위/오브젝트 의존성을 검증합니다.
function ensureNodeDependencies(snapshot: StoryWorkspaceSnapshot, node: StoryNode) {
  ensureEpisodeExists(snapshot, node.episodeId);

  if (node.parentId && !snapshot.nodes.some((entry) => entry.id === node.parentId)) {
    throw new Error("missing_parent_node_dependency");
  }

  if (
    node.objectIds.some(
      (objectId) => !snapshot.objects.some((entry) => entry.id === objectId)
    )
  ) {
    throw new Error("missing_object_dependency");
  }
}

// 임시 서랍 항목의 참조 의존성을 검증합니다.
function ensureDrawerDependencies(
  snapshot: StoryWorkspaceSnapshot,
  item: TemporaryDrawerItem
) {
  ensureEpisodeExists(snapshot, item.episodeId);

  if (
    item.sourceNodeId &&
    !snapshot.nodes.some((node) => node.id === item.sourceNodeId)
  ) {
    throw new Error("missing_drawer_node_dependency");
  }
}

// JSON 컬럼 값을 타입 안전하게 역직렬화합니다.
function parseJsonColumn<T>(value: unknown): T {
  if (typeof value === "string") {
    return JSON.parse(value) as T;
  }

  if (value instanceof Buffer) {
    return JSON.parse(value.toString("utf8")) as T;
  }

  return value as T;
}

// DB 조회 행을 저장소 레코드 형태로 변환합니다.
function mapRowToRecord(row: CloudProjectRow): StoredProjectRecord {
  return {
    linkage: parseJsonColumn<ProjectLinkageMetadata>(row.linkage_json),
    snapshot: parseJsonColumn<StoryWorkspaceSnapshot>(row.snapshot_json)
  };
}

// MySQL 트랜잭션을 수행하고 예외 시 롤백합니다.
async function withTransaction<T>(
  pool: Pool,
  handler: (connection: PoolConnection) => Promise<T>
): Promise<T> {
  const connection = await pool.getConnection();

  try {
    await connection.beginTransaction();
    const result = await handler(connection);
    await connection.commit();
    return result;
  } catch (error) {
    await connection.rollback();
    throw error;
  } finally {
    connection.release();
  }
}

// MySQL 기반으로 프로젝트 영속화를 처리하는 저장소 클래스입니다.
export class MySqlBackedPersistenceStore {
  private readonly now: () => string;

  private readonly pool: Pool;

  private schemaReady: Promise<void> | null = null;

  constructor(options: MySqlPersistenceStoreOptions) {
    this.pool = mysql.createPool({
      connectionLimit: 10,
      database: options.database,
      host: options.host,
      password: options.password,
      port: options.port,
      user: options.user
    });
    this.now = options.now ?? (() => new Date().toISOString());
  }

  // 필요한 테이블 스키마가 존재하도록 보장합니다.
  private async ensureSchema() {
    if (!this.schemaReady) {
      this.schemaReady = this.pool
        .execute(
          `CREATE TABLE IF NOT EXISTS cloud_projects (
            account_id VARCHAR(191) NOT NULL,
            project_id VARCHAR(191) NOT NULL,
            linkage_json JSON NOT NULL,
            snapshot_json JSON NOT NULL,
            updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
            PRIMARY KEY (account_id, project_id)
          ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`
        )
        .then(() => undefined);
    }

    await this.schemaReady;
  }

  // 계정의 프로젝트 목록을 조회합니다.
  async listProjects(accountId: string): Promise<ListProjectsResponse> {
    await this.ensureSchema();
    const [rows] = await this.pool.query<CloudProjectRow[]>(
      `SELECT account_id, project_id, linkage_json, snapshot_json
       FROM cloud_projects
       WHERE account_id = ?`,
      [accountId]
    );

    const projects: GlobalProjectRegistryEntry[] = rows.map((row) => {
      const record = mapRowToRecord(row);
      const snapshot = normalizeSnapshot(record.snapshot);
      const linkage = record.linkage;

      return {
        cloudLinked: linkage.cloudLinked,
        lastOpenedAt: snapshot.project.updatedAt,
        linkedAccountId: linkage.linkedAccountId,
        projectId: snapshot.project.id,
        summary: snapshot.project.summary,
        title: snapshot.project.title,
        updatedAt: snapshot.project.updatedAt
      };
    });

    return { projects };
  }

  // 계정의 특정 프로젝트를 조회합니다.
  async getProject(accountId: string, projectId: EntityId): Promise<GetProjectResponse> {
    await this.ensureSchema();
    const [rows] = await this.pool.query<CloudProjectRow[]>(
      `SELECT account_id, project_id, linkage_json, snapshot_json
       FROM cloud_projects
       WHERE account_id = ? AND project_id = ?
       LIMIT 1`,
      [accountId, projectId]
    );

    if (rows.length === 0) {
      return {
        linkage: null,
        snapshot: null
      };
    }

    const record = mapRowToRecord(rows[0]!);
    return {
      linkage: { ...record.linkage },
      snapshot: normalizeSnapshot(record.snapshot)
    };
  }

  // 신규 프로젝트를 계정에 연결해 저장합니다.
  async importProject(
    accountId: string,
    snapshot: StoryWorkspaceSnapshot,
    linkage: ProjectLinkageMetadata | null
  ): Promise<ImportProjectResponse> {
    await this.ensureSchema();
    const normalizedSnapshot = normalizeSnapshot(snapshot);
    const projectId = normalizedSnapshot.project.id;
    const now = this.now();

    return withTransaction(this.pool, async (connection) => {
      const [existingRows] = await connection.query<CloudProjectRow[]>(
        `SELECT account_id, project_id, linkage_json, snapshot_json
         FROM cloud_projects
         WHERE account_id = ? AND project_id = ?
         LIMIT 1
         FOR UPDATE`,
        [accountId, projectId]
      );

      if (existingRows.length > 0) {
        const existing = mapRowToRecord(existingRows[0]!);
        return {
          created: false,
          linkage: { ...existing.linkage },
          snapshot: normalizeSnapshot(existing.snapshot)
        };
      }

      const nextLinkage: ProjectLinkageMetadata = {
        cloudLinked: true,
        entityId: linkage?.entityId ?? projectId,
        lastImportedAt: now,
        lastSyncedAt: now,
        linkedAccountId: accountId
      };

      await connection.execute(
        `INSERT INTO cloud_projects (
          account_id,
          project_id,
          linkage_json,
          snapshot_json
        ) VALUES (?, ?, ?, ?)`,
        [
          accountId,
          projectId,
          JSON.stringify(nextLinkage),
          JSON.stringify(normalizedSnapshot)
        ]
      );

      return {
        created: true,
        linkage: nextLinkage,
        snapshot: normalizedSnapshot
      };
    });
  }

  // 동기화 연산을 순서대로 적용하고 최신 상태를 저장합니다.
  async syncProject(
    accountId: string,
    projectId: EntityId,
    operations: CloudSyncOperation[]
  ): Promise<SyncProjectResponse> {
    await this.ensureSchema();

    return withTransaction(this.pool, async (connection) => {
      const [rows] = await connection.query<CloudProjectRow[]>(
        `SELECT account_id, project_id, linkage_json, snapshot_json
         FROM cloud_projects
         WHERE account_id = ? AND project_id = ?
         LIMIT 1
         FOR UPDATE`,
        [accountId, projectId]
      );

      if (rows.length === 0) {
        throw new Error("missing_project");
      }

      const record = mapRowToRecord(rows[0]!);
      let snapshot = normalizeSnapshot(record.snapshot);

      for (const operation of operations) {
        if (
          operation.action === "delete" &&
          operation.projectId !== projectId
        ) {
          throw new Error("project_mismatch");
        }

        if (operation.action === "delete") {
          switch (operation.kind) {
            case "project":
              throw new Error("project_delete_not_supported");
            case "episode":
              snapshot = {
                ...snapshot,
                episodes: removeById(snapshot.episodes, operation.entityId),
                nodes: snapshot.nodes.filter((node) => node.episodeId !== operation.entityId),
                temporaryDrawer: snapshot.temporaryDrawer.filter(
                  (item) => item.episodeId !== operation.entityId
                )
              };
              break;
            case "object":
              snapshot = {
                ...snapshot,
                nodes: snapshot.nodes.map((node) => ({
                  ...node,
                  objectIds: node.objectIds.filter(
                    (objectId) => objectId !== operation.entityId
                  )
                })),
                objects: removeById(snapshot.objects, operation.entityId)
              };
              break;
            case "node":
              snapshot = {
                ...snapshot,
                nodes: removeById(snapshot.nodes, operation.entityId),
                temporaryDrawer: snapshot.temporaryDrawer.map((item) =>
                  item.sourceNodeId === operation.entityId
                    ? { ...item, sourceNodeId: null }
                    : item
                )
              };
              break;
            case "temporary_drawer":
              snapshot = {
                ...snapshot,
                temporaryDrawer: removeById(snapshot.temporaryDrawer, operation.entityId)
              };
              break;
          }

          continue;
        }

        switch (operation.kind) {
          case "project":
            ensureProjectShell(snapshot, operation.payload.id);
            snapshot = {
              ...snapshot,
              project: operation.payload
            };
            break;
          case "episode":
            ensureProjectShell(snapshot, operation.payload.projectId);
            snapshot = {
              ...snapshot,
              episodes: upsertById(snapshot.episodes, operation.payload)
            };
            break;
          case "object":
            ensureProjectShell(snapshot, operation.payload.projectId);
            snapshot = {
              ...snapshot,
              objects: upsertById(snapshot.objects, operation.payload)
            };
            break;
          case "node":
            ensureProjectShell(snapshot, operation.payload.projectId);
            ensureNodeDependencies(snapshot, operation.payload);
            snapshot = {
              ...snapshot,
              nodes: upsertById(snapshot.nodes, operation.payload)
            };
            break;
          case "temporary_drawer":
            ensureProjectShell(snapshot, operation.payload.projectId);
            ensureDrawerDependencies(snapshot, operation.payload);
            snapshot = {
              ...snapshot,
              temporaryDrawer: upsertById(snapshot.temporaryDrawer, operation.payload)
            };
            break;
        }
      }

      const nextLinkage: ProjectLinkageMetadata = {
        ...record.linkage,
        cloudLinked: true,
        lastSyncedAt: this.now(),
        linkedAccountId: accountId
      };
      const normalizedSnapshot = normalizeSnapshot(snapshot);

      await connection.execute(
        `UPDATE cloud_projects
         SET linkage_json = ?, snapshot_json = ?
         WHERE account_id = ? AND project_id = ?`,
        [
          JSON.stringify(nextLinkage),
          JSON.stringify(normalizedSnapshot),
          accountId,
          projectId
        ]
      );

      return {
        linkage: nextLinkage,
        snapshot: normalizedSnapshot
      };
    });
  }

  // 서버 종료 시 DB 커넥션 풀을 정리합니다.
  async close() {
    await this.pool.end();
  }
}
