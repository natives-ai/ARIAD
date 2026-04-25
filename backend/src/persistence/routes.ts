// 이 파일은 퍼시스턴스 API를 등록하고 인증 세션 기반 접근 제어를 적용합니다.

import type { FastifyInstance, FastifyReply, FastifyRequest } from "fastify";
import type {
  ImportProjectRequest,
  SyncProjectRequest
} from "@scenaairo/shared";

import type { MySqlConfig, PersistenceDriver } from "../config/env.js";
import { MySqlBackedPersistenceStore } from "./mysql-store.js";
import { FileBackedPersistenceStore } from "./store.js";

interface RegisterPersistenceRoutesOptions {
  cloudDataDir: string;
  createGuestStore?: () => PersistenceStore;
  createMySqlStore?: () => PersistenceStore;
  mysql: MySqlConfig;
  persistenceDriver: PersistenceDriver;
  resolveSessionAccountId?: (request: FastifyRequest) => Promise<string | null>;
}

export interface PersistenceStore {
  close?: () => Promise<void>;
  getProject(accountId: string, projectId: string): ReturnType<FileBackedPersistenceStore["getProject"]>;
  importProject: FileBackedPersistenceStore["importProject"];
  listProjects: FileBackedPersistenceStore["listProjects"];
  syncProject: FileBackedPersistenceStore["syncProject"];
}

// 동기화/권한 오류 메시지에 따라 HTTP 상태 코드를 결정합니다.
function resolveSyncErrorStatus(message: string) {
  if (message === "authentication_required") {
    return 401;
  }

  if (message === "account_mismatch") {
    return 403;
  }

  if (message === "missing_project") {
    return 404;
  }

  if (message === "stale_node_revision") {
    return 409;
  }

  const validationErrorMessages = new Set([
    "duplicate_node_id",
    "drawer_episode_mismatch",
    "invalid_node_cycle",
    "invalid_parent_level",
    "invalid_parent_node_dependency",
    "missing_drawer_node_dependency",
    "missing_episode_dependency",
    "missing_object_dependency",
    "missing_parent_node_dependency",
    "node_project_mismatch",
    "object_episode_project_mismatch",
    "object_project_mismatch",
    "parent_episode_mismatch",
    "parent_project_mismatch",
    "project_mismatch"
  ]);

  if (validationErrorMessages.has(message)) {
    return 422;
  }

  return 400;
}

// 요청에서 세션 accountId를 조회합니다.
async function resolveSessionAccountId(
  request: FastifyRequest,
  options: RegisterPersistenceRoutesOptions
) {
  if (!options.resolveSessionAccountId) {
    return null;
  }

  return options.resolveSessionAccountId(request);
}

// 경로 accountId와 세션 accountId 불일치를 검사합니다.
async function ensureAccountScope(
  request: FastifyRequest,
  reply: FastifyReply,
  options: RegisterPersistenceRoutesOptions,
  pathAccountId: string
) {
  const sessionAccountId = await resolveSessionAccountId(request, options);

  if (sessionAccountId && sessionAccountId !== pathAccountId) {
    await reply.status(403).send({
      message: "account_mismatch"
    });
    return null;
  }

  return sessionAccountId;
}

// 보호 라우트에서 인증된 accountId를 강제합니다.
async function requireAuthenticatedAccount(
  request: FastifyRequest,
  reply: FastifyReply,
  options: RegisterPersistenceRoutesOptions
) {
  const sessionAccountId = await resolveSessionAccountId(request, options);

  if (!sessionAccountId) {
    await reply.status(401).send({
      message: "authentication_required"
    });
    return null;
  }

  return sessionAccountId;
}

// 기본 드라이버/세션 상태에 따라 사용할 저장소를 선택합니다.
function resolvePersistenceStore(
  guestStore: PersistenceStore,
  mysqlStore: PersistenceStore,
  options: RegisterPersistenceRoutesOptions,
  sessionAccountId: string | null
) {
  if (sessionAccountId) {
    return mysqlStore;
  }

  if (options.persistenceDriver === "mysql") {
    return mysqlStore;
  }

  return guestStore;
}

// legacy accountId 경로 응답에 canonical 경로 안내 헤더를 추가합니다.
function markLegacyPersistenceRoute(reply: FastifyReply) {
  reply.header("Deprecation", "true");
  reply.header("Link", '</api/persistence/projects>; rel="successor-version"');
}

// 백엔드 퍼시스턴스 API 엔드포인트를 Fastify에 등록합니다.
export async function registerPersistenceRoutes(
  app: FastifyInstance,
  options: RegisterPersistenceRoutesOptions
) {
  const guestStore =
    options.createGuestStore?.() ??
    new FileBackedPersistenceStore({
      cloudDataDir: options.cloudDataDir
    });
  const mysqlStore =
    options.createMySqlStore?.() ??
    new MySqlBackedPersistenceStore({
      database: options.mysql.database,
      host: options.mysql.host,
      password: options.mysql.password,
      port: options.mysql.port,
      user: options.mysql.user
    });

  app.addHook("onClose", async () => {
    const stores = new Set<PersistenceStore>([guestStore, mysqlStore]);
    await Promise.all(
      [...stores].map(async (store) => {
        if (store.close) {
          await store.close();
        }
      })
    );
  });

  app.get("/api/persistence/accounts/:accountId/projects", async (request, reply) => {
    markLegacyPersistenceRoute(reply);
    const params = request.params as { accountId: string };
    const sessionAccountId = await ensureAccountScope(request, reply, options, params.accountId);

    if (sessionAccountId === null && reply.sent) {
      return;
    }

    const store = resolvePersistenceStore(guestStore, mysqlStore, options, sessionAccountId);
    return store.listProjects(params.accountId);
  });

  app.get("/api/persistence/accounts/:accountId/projects/:projectId", async (request, reply) => {
    markLegacyPersistenceRoute(reply);
    const params = request.params as { accountId: string; projectId: string };
    const sessionAccountId = await ensureAccountScope(request, reply, options, params.accountId);

    if (sessionAccountId === null && reply.sent) {
      return;
    }

    const store = resolvePersistenceStore(guestStore, mysqlStore, options, sessionAccountId);
    return store.getProject(params.accountId, params.projectId);
  });

  app.post("/api/persistence/accounts/:accountId/import", async (request, reply) => {
    markLegacyPersistenceRoute(reply);
    const params = request.params as { accountId: string };
    const body = request.body as ImportProjectRequest;

    if (!body?.snapshot) {
      return reply.status(400).send({
        message: "snapshot is required"
      });
    }

    const sessionAccountId = await ensureAccountScope(request, reply, options, params.accountId);
    if (sessionAccountId === null && reply.sent) {
      return;
    }

    const store = resolvePersistenceStore(guestStore, mysqlStore, options, sessionAccountId);
    return store.importProject(params.accountId, body.snapshot, body.linkage);
  });

  app.post(
    "/api/persistence/accounts/:accountId/projects/:projectId/sync",
    async (request, reply) => {
      markLegacyPersistenceRoute(reply);
      const params = request.params as { accountId: string; projectId: string };
      const body = request.body as SyncProjectRequest;

      if (!body?.operations) {
        return reply.status(400).send({
          message: "operations are required"
        });
      }

      const sessionAccountId = await ensureAccountScope(request, reply, options, params.accountId);
      if (sessionAccountId === null && reply.sent) {
        return;
      }

      const store = resolvePersistenceStore(guestStore, mysqlStore, options, sessionAccountId);
      try {
        return await store.syncProject(params.accountId, params.projectId, body.operations);
      } catch (error) {
        const message = error instanceof Error ? error.message : "sync_failed";
        return reply.status(resolveSyncErrorStatus(message)).send({
          message
        });
      }
    }
  );

  app.get("/api/persistence/projects", async (request, reply) => {
    const accountId = await requireAuthenticatedAccount(request, reply, options);
    if (!accountId) {
      return;
    }

    return mysqlStore.listProjects(accountId);
  });

  app.get("/api/persistence/projects/:projectId", async (request, reply) => {
    const accountId = await requireAuthenticatedAccount(request, reply, options);
    if (!accountId) {
      return;
    }

    const params = request.params as { projectId: string };
    return mysqlStore.getProject(accountId, params.projectId);
  });

  app.post("/api/persistence/import", async (request, reply) => {
    const accountId = await requireAuthenticatedAccount(request, reply, options);
    if (!accountId) {
      return;
    }

    const body = request.body as ImportProjectRequest;
    if (!body?.snapshot) {
      return reply.status(400).send({
        message: "snapshot is required"
      });
    }

    return mysqlStore.importProject(accountId, body.snapshot, body.linkage);
  });

  app.post("/api/persistence/projects/:projectId/sync", async (request, reply) => {
    const accountId = await requireAuthenticatedAccount(request, reply, options);
    if (!accountId) {
      return;
    }

    const params = request.params as { projectId: string };
    const body = request.body as SyncProjectRequest;
    if (!body?.operations) {
      return reply.status(400).send({
        message: "operations are required"
      });
    }

    try {
      return await mysqlStore.syncProject(accountId, params.projectId, body.operations);
    } catch (error) {
      const message = error instanceof Error ? error.message : "sync_failed";
      return reply.status(resolveSyncErrorStatus(message)).send({
        message
      });
    }
  });
}
