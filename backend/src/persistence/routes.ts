// 이 파일은 영속화 API 라우트를 등록하고 저장소 구현을 선택합니다.

import type { FastifyInstance } from "fastify";
import type {
  ImportProjectRequest,
  SyncProjectRequest
} from "@scenaairo/shared";

import type { MySqlConfig, PersistenceDriver } from "../config/env.js";
import { MySqlBackedPersistenceStore } from "./mysql-store.js";
import { FileBackedPersistenceStore } from "./store.js";

interface RegisterPersistenceRoutesOptions {
  cloudDataDir: string;
  mysql: MySqlConfig;
  persistenceDriver: PersistenceDriver;
}

interface PersistenceStore {
  getProject(accountId: string, projectId: string): ReturnType<FileBackedPersistenceStore["getProject"]>;
  importProject: FileBackedPersistenceStore["importProject"];
  listProjects: FileBackedPersistenceStore["listProjects"];
  syncProject: FileBackedPersistenceStore["syncProject"];
  close?: () => Promise<void>;
}

// 동기화 오류 메시지에 따라 HTTP 상태 코드를 결정합니다.
function resolveSyncErrorStatus(message: string) {
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

// 설정에 맞춰 파일/DB 영속화 저장소를 생성합니다.
function createPersistenceStore(options: RegisterPersistenceRoutesOptions): PersistenceStore {
  if (options.persistenceDriver === "mysql") {
    return new MySqlBackedPersistenceStore({
      database: options.mysql.database,
      host: options.mysql.host,
      password: options.mysql.password,
      port: options.mysql.port,
      user: options.mysql.user
    });
  }

  return new FileBackedPersistenceStore({
    cloudDataDir: options.cloudDataDir
  });
}

// 백엔드 영속화 API 엔드포인트를 Fastify에 등록합니다.
export async function registerPersistenceRoutes(
  app: FastifyInstance,
  options: RegisterPersistenceRoutesOptions
) {
  const store = createPersistenceStore(options);

  app.addHook("onClose", async () => {
    if (store.close) {
      await store.close();
    }
  });

  app.get("/api/persistence/accounts/:accountId/projects", async (request) => {
    const params = request.params as { accountId: string };
    return store.listProjects(params.accountId);
  });

  app.get("/api/persistence/accounts/:accountId/projects/:projectId", async (request) => {
    const params = request.params as { accountId: string; projectId: string };
    return store.getProject(params.accountId, params.projectId);
  });

  app.post("/api/persistence/accounts/:accountId/import", async (request, reply) => {
    const params = request.params as { accountId: string };
    const body = request.body as ImportProjectRequest;

    if (!body?.snapshot) {
      return reply.status(400).send({
        message: "snapshot is required"
      });
    }

    return store.importProject(params.accountId, body.snapshot, body.linkage);
  });

  app.post(
    "/api/persistence/accounts/:accountId/projects/:projectId/sync",
    async (request, reply) => {
      const params = request.params as { accountId: string; projectId: string };
      const body = request.body as SyncProjectRequest;

      if (!body?.operations) {
        return reply.status(400).send({
          message: "operations are required"
        });
      }

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
}
