// 이 파일은 백엔드 서버 프로세스를 시작하고 실행 로그를 남깁니다.

import { pathToFileURL } from "node:url";

import { buildApp } from "./app.js";
import { loadBackendEnv, loadBackendEnvFiles } from "./config/env.js";
import { createBackendLogger } from "./logging/console.js";

// 백엔드 서버를 시작하고 주요 실행 상태를 기록합니다.
async function startServer() {
  loadBackendEnvFiles();
  const env = loadBackendEnv();
  const logger = createBackendLogger({
    level: env.logLevel,
    scope: "server"
  });
  const app = buildApp();

  logger.info("backend_starting", {
    googleAuthConfigured: env.auth.googleClientId !== null,
    host: env.host,
    logLevel: env.logLevel,
    persistenceDriver: env.persistenceDriver,
    port: env.port,
    requestLogging: env.logRequests
  });

  if (env.auth.googleClientId === null) {
    logger.warn("google_auth_not_configured", {
      endpoint: "/api/auth/google/login",
      hint: "Set GOOGLE_CLIENT_ID in backend/.env"
    });
  }

  try {
    await app.listen({
      host: env.host,
      port: env.port
    });
    logger.info("backend_listening", {
      persistenceDriver: env.persistenceDriver,
      url: `http://${env.host}:${env.port}`
    });
  } catch (error) {
    if (error instanceof Error) {
      logger.error("backend_start_failed", {
        message: error.message,
        port: env.port
      });
    } else {
      logger.error("backend_start_failed", {
        message: "unknown_error",
        port: env.port
      });
    }
    process.exit(1);
  }
}

const entryPath = process.argv[1];
const isMain = entryPath ? import.meta.url === pathToFileURL(entryPath).href : false;

if (isMain) {
  void startServer();
}
