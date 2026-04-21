import type { AuthSession } from "@scenaairo/shared";

const SESSION_KEY = "auth-session";
const defaultGuestSession: AuthSession = {
  accountId: null,
  displayName: "Guest Creator",
  mode: "guest"
};

export interface StorageLike {
  getItem(key: string): string | null;
  removeItem(key: string): void;
  setItem(key: string, value: string): void;
}

type AuthListener = (session: AuthSession) => void;

export class StubAuthBoundary {
  private readonly listeners = new Set<AuthListener>();

  private readonly sessionKey: string;

  constructor(private readonly storage: StorageLike, storagePrefix: string) {
    this.sessionKey = `${storagePrefix}:${SESSION_KEY}`;
  }

  async getCurrentSession(): Promise<AuthSession> {
    const saved = this.storage.getItem(this.sessionKey);

    if (!saved) {
      return defaultGuestSession;
    }

    return JSON.parse(saved) as AuthSession;
  }

  onAuthStateChange(listener: AuthListener) {
    this.listeners.add(listener);

    return () => {
      this.listeners.delete(listener);
    };
  }

  async signIn(): Promise<AuthSession> {
    const session: AuthSession = {
      accountId: "demo-account",
      displayName: "Demo Creator",
      mode: "authenticated"
    };

    this.storage.setItem(this.sessionKey, JSON.stringify(session));
    this.notify(session);
    return session;
  }

  async signOut(): Promise<AuthSession> {
    this.storage.setItem(this.sessionKey, JSON.stringify(defaultGuestSession));
    this.notify(defaultGuestSession);
    return defaultGuestSession;
  }

  private notify(session: AuthSession) {
    for (const listener of this.listeners) {
      listener(session);
    }
  }
}
