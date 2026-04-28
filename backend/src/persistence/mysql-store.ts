// 이 파일은 MySQL 정규화 테이블 기반 프로젝트 영속화를 제공합니다.

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
  StoryNodeContentMode,
  StoryNodeLevel,
  StoryObject,
  StoryObjectCategory,
  StoryProject,
  StoryWorkspaceSnapshot,
  TemporaryDrawerItem
} from "@scenaairo/shared";
import {
  assertFreshNodeRevision,
  canonicalizeNodeOrderByEpisode,
  getExpectedParentLevel,
  validateNodeGraphIntegrity
} from "./node-order.js";

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
  linkage_cloud_linked: number | null;
  linkage_entity_id: string | null;
  linkage_json: unknown | null;
  linkage_last_imported_at: string | null;
  linkage_last_synced_at: string | null;
  linkage_linked_account_id: string | null;
  project_active_episode_id: string | null;
  project_created_at: string | null;
  project_id: string;
  project_summary: string | null;
  project_title: string | null;
  project_updated_at: string | null;
  snapshot_json: unknown | null;
}

interface CloudEpisodeRow extends RowDataPacket {
  created_at: string;
  endpoint: string;
  episode_id: string;
  objective: string;
  title: string;
  updated_at: string;
}

interface CloudObjectRow extends RowDataPacket {
  category: string;
  created_at: string;
  episode_id: string;
  name: string;
  object_id: string;
  summary: string;
  updated_at: string;
}

interface CloudNodeRow extends RowDataPacket {
  canvas_height: number | null;
  canvas_width: number | null;
  canvas_x: number | null;
  canvas_y: number | null;
  content_mode: string;
  created_at: string;
  episode_id: string;
  is_collapsed: number | null;
  is_fixed: number | null;
  is_important: number | null;
  node_id: string;
  node_level: string;
  order_index: number;
  parent_id: string | null;
  text_value: string;
  updated_at: string;
}

interface CloudNodeKeywordRow extends RowDataPacket {
  keyword_order: number;
  keyword_value: string;
  node_id: string;
}

interface CloudNodeObjectLinkRow extends RowDataPacket {
  node_id: string;
  object_id: string;
  object_order: number;
}

interface CloudDrawerRow extends RowDataPacket {
  created_at: string;
  drawer_item_id: string;
  episode_id: string;
  label: string;
  note: string;
  source_node_id: string | null;
  updated_at: string;
}
interface InformationSchemaColumnRow extends RowDataPacket {
  COLUMN_NAME: string;
}

// 프로젝트 루트 조회에서 공통으로 사용하는 컬럼 집합입니다.
const PROJECT_SELECT_COLUMNS = `
  account_id,
  project_id,
  project_title,
  project_summary,
  project_active_episode_id,
  project_created_at,
  project_updated_at,
  linkage_entity_id,
  linkage_cloud_linked,
  linkage_linked_account_id,
  linkage_last_imported_at,
  linkage_last_synced_at,
  linkage_json,
  snapshot_json
`;

// 레거시 cloud_projects 테이블의 백워드 컬럼을 보완합니다.
const CLOUD_PROJECT_BACKFILL_COLUMNS: ReadonlyArray<{
  definition: string;
  name: string;
}> = [
  {
    name: "project_title",
    definition: "project_title TEXT NULL"
  },
  {
    name: "project_summary",
    definition: "project_summary MEDIUMTEXT NULL"
  },
  {
    name: "project_active_episode_id",
    definition: "project_active_episode_id VARCHAR(191) NULL"
  },
  {
    name: "project_created_at",
    definition: "project_created_at VARCHAR(40) NULL"
  },
  {
    name: "project_updated_at",
    definition: "project_updated_at VARCHAR(40) NULL"
  },
  {
    name: "linkage_entity_id",
    definition: "linkage_entity_id VARCHAR(191) NULL"
  },
  {
    name: "linkage_cloud_linked",
    definition: "linkage_cloud_linked TINYINT(1) NULL"
  },
  {
    name: "linkage_linked_account_id",
    definition: "linkage_linked_account_id VARCHAR(191) NULL"
  },
  {
    name: "linkage_last_imported_at",
    definition: "linkage_last_imported_at VARCHAR(40) NULL"
  },
  {
    name: "linkage_last_synced_at",
    definition: "linkage_last_synced_at VARCHAR(40) NULL"
  },
  {
    name: "linkage_json",
    definition: "linkage_json JSON NULL"
  },
  {
    name: "snapshot_json",
    definition: "snapshot_json JSON NULL"
  }
];

// 레거시 cloud_nodes 테이블의 레이아웃 크기 컬럼을 보완합니다.
const CLOUD_NODE_BACKFILL_COLUMNS: ReadonlyArray<{
  definition: string;
  name: string;
}> = [
  {
    name: "canvas_width",
    definition: "canvas_width DOUBLE NULL"
  },
  {
    name: "canvas_height",
    definition: "canvas_height DOUBLE NULL"
  }
];
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

// 임시 서랍 항목을 생성 시간 순으로 정렬합니다.
function sortDrawer(items: TemporaryDrawerItem[]): TemporaryDrawerItem[] {
  return [...items].sort((left, right) => left.createdAt.localeCompare(right.createdAt));
}

// 스냅샷을 복제하고 내부 컬렉션 정렬/참조 규칙을 표준화합니다.
function normalizeSnapshot(snapshot: StoryWorkspaceSnapshot): StoryWorkspaceSnapshot {
  const clonedSnapshot = cloneSnapshot(snapshot);
  const normalizedEpisodes = sortEpisodes(clonedSnapshot.episodes);
  const fallbackEpisodeId =
    normalizedEpisodes.find(
      (episode) => episode.id === clonedSnapshot.project.activeEpisodeId
    )?.id ??
    normalizedEpisodes[0]?.id ??
    null;
  const knownEpisodeIds = new Set(normalizedEpisodes.map((episode) => episode.id));
  const normalizedObjects = clonedSnapshot.objects
    .map((object) => {
      const episodeId =
        object.episodeId && knownEpisodeIds.has(object.episodeId)
          ? object.episodeId
          : fallbackEpisodeId;

      if (!episodeId) {
        return null;
      }

      return {
        ...object,
        episodeId,
        projectId: clonedSnapshot.project.id
      };
    })
    .filter((object): object is StoryObject => object !== null);
  const objectsById = new Map(normalizedObjects.map((object) => [object.id, object]));
  const normalizedNodes = clonedSnapshot.nodes.map((node) => ({
    ...node,
    objectIds: [...new Set(
      node.objectIds.filter((objectId) => {
        const object = objectsById.get(objectId);
        return (
          object !== undefined &&
          object.projectId === node.projectId
        );
      })
    )]
  }));
  const normalizedNodesByEpisode = canonicalizeNodeOrderByEpisode(
    normalizedNodes,
    normalizedEpisodes
  );

  return {
    ...clonedSnapshot,
    episodes: normalizedEpisodes,
    nodes: normalizedNodesByEpisode,
    objects: sortObjects(normalizedObjects),
    temporaryDrawer: sortDrawer(clonedSnapshot.temporaryDrawer)
  };
}

// 프로젝트 루트 ID가 동기화 대상과 일치하는지 검증합니다.
function ensureProjectShell(snapshot: StoryWorkspaceSnapshot, projectId: EntityId) {
  if (snapshot.project.id !== projectId) {
    throw new Error("project_mismatch");
  }
}

// 노드/서랍/오브젝트의 부모가 되는 에피소드 존재 여부를 검증합니다.
function ensureEpisodeExists(snapshot: StoryWorkspaceSnapshot, episodeId: EntityId) {
  if (!snapshot.episodes.some((episode) => episode.id === episodeId)) {
    throw new Error("missing_episode_dependency");
  }
}

// 오브젝트가 속한 에피소드/프로젝트 관계를 검증합니다.
function ensureObjectDependencies(snapshot: StoryWorkspaceSnapshot, object: StoryObject) {
  ensureEpisodeExists(snapshot, object.episodeId);
  const episode = snapshot.episodes.find((entry) => entry.id === object.episodeId);

  if (!episode || episode.projectId !== object.projectId) {
    throw new Error("object_episode_project_mismatch");
  }
}

// 노드가 참조하는 상위/오브젝트 의존성을 검증합니다.
function ensureNodeDependencies(snapshot: StoryWorkspaceSnapshot, node: StoryNode) {
  ensureEpisodeExists(snapshot, node.episodeId);

  if (node.parentId) {
    const parentNode = snapshot.nodes.find((entry) => entry.id === node.parentId);

    if (!parentNode) {
      throw new Error("missing_parent_node_dependency");
    }

    if (parentNode.projectId !== node.projectId) {
      throw new Error("parent_project_mismatch");
    }

    if (parentNode.episodeId !== node.episodeId) {
      throw new Error("parent_episode_mismatch");
    }

    const expectedParentLevel = getExpectedParentLevel(node.level);

    if (!expectedParentLevel || parentNode.level !== expectedParentLevel) {
      throw new Error("invalid_parent_level");
    }
  }

  for (const objectId of node.objectIds) {
    const object = snapshot.objects.find((entry) => entry.id === objectId);

    if (!object) {
      throw new Error("missing_object_dependency");
    }

    if (object.projectId !== node.projectId) {
      throw new Error("object_project_mismatch");
    }
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

  if (item.sourceNodeId) {
    const sourceNode = snapshot.nodes.find((node) => node.id === item.sourceNodeId);

    if (sourceNode && sourceNode.episodeId !== item.episodeId) {
      throw new Error("drawer_episode_mismatch");
    }
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

// 레거시 JSON 컬럼 기반 저장 레코드를 파싱합니다.
function mapLegacyRowToRecord(row: CloudProjectRow): StoredProjectRecord | null {
  if (row.linkage_json === null || row.snapshot_json === null) {
    return null;
  }

  return {
    linkage: parseJsonColumn<ProjectLinkageMetadata>(row.linkage_json),
    snapshot: parseJsonColumn<StoryWorkspaceSnapshot>(row.snapshot_json)
  };
}

// 프로젝트 행의 루트 컬럼을 StoryProject로 변환합니다.
function mapProjectRowToProject(
  row: CloudProjectRow,
  fallback: StoryProject | null
): StoryProject | null {
  if (
    row.project_title !== null &&
    row.project_summary !== null &&
    row.project_active_episode_id !== null &&
    row.project_created_at !== null &&
    row.project_updated_at !== null
  ) {
    return {
      activeEpisodeId: row.project_active_episode_id,
      createdAt: row.project_created_at,
      id: row.project_id,
      summary: row.project_summary,
      title: row.project_title,
      updatedAt: row.project_updated_at
    };
  }

  if (fallback) {
    return { ...fallback };
  }

  return null;
}

// 프로젝트 행의 링크 컬럼을 ProjectLinkageMetadata로 변환합니다.
function mapProjectRowToLinkage(
  row: CloudProjectRow,
  accountId: string,
  fallback: ProjectLinkageMetadata | null
): ProjectLinkageMetadata {
  if (
    row.linkage_entity_id !== null &&
    row.linkage_last_imported_at !== null &&
    row.linkage_last_synced_at !== null
  ) {
    return {
      cloudLinked: row.linkage_cloud_linked === null ? true : row.linkage_cloud_linked === 1,
      entityId: row.linkage_entity_id,
      lastImportedAt: row.linkage_last_imported_at,
      lastSyncedAt: row.linkage_last_synced_at,
      linkedAccountId: row.linkage_linked_account_id ?? accountId
    };
  }

  if (fallback) {
    return { ...fallback };
  }

  const fallbackTimestamp =
    row.project_updated_at ??
    row.project_created_at ??
    new Date(0).toISOString();

  return {
    cloudLinked: true,
    entityId: row.project_id,
    lastImportedAt: fallbackTimestamp,
    lastSyncedAt: fallbackTimestamp,
    linkedAccountId: accountId
  };
}

// 선택적 boolean 값을 DB 저장용 숫자 플래그로 변환합니다.
function toNullableTinyInt(value: boolean | undefined): number | null {
  if (typeof value !== "boolean") {
    return null;
  }

  return value ? 1 : 0;
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

// MySQL 정규화 테이블 기반으로 프로젝트 영속화를 처리하는 저장소 클래스입니다.
export class MySqlBackedPersistenceStore {
  private readonly now: () => string;

  private readonly pool: Pool;

  private schemaReady: Promise<void> | null = null;

  // MySQL 커넥션 풀을 초기화합니다.
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

  // 필요한 루트/정규화 테이블 스키마가 존재하도록 보장합니다.
  private async ensureSchema() {
    if (!this.schemaReady) {
      this.schemaReady = (async () => {
        const statements = [
          `CREATE TABLE IF NOT EXISTS cloud_projects (
            account_id VARCHAR(191) NOT NULL,
            project_id VARCHAR(191) NOT NULL,
            project_title TEXT NULL,
            project_summary MEDIUMTEXT NULL,
            project_active_episode_id VARCHAR(191) NULL,
            project_created_at VARCHAR(40) NULL,
            project_updated_at VARCHAR(40) NULL,
            linkage_entity_id VARCHAR(191) NULL,
            linkage_cloud_linked TINYINT(1) NULL,
            linkage_linked_account_id VARCHAR(191) NULL,
            linkage_last_imported_at VARCHAR(40) NULL,
            linkage_last_synced_at VARCHAR(40) NULL,
            linkage_json JSON NULL,
            snapshot_json JSON NULL,
            updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
            PRIMARY KEY (account_id, project_id)
          ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`,
          `CREATE TABLE IF NOT EXISTS cloud_accounts (
            account_id VARCHAR(191) NOT NULL,
            auth_provider VARCHAR(32) NOT NULL DEFAULT 'unknown',
            provider_subject VARCHAR(191) NULL,
            email VARCHAR(320) NULL,
            display_name VARCHAR(255) NULL,
            avatar_url MEDIUMTEXT NULL,
            created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
            updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
            PRIMARY KEY (account_id),
            UNIQUE KEY uq_cloud_accounts_provider_subject (auth_provider, provider_subject),
            UNIQUE KEY uq_cloud_accounts_email (email)
          ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`,
          `CREATE TABLE IF NOT EXISTS cloud_sessions (
            session_id VARCHAR(191) NOT NULL,
            account_id VARCHAR(191) NOT NULL,
            created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
            expires_at DATETIME NOT NULL,
            revoked_at DATETIME NULL,
            user_agent_hash VARCHAR(64) NULL,
            PRIMARY KEY (session_id),
            INDEX idx_cloud_sessions_account_id (account_id),
            INDEX idx_cloud_sessions_expires_at (expires_at),
            CONSTRAINT fk_cloud_sessions_account
              FOREIGN KEY (account_id)
              REFERENCES cloud_accounts (account_id)
              ON DELETE CASCADE
          ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`,
          `CREATE TABLE IF NOT EXISTS cloud_episodes (
            account_id VARCHAR(191) NOT NULL,
            project_id VARCHAR(191) NOT NULL,
            episode_id VARCHAR(191) NOT NULL,
            title TEXT NOT NULL,
            objective MEDIUMTEXT NOT NULL,
            endpoint MEDIUMTEXT NOT NULL,
            created_at VARCHAR(40) NOT NULL,
            updated_at VARCHAR(40) NOT NULL,
            PRIMARY KEY (account_id, project_id, episode_id),
            CONSTRAINT fk_cloud_episodes_project
              FOREIGN KEY (account_id, project_id)
              REFERENCES cloud_projects (account_id, project_id)
              ON DELETE CASCADE
          ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`,
          `CREATE TABLE IF NOT EXISTS cloud_objects (
            account_id VARCHAR(191) NOT NULL,
            project_id VARCHAR(191) NOT NULL,
            object_id VARCHAR(191) NOT NULL,
            episode_id VARCHAR(191) NOT NULL,
            category VARCHAR(32) NOT NULL,
            name VARCHAR(255) NOT NULL,
            summary MEDIUMTEXT NOT NULL,
            created_at VARCHAR(40) NOT NULL,
            updated_at VARCHAR(40) NOT NULL,
            PRIMARY KEY (account_id, project_id, object_id),
            INDEX idx_cloud_objects_episode (account_id, project_id, episode_id),
            CONSTRAINT fk_cloud_objects_project
              FOREIGN KEY (account_id, project_id)
              REFERENCES cloud_projects (account_id, project_id)
              ON DELETE CASCADE,
            CONSTRAINT fk_cloud_objects_episode
              FOREIGN KEY (account_id, project_id, episode_id)
              REFERENCES cloud_episodes (account_id, project_id, episode_id)
              ON DELETE CASCADE
          ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`,
          `CREATE TABLE IF NOT EXISTS cloud_nodes (
            account_id VARCHAR(191) NOT NULL,
            project_id VARCHAR(191) NOT NULL,
            node_id VARCHAR(191) NOT NULL,
            episode_id VARCHAR(191) NOT NULL,
            parent_id VARCHAR(191) NULL,
            node_level VARCHAR(16) NOT NULL,
            content_mode VARCHAR(16) NOT NULL,
            text_value MEDIUMTEXT NOT NULL,
            is_collapsed TINYINT(1) NULL,
            is_important TINYINT(1) NULL,
            is_fixed TINYINT(1) NULL,
            canvas_x DOUBLE NULL,
            canvas_y DOUBLE NULL,
            canvas_width DOUBLE NULL,
            canvas_height DOUBLE NULL,
            order_index INT NOT NULL,
            created_at VARCHAR(40) NOT NULL,
            updated_at VARCHAR(40) NOT NULL,
            PRIMARY KEY (account_id, project_id, node_id),
            INDEX idx_cloud_nodes_episode (account_id, project_id, episode_id),
            INDEX idx_cloud_nodes_parent (account_id, project_id, parent_id),
            CONSTRAINT fk_cloud_nodes_project
              FOREIGN KEY (account_id, project_id)
              REFERENCES cloud_projects (account_id, project_id)
              ON DELETE CASCADE,
            CONSTRAINT fk_cloud_nodes_episode
              FOREIGN KEY (account_id, project_id, episode_id)
              REFERENCES cloud_episodes (account_id, project_id, episode_id)
              ON DELETE CASCADE
          ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`,
          `CREATE TABLE IF NOT EXISTS cloud_node_keywords (
            account_id VARCHAR(191) NOT NULL,
            project_id VARCHAR(191) NOT NULL,
            node_id VARCHAR(191) NOT NULL,
            keyword_order INT NOT NULL,
            keyword_value VARCHAR(255) NOT NULL,
            PRIMARY KEY (account_id, project_id, node_id, keyword_order),
            CONSTRAINT fk_cloud_node_keywords_node
              FOREIGN KEY (account_id, project_id, node_id)
              REFERENCES cloud_nodes (account_id, project_id, node_id)
              ON DELETE CASCADE
          ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`,
          `CREATE TABLE IF NOT EXISTS cloud_node_object_links (
            account_id VARCHAR(191) NOT NULL,
            project_id VARCHAR(191) NOT NULL,
            node_id VARCHAR(191) NOT NULL,
            object_order INT NOT NULL,
            object_id VARCHAR(191) NOT NULL,
            PRIMARY KEY (account_id, project_id, node_id, object_order),
            INDEX idx_cloud_node_object_links_object (account_id, project_id, object_id),
            CONSTRAINT fk_cloud_node_object_links_node
              FOREIGN KEY (account_id, project_id, node_id)
              REFERENCES cloud_nodes (account_id, project_id, node_id)
              ON DELETE CASCADE,
            CONSTRAINT fk_cloud_node_object_links_object
              FOREIGN KEY (account_id, project_id, object_id)
              REFERENCES cloud_objects (account_id, project_id, object_id)
              ON DELETE CASCADE
          ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`,
          `CREATE TABLE IF NOT EXISTS cloud_temporary_drawer (
            account_id VARCHAR(191) NOT NULL,
            project_id VARCHAR(191) NOT NULL,
            drawer_item_id VARCHAR(191) NOT NULL,
            episode_id VARCHAR(191) NOT NULL,
            source_node_id VARCHAR(191) NULL,
            label TEXT NOT NULL,
            note MEDIUMTEXT NOT NULL,
            created_at VARCHAR(40) NOT NULL,
            updated_at VARCHAR(40) NOT NULL,
            PRIMARY KEY (account_id, project_id, drawer_item_id),
            INDEX idx_cloud_temporary_drawer_episode (account_id, project_id, episode_id),
            CONSTRAINT fk_cloud_temporary_drawer_project
              FOREIGN KEY (account_id, project_id)
              REFERENCES cloud_projects (account_id, project_id)
              ON DELETE CASCADE,
            CONSTRAINT fk_cloud_temporary_drawer_episode
              FOREIGN KEY (account_id, project_id, episode_id)
              REFERENCES cloud_episodes (account_id, project_id, episode_id)
              ON DELETE CASCADE,
            CONSTRAINT fk_cloud_temporary_drawer_source_node
              FOREIGN KEY (account_id, project_id, source_node_id)
              REFERENCES cloud_nodes (account_id, project_id, node_id)
              ON DELETE RESTRICT
          ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`
        ];

        for (const statement of statements) {
          await this.pool.execute(statement);
        }
        await this.ensureCloudProjectsBackfillColumns();
        await this.ensureCloudNodesBackfillColumns();
      })();
    }

    await this.schemaReady;
  }

  // MySQL 버전 차이와 무관하게 nullable 백워드 컬럼을 보완합니다.
  private async ensureBackfillColumns(
    tableName: "cloud_nodes" | "cloud_projects",
    columns: ReadonlyArray<{ definition: string; name: string }>
  ) {
    const [rows] = await this.pool.query<InformationSchemaColumnRow[]>(
      `SELECT COLUMN_NAME
       FROM INFORMATION_SCHEMA.COLUMNS
       WHERE TABLE_SCHEMA = DATABASE()
         AND TABLE_NAME = ?`,
      [tableName]
    );
    const existingColumnNames = new Set(rows.map((row) => row.COLUMN_NAME));

    for (const column of columns) {
      if (existingColumnNames.has(column.name)) {
        continue;
      }

      await this.pool.execute(
        `ALTER TABLE ${tableName} ADD COLUMN ${column.definition}`
      );
    }
  }

  // MySQL 버전 차이와 무관하게 cloud_projects 백워드 컬럼을 보완합니다.
  private async ensureCloudProjectsBackfillColumns() {
    await this.ensureBackfillColumns("cloud_projects", CLOUD_PROJECT_BACKFILL_COLUMNS);
  }

  // MySQL 버전 차이와 무관하게 cloud_nodes 크기 컬럼을 보완합니다.
  private async ensureCloudNodesBackfillColumns() {
    await this.ensureBackfillColumns("cloud_nodes", CLOUD_NODE_BACKFILL_COLUMNS);
  }

  // 계정 기반 영속화를 위해 최소 계정 레코드를 보장합니다.
  private async ensureCloudAccountShell(
    executor: Pool | PoolConnection,
    accountId: string
  ) {
    await executor.execute(
      `INSERT INTO cloud_accounts (account_id)
       VALUES (?)
       ON DUPLICATE KEY UPDATE account_id = VALUES(account_id)`,
      [accountId]
    );
  }

  // 정규화 테이블에서 프로젝트 스냅샷을 재구성합니다.
  private async readStructuredSnapshot(
    executor: Pool | PoolConnection,
    accountId: string,
    projectRow: CloudProjectRow,
    fallbackProject: StoryProject | null
  ): Promise<StoryWorkspaceSnapshot | null> {
    const project = mapProjectRowToProject(projectRow, fallbackProject);

    if (!project) {
      return null;
    }

    const projectId = projectRow.project_id;
    const [episodeRows] = await executor.query<CloudEpisodeRow[]>(
      `SELECT episode_id, title, objective, endpoint, created_at, updated_at
       FROM cloud_episodes
       WHERE account_id = ? AND project_id = ?
       ORDER BY created_at ASC, episode_id ASC`,
      [accountId, projectId]
    );
    const [objectRows] = await executor.query<CloudObjectRow[]>(
      `SELECT object_id, episode_id, category, name, summary, created_at, updated_at
       FROM cloud_objects
       WHERE account_id = ? AND project_id = ?
       ORDER BY created_at ASC, object_id ASC`,
      [accountId, projectId]
    );
    const [nodeRows] = await executor.query<CloudNodeRow[]>(
      `SELECT
         node_id,
         episode_id,
         parent_id,
         node_level,
         content_mode,
         text_value,
         is_collapsed,
         is_important,
         is_fixed,
         canvas_x,
         canvas_y,
         canvas_width,
         canvas_height,
         order_index,
         created_at,
         updated_at
       FROM cloud_nodes
       WHERE account_id = ? AND project_id = ?
       ORDER BY episode_id ASC, order_index ASC, created_at ASC, node_id ASC`,
      [accountId, projectId]
    );
    const [keywordRows] = await executor.query<CloudNodeKeywordRow[]>(
      `SELECT node_id, keyword_order, keyword_value
       FROM cloud_node_keywords
       WHERE account_id = ? AND project_id = ?
       ORDER BY node_id ASC, keyword_order ASC`,
      [accountId, projectId]
    );
    const [objectLinkRows] = await executor.query<CloudNodeObjectLinkRow[]>(
      `SELECT node_id, object_order, object_id
       FROM cloud_node_object_links
       WHERE account_id = ? AND project_id = ?
       ORDER BY node_id ASC, object_order ASC`,
      [accountId, projectId]
    );
    const [drawerRows] = await executor.query<CloudDrawerRow[]>(
      `SELECT drawer_item_id, episode_id, source_node_id, label, note, created_at, updated_at
       FROM cloud_temporary_drawer
       WHERE account_id = ? AND project_id = ?
       ORDER BY created_at ASC, drawer_item_id ASC`,
      [accountId, projectId]
    );

    if (
      episodeRows.length === 0 &&
      objectRows.length === 0 &&
      nodeRows.length === 0 &&
      drawerRows.length === 0
    ) {
      return null;
    }

    const keywordsByNodeId = new Map<EntityId, string[]>();
    for (const row of keywordRows) {
      const keywords = keywordsByNodeId.get(row.node_id) ?? [];
      keywords.push(row.keyword_value);
      keywordsByNodeId.set(row.node_id, keywords);
    }

    const objectIdsByNodeId = new Map<EntityId, string[]>();
    for (const row of objectLinkRows) {
      const objectIds = objectIdsByNodeId.get(row.node_id) ?? [];
      objectIds.push(row.object_id);
      objectIdsByNodeId.set(row.node_id, objectIds);
    }

    const snapshot: StoryWorkspaceSnapshot = {
      episodes: episodeRows.map((row) => ({
        createdAt: row.created_at,
        endpoint: row.endpoint,
        id: row.episode_id,
        objective: row.objective,
        projectId,
        title: row.title,
        updatedAt: row.updated_at
      })),
      nodes: nodeRows.map((row) => ({
        contentMode: row.content_mode as StoryNodeContentMode,
        createdAt: row.created_at,
        episodeId: row.episode_id,
        id: row.node_id,
        keywords: keywordsByNodeId.get(row.node_id) ?? [],
        level: row.node_level as StoryNodeLevel,
        objectIds: objectIdsByNodeId.get(row.node_id) ?? [],
        orderIndex: row.order_index,
        parentId: row.parent_id,
        projectId,
        text: row.text_value,
        updatedAt: row.updated_at,
        ...(row.is_collapsed === null ? {} : { isCollapsed: row.is_collapsed === 1 }),
        ...(row.is_fixed === null ? {} : { isFixed: row.is_fixed === 1 }),
        ...(row.is_important === null ? {} : { isImportant: row.is_important === 1 }),
        ...(row.canvas_x === null ? {} : { canvasX: Number(row.canvas_x) }),
        ...(row.canvas_y === null ? {} : { canvasY: Number(row.canvas_y) }),
        ...(row.canvas_width === null ? {} : { canvasWidth: Number(row.canvas_width) }),
        ...(row.canvas_height === null ? {} : { canvasHeight: Number(row.canvas_height) })
      })),
      objects: objectRows.map((row) => ({
        category: row.category as StoryObjectCategory,
        createdAt: row.created_at,
        episodeId: row.episode_id,
        id: row.object_id,
        name: row.name,
        projectId,
        summary: row.summary,
        updatedAt: row.updated_at
      })),
      project,
      temporaryDrawer: drawerRows.map((row) => ({
        createdAt: row.created_at,
        episodeId: row.episode_id,
        id: row.drawer_item_id,
        label: row.label,
        note: row.note,
        projectId,
        sourceNodeId: row.source_node_id,
        updatedAt: row.updated_at
      }))
    };

    return normalizeSnapshot(snapshot);
  }

  // 프로젝트 행에서 실제 저장 레코드(링키지+스냅샷)를 조립합니다.
  private async readStoredProjectRecord(
    executor: Pool | PoolConnection,
    accountId: string,
    row: CloudProjectRow
  ): Promise<StoredProjectRecord> {
    const legacyRecord = mapLegacyRowToRecord(row);
    const linkage = mapProjectRowToLinkage(row, accountId, legacyRecord?.linkage ?? null);
    const structuredSnapshot = await this.readStructuredSnapshot(
      executor,
      accountId,
      row,
      legacyRecord?.snapshot.project ?? null
    );
    const snapshot =
      structuredSnapshot ??
      (legacyRecord ? normalizeSnapshot(legacyRecord.snapshot) : null);

    if (!snapshot) {
      throw new Error("missing_project_snapshot");
    }

    return {
      linkage,
      snapshot
    };
  }

  // 정규화 테이블과 레거시 JSON 컬럼을 동시 갱신합니다.
  private async replaceProjectSnapshot(
    connection: PoolConnection,
    accountId: string,
    linkage: ProjectLinkageMetadata,
    snapshot: StoryWorkspaceSnapshot
  ) {
    const project = snapshot.project;

    await connection.execute(
      `INSERT INTO cloud_projects (
        account_id,
        project_id,
        project_title,
        project_summary,
        project_active_episode_id,
        project_created_at,
        project_updated_at,
        linkage_entity_id,
        linkage_cloud_linked,
        linkage_linked_account_id,
        linkage_last_imported_at,
        linkage_last_synced_at,
        linkage_json,
        snapshot_json
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      ON DUPLICATE KEY UPDATE
        project_title = VALUES(project_title),
        project_summary = VALUES(project_summary),
        project_active_episode_id = VALUES(project_active_episode_id),
        project_created_at = VALUES(project_created_at),
        project_updated_at = VALUES(project_updated_at),
        linkage_entity_id = VALUES(linkage_entity_id),
        linkage_cloud_linked = VALUES(linkage_cloud_linked),
        linkage_linked_account_id = VALUES(linkage_linked_account_id),
        linkage_last_imported_at = VALUES(linkage_last_imported_at),
        linkage_last_synced_at = VALUES(linkage_last_synced_at),
        linkage_json = VALUES(linkage_json),
        snapshot_json = VALUES(snapshot_json)`,
      [
        accountId,
        project.id,
        project.title,
        project.summary,
        project.activeEpisodeId,
        project.createdAt,
        project.updatedAt,
        linkage.entityId,
        linkage.cloudLinked ? 1 : 0,
        linkage.linkedAccountId,
        linkage.lastImportedAt,
        linkage.lastSyncedAt,
        JSON.stringify(linkage),
        JSON.stringify(snapshot)
      ]
    );

    await connection.execute(
      `DELETE FROM cloud_node_keywords
       WHERE account_id = ? AND project_id = ?`,
      [accountId, project.id]
    );
    await connection.execute(
      `DELETE FROM cloud_node_object_links
       WHERE account_id = ? AND project_id = ?`,
      [accountId, project.id]
    );
    await connection.execute(
      `DELETE FROM cloud_temporary_drawer
       WHERE account_id = ? AND project_id = ?`,
      [accountId, project.id]
    );
    await connection.execute(
      `DELETE FROM cloud_nodes
       WHERE account_id = ? AND project_id = ?`,
      [accountId, project.id]
    );
    await connection.execute(
      `DELETE FROM cloud_objects
       WHERE account_id = ? AND project_id = ?`,
      [accountId, project.id]
    );
    await connection.execute(
      `DELETE FROM cloud_episodes
       WHERE account_id = ? AND project_id = ?`,
      [accountId, project.id]
    );

    for (const episode of snapshot.episodes) {
      await connection.execute(
        `INSERT INTO cloud_episodes (
          account_id,
          project_id,
          episode_id,
          title,
          objective,
          endpoint,
          created_at,
          updated_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          accountId,
          project.id,
          episode.id,
          episode.title,
          episode.objective,
          episode.endpoint,
          episode.createdAt,
          episode.updatedAt
        ]
      );
    }

    for (const object of snapshot.objects) {
      await connection.execute(
        `INSERT INTO cloud_objects (
          account_id,
          project_id,
          object_id,
          episode_id,
          category,
          name,
          summary,
          created_at,
          updated_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          accountId,
          project.id,
          object.id,
          object.episodeId,
          object.category,
          object.name,
          object.summary,
          object.createdAt,
          object.updatedAt
        ]
      );
    }

    for (const node of snapshot.nodes) {
      await connection.execute(
        `INSERT INTO cloud_nodes (
          account_id,
          project_id,
          node_id,
          episode_id,
          parent_id,
          node_level,
          content_mode,
          text_value,
          is_collapsed,
          is_important,
          is_fixed,
          canvas_x,
          canvas_y,
          canvas_width,
          canvas_height,
          order_index,
          created_at,
          updated_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          accountId,
          project.id,
          node.id,
          node.episodeId,
          node.parentId,
          node.level,
          node.contentMode,
          node.text,
          toNullableTinyInt(node.isCollapsed),
          toNullableTinyInt(node.isImportant),
          toNullableTinyInt(node.isFixed),
          node.canvasX ?? null,
          node.canvasY ?? null,
          node.canvasWidth ?? null,
          node.canvasHeight ?? null,
          node.orderIndex,
          node.createdAt,
          node.updatedAt
        ]
      );

      for (const [keywordOrder, keyword] of node.keywords.entries()) {
        await connection.execute(
          `INSERT INTO cloud_node_keywords (
            account_id,
            project_id,
            node_id,
            keyword_order,
            keyword_value
          ) VALUES (?, ?, ?, ?, ?)`,
          [accountId, project.id, node.id, keywordOrder, keyword]
        );
      }

      for (const [objectOrder, objectId] of node.objectIds.entries()) {
        await connection.execute(
          `INSERT INTO cloud_node_object_links (
            account_id,
            project_id,
            node_id,
            object_order,
            object_id
          ) VALUES (?, ?, ?, ?, ?)`,
          [accountId, project.id, node.id, objectOrder, objectId]
        );
      }
    }

    for (const item of snapshot.temporaryDrawer) {
      await connection.execute(
        `INSERT INTO cloud_temporary_drawer (
          account_id,
          project_id,
          drawer_item_id,
          episode_id,
          source_node_id,
          label,
          note,
          created_at,
          updated_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          accountId,
          project.id,
          item.id,
          item.episodeId,
          item.sourceNodeId,
          item.label,
          item.note,
          item.createdAt,
          item.updatedAt
        ]
      );
    }
  }

  // 계정의 프로젝트 목록을 조회합니다.
  async listProjects(accountId: string): Promise<ListProjectsResponse> {
    await this.ensureSchema();
    const [rows] = await this.pool.query<CloudProjectRow[]>(
      `SELECT ${PROJECT_SELECT_COLUMNS}
       FROM cloud_projects
       WHERE account_id = ?`,
      [accountId]
    );

    const projects: GlobalProjectRegistryEntry[] = [];
    for (const row of rows) {
      const legacyRecord = mapLegacyRowToRecord(row);
      const project = mapProjectRowToProject(row, legacyRecord?.snapshot.project ?? null);

      if (!project) {
        continue;
      }

      const linkage = mapProjectRowToLinkage(row, accountId, legacyRecord?.linkage ?? null);
      projects.push({
        cloudLinked: linkage.cloudLinked,
        lastOpenedAt: project.updatedAt,
        linkedAccountId: linkage.linkedAccountId,
        projectId: project.id,
        summary: project.summary,
        title: project.title,
        updatedAt: project.updatedAt
      });
    }

    return { projects };
  }

  // 계정의 특정 프로젝트를 조회합니다.
  async getProject(accountId: string, projectId: EntityId): Promise<GetProjectResponse> {
    await this.ensureSchema();
    const [rows] = await this.pool.query<CloudProjectRow[]>(
      `SELECT ${PROJECT_SELECT_COLUMNS}
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

    const record = await this.readStoredProjectRecord(this.pool, accountId, rows[0]!);
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
    validateNodeGraphIntegrity(normalizedSnapshot);
    const projectId = normalizedSnapshot.project.id;
    const now = this.now();

    return withTransaction(this.pool, async (connection) => {
      await this.ensureCloudAccountShell(connection, accountId);
      const [existingRows] = await connection.query<CloudProjectRow[]>(
        `SELECT ${PROJECT_SELECT_COLUMNS}
         FROM cloud_projects
         WHERE account_id = ? AND project_id = ?
         LIMIT 1
         FOR UPDATE`,
        [accountId, projectId]
      );

      if (existingRows.length > 0) {
        const existingRecord = await this.readStoredProjectRecord(
          connection,
          accountId,
          existingRows[0]!
        );
        return {
          created: false,
          linkage: { ...existingRecord.linkage },
          snapshot: normalizeSnapshot(existingRecord.snapshot)
        };
      }

      const nextLinkage: ProjectLinkageMetadata = {
        cloudLinked: true,
        entityId: linkage?.entityId ?? projectId,
        lastImportedAt: now,
        lastSyncedAt: now,
        linkedAccountId: accountId
      };

      await this.replaceProjectSnapshot(
        connection,
        accountId,
        nextLinkage,
        normalizedSnapshot
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
      await this.ensureCloudAccountShell(connection, accountId);
      const [rows] = await connection.query<CloudProjectRow[]>(
        `SELECT ${PROJECT_SELECT_COLUMNS}
         FROM cloud_projects
         WHERE account_id = ? AND project_id = ?
         LIMIT 1
         FOR UPDATE`,
        [accountId, projectId]
      );

      if (rows.length === 0) {
        throw new Error("missing_project");
      }

      const record = await this.readStoredProjectRecord(connection, accountId, rows[0]!);
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
            case "episode": {
              const removedObjectIds = new Set(
                snapshot.objects
                  .filter((object) => object.episodeId === operation.entityId)
                  .map((object) => object.id)
              );
              snapshot = {
                ...snapshot,
                episodes: removeById(snapshot.episodes, operation.entityId),
                nodes: snapshot.nodes
                  .filter((node) => node.episodeId !== operation.entityId)
                  .map((node) => ({
                    ...node,
                    objectIds: node.objectIds.filter(
                      (objectId) => !removedObjectIds.has(objectId)
                    )
                  })),
                objects: snapshot.objects.filter(
                  (object) => object.episodeId !== operation.entityId
                ),
                temporaryDrawer: snapshot.temporaryDrawer.filter(
                  (item) => item.episodeId !== operation.entityId
                )
              };
              break;
            }
            case "object":
              snapshot = {
                ...snapshot,
                nodes: snapshot.nodes.map((node) => ({
                  ...node,
                  objectIds: node.objectIds.filter((objectId) => objectId !== operation.entityId)
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
            ensureObjectDependencies(snapshot, operation.payload);
            snapshot = {
              ...snapshot,
              objects: upsertById(snapshot.objects, operation.payload)
            };
            break;
          case "node":
            ensureProjectShell(snapshot, operation.payload.projectId);
            assertFreshNodeRevision(
              snapshot.nodes.find((entry) => entry.id === operation.payload.id),
              operation.payload
            );
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
      validateNodeGraphIntegrity(normalizedSnapshot);

      await this.replaceProjectSnapshot(
        connection,
        accountId,
        nextLinkage,
        normalizedSnapshot
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


