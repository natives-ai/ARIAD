import type { FastifyInstance } from "fastify";
import type {
  ImportProjectRequest,
  SyncProjectRequest
} from "@scenaairo/shared";

import { FileBackedPersistenceStore } from "./store.js";

interface RegisterPersistenceRoutesOptions {
  cloudDataDir: string;
}

export async function registerPersistenceRoutes(
  app: FastifyInstance,
  options: RegisterPersistenceRoutesOptions
) {
  const store = new FileBackedPersistenceStore({
    cloudDataDir: options.cloudDataDir
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
        return reply.status(400).send({
          message: error instanceof Error ? error.message : "sync_failed"
        });
      }
    }
  );
}
