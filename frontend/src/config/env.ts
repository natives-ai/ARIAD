import { detectFrontendRuntimeMode, type FrontendRuntimeMode } from "../runtime";

export type FrontendEnvironment = "local" | "dev" | "staging-like";

export interface FrontendEnv {
  apiBaseUrl: string;
  appEnv: FrontendEnvironment;
  authCallbackPath: string;
  runtimeMode: FrontendRuntimeMode;
  storagePrefix: string;
}

function parseAppEnv(value: string | undefined): FrontendEnvironment {
  if (value === "dev" || value === "staging-like") {
    return value;
  }

  return "local";
}

export function loadFrontendEnv(): FrontendEnv {
  const runtimeMode = detectFrontendRuntimeMode();

  return {
    apiBaseUrl:
      runtimeMode === "standalone"
        ? "__standalone__"
        : import.meta.env.VITE_API_BASE_URL ?? "/api",
    appEnv: parseAppEnv(import.meta.env.VITE_APP_ENV),
    authCallbackPath: import.meta.env.VITE_AUTH_CALLBACK_PATH ?? "/auth/callback",
    runtimeMode,
    storagePrefix: import.meta.env.VITE_STORAGE_PREFIX ?? "ARIAD"
  };
}
