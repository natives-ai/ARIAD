import type { PersistenceMode } from "../types/persistence.js";

export interface AuthSession {
  accountId: string | null;
  displayName: string;
  mode: PersistenceMode;
}

export interface AuthCallbackSnapshot {
  code: string | null;
  state: string | null;
}
