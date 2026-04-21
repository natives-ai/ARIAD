export type BackendEnvironment = "local" | "dev" | "staging-like";

export interface BackendEnv {
  appEnv: BackendEnvironment;
  authCallbackPath: string;
  cloudDataDir: string;
  frontendOrigin: string;
  port: number;
}

function parseAppEnv(value: string | undefined): BackendEnvironment {
  if (value === "dev" || value === "staging-like") {
    return value;
  }

  return "local";
}

function parsePort(value: string | undefined): number {
  const parsed = Number(value);

  if (Number.isInteger(parsed) && parsed > 0) {
    return parsed;
  }

  return 3001;
}

export function loadBackendEnv(): BackendEnv {
  return {
    appEnv: parseAppEnv(process.env.APP_ENV),
    authCallbackPath: process.env.AUTH_CALLBACK_PATH ?? "/auth/callback",
    cloudDataDir: process.env.CLOUD_DATA_DIR ?? ".data",
    frontendOrigin: process.env.FRONTEND_ORIGIN ?? "http://127.0.0.1:5173",
    port: parsePort(process.env.PORT)
  };
}
