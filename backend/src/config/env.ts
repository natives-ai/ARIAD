// 이 파일은 백엔드 실행 환경 변수를 파싱하고 기본값을 제공합니다.

export type BackendEnvironment = "local" | "dev" | "staging-like";
export type PersistenceDriver = "file" | "mysql";

export interface MySqlConfig {
  database: string;
  host: string;
  password: string;
  port: number;
  user: string;
}

export interface BackendEnv {
  appEnv: BackendEnvironment;
  authCallbackPath: string;
  cloudDataDir: string;
  frontendOrigin: string;
  mysql: MySqlConfig;
  persistenceDriver: PersistenceDriver;
  port: number;
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
  return {
    appEnv: parseAppEnv(process.env.APP_ENV),
    authCallbackPath: process.env.AUTH_CALLBACK_PATH ?? "/auth/callback",
    cloudDataDir: process.env.CLOUD_DATA_DIR ?? ".data",
    frontendOrigin: process.env.FRONTEND_ORIGIN ?? "http://127.0.0.1:5173",
    mysql: parseMySqlConfig(),
    persistenceDriver: parsePersistenceDriver(process.env.PERSISTENCE_DRIVER),
    port: parsePositiveInteger(process.env.PORT, 3001)
  };
}
