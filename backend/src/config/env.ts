// 이 파일은 백엔드 실행 환경 변수를 파싱하고 기본값을 제공합니다.

import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";

import type { AuthCookieSameSite } from "../auth/cookie.js";
import type { BackendLogLevel } from "../logging/console.js";

export type BackendEnvironment = "local" | "dev" | "staging-like";
export type PersistenceDriver = "file" | "mysql";

export interface MySqlConfig {
  database: string;
  host: string;
  password: string;
  port: number;
  user: string;
}

export interface AuthEnv {
  cookieName: string;
  cookieSameSite: AuthCookieSameSite;
  cookieSecure: boolean;
  googleClientId: string | null;
  sessionTtlSeconds: number;
}

export interface BackendEnv {
  appEnv: BackendEnvironment;
  auth: AuthEnv;
  authCallbackPath: string;
  cloudDataDir: string;
  frontendOrigin: string;
  logLevel: BackendLogLevel;
  logRequests: boolean;
  mysql: MySqlConfig;
  mysqlReadinessTimeoutMs: number;
  persistenceDriver: PersistenceDriver;
  port: number;
}

let hasLoadedBackendEnvFiles = false;

// .env 파일을 process.env에 주입해 실행 환경을 구성합니다.
function loadBackendEnvFile(envPath: string) {
  if (!existsSync(envPath)) {
    return;
  }

  const fileContent = readFileSync(envPath, "utf8");
  const lines = fileContent.split("\n");

  for (const line of lines) {
    const trimmedLine = line.trim();

    if (!trimmedLine || trimmedLine.startsWith("#")) {
      continue;
    }

    const separatorIndex = trimmedLine.indexOf("=");
    if (separatorIndex <= 0) {
      continue;
    }

    const key = trimmedLine.slice(0, separatorIndex).trim();
    const rawValue = trimmedLine.slice(separatorIndex + 1).trim();
    const value = rawValue.replace(/^["']|["']$/g, "");

    if (!(key in process.env)) {
      process.env[key] = value;
    }
  }
}

// 백엔드 실행 전, backend/.env 또는 루트 .env를 로드해 source-of-truth를 통일합니다.
export function loadBackendEnvFiles() {
  if (hasLoadedBackendEnvFiles) {
    return;
  }

  hasLoadedBackendEnvFiles = true;
  const rootPath = process.cwd();
  const candidatePaths = [resolve(rootPath, "backend", ".env"), resolve(rootPath, ".env")];

  for (const candidate of candidatePaths) {
    loadBackendEnvFile(candidate);
  }
}

// APP_ENV 값을 허용된 환경 값으로 정규화합니다.
function parseAppEnv(value: string | undefined): BackendEnvironment {
  if (value === "dev" || value === "staging-like") {
    return value;
  }

  return "local";
}

// 숫자 문자열을 양의 정수로 변환하고 기본값을 적용합니다.
function parsePositiveInteger(value: string | undefined, fallback: number): number {
  const parsed = Number(value);

  if (Number.isInteger(parsed) && parsed > 0) {
    return parsed;
  }

  return fallback;
}

// 공백 문자열을 null로 변환해 선택형 환경 변수 값을 읽습니다.
function parseOptionalString(value: string | undefined): string | null {
  if (!value) {
    return null;
  }

  const trimmed = value.trim();
  if (trimmed.length === 0) {
    return null;
  }

  return trimmed;
}

// 로그 레벨 문자열을 허용된 값으로 정규화합니다.
function parseBackendLogLevel(value: string | undefined): BackendLogLevel {
  if (value === "debug" || value === "info" || value === "warn" || value === "error") {
    return value;
  }

  return "info";
}

// 불리언 형태의 환경 변수를 파싱합니다.
function parseBoolean(value: string | undefined, fallback: boolean) {
  if (value === undefined) {
    return fallback;
  }

  const normalized = value.trim().toLowerCase();

  if (normalized === "true" || normalized === "1" || normalized === "yes") {
    return true;
  }

  if (normalized === "false" || normalized === "0" || normalized === "no") {
    return false;
  }

  return fallback;
}

// SameSite 옵션 문자열을 허용된 값으로 파싱합니다.
function parseAuthCookieSameSite(value: string | undefined): AuthCookieSameSite {
  if (value === "strict" || value === "none") {
    return value;
  }

  return "lax";
}

// 영속화 드라이버 선택 값을 파싱합니다.
function parsePersistenceDriver(value: string | undefined): PersistenceDriver {
  if (value === "mysql") {
    return "mysql";
  }

  return "file";
}

// 로컬 MySQL 연결 설정을 환경 변수에서 구성합니다.
function parseMySqlConfig(): MySqlConfig {
  return {
    database: process.env.MYSQL_DATABASE ?? "scenaairo_local",
    host: process.env.MYSQL_HOST ?? "127.0.0.1",
    password: process.env.MYSQL_PASSWORD ?? "scenaairo",
    port: parsePositiveInteger(process.env.MYSQL_PORT, 3306),
    user: process.env.MYSQL_USER ?? "scenaairo"
  };
}

// 백엔드에서 사용하는 전체 환경 설정을 반환합니다.
export function loadBackendEnv(): BackendEnv {
  const appEnv = parseAppEnv(process.env.APP_ENV);

  return {
    appEnv,
    auth: {
      cookieName: process.env.AUTH_SESSION_COOKIE_NAME ?? "scenaairo_session",
      cookieSameSite: parseAuthCookieSameSite(process.env.AUTH_COOKIE_SAME_SITE),
      cookieSecure: parseBoolean(process.env.AUTH_COOKIE_SECURE, appEnv !== "local"),
      googleClientId: parseOptionalString(process.env.GOOGLE_CLIENT_ID),
      sessionTtlSeconds: parsePositiveInteger(process.env.AUTH_SESSION_TTL_SECONDS, 60 * 60 * 24 * 30)
    },
    authCallbackPath: process.env.AUTH_CALLBACK_PATH ?? "/auth/callback",
    cloudDataDir: process.env.CLOUD_DATA_DIR ?? ".data",
    frontendOrigin: process.env.FRONTEND_ORIGIN ?? "http://127.0.0.1:5173",
    logLevel: parseBackendLogLevel(process.env.BACKEND_LOG_LEVEL),
    logRequests: parseBoolean(process.env.BACKEND_LOG_REQUESTS, true),
    mysql: parseMySqlConfig(),
    mysqlReadinessTimeoutMs: parsePositiveInteger(process.env.MYSQL_READINESS_TIMEOUT_MS, 1500),
    persistenceDriver: parsePersistenceDriver(process.env.PERSISTENCE_DRIVER),
    port: parsePositiveInteger(process.env.PORT, 3001)
  };
}
