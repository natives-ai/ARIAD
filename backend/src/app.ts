// 이 파일은 백엔드 Fastify 앱을 조립하고 라우트를 등록합니다.

import Fastify from "fastify";

import type { MySqlConfig, PersistenceDriver } from "./config/env.js";
import { loadBackendEnv } from "./config/env.js";
import { registerPersistenceRoutes } from "./persistence/routes.js";
import { registerRecommendationRoutes } from "./recommendation/routes.js";

export interface BuildAppOptions {
  cloudDataDir?: string;
  mysql?: Partial<MySqlConfig>;
  persistenceDriver?: PersistenceDriver;
}

// 백엔드 API 앱 인스턴스를 생성합니다.
export function buildApp(options: BuildAppOptions = {}) {
  const app = Fastify({
    logger: false
  });

  const env = loadBackendEnv();

  void registerPersistenceRoutes(app, {
    cloudDataDir: options.cloudDataDir ?? env.cloudDataDir,
    mysql: {
      ...env.mysql,
      ...options.mysql
    },
    persistenceDriver: options.persistenceDriver ?? env.persistenceDriver
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
