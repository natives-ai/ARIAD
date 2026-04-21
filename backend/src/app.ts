import Fastify from "fastify";

import { loadBackendEnv } from "./config/env.js";
import { registerPersistenceRoutes } from "./persistence/routes.js";
import { registerRecommendationRoutes } from "./recommendation/routes.js";

export interface BuildAppOptions {
  cloudDataDir?: string;
}

export function buildApp(options: BuildAppOptions = {}) {
  const app = Fastify({
    logger: false
  });

  const env = loadBackendEnv();

  void registerPersistenceRoutes(app, {
    cloudDataDir: options.cloudDataDir ?? env.cloudDataDir
  });
  void registerRecommendationRoutes(app);

  app.get("/api/health", async () => {
    return {
      environment: env.appEnv,
      service: "backend" as const,
      status: "ok" as const
    };
  });

  return app;
}
