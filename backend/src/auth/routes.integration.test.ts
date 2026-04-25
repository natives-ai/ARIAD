// 이 파일은 인증 라우트와 퍼시스턴스 세션 가드의 통합 동작을 검증합니다.

import { mkdtemp, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";

import { afterEach, describe, expect, it } from "vitest";

import { buildApp } from "../app.js";
import { FileBackedPersistenceStore } from "../persistence/store.js";
import type { AuthStore } from "./service.js";
import type { VerifiedGoogleIdentity } from "./google-id-token.js";

const authEnvKeys = [
  "GOOGLE_CLIENT_ID"
] as const;

interface StoredSession {
  accountId: string;
  displayName: string;
  expiresAt: Date;
  revokedAt: Date | null;
  sessionId: string;
}

// 테스트용 인증 저장소를 메모리로 구현합니다.
class InMemoryAuthStore implements AuthStore {
  private readonly sessions = new Map<string, StoredSession>();

  private sessionSequence = 0;

  // 테스트 종료 시 정리할 리소스가 없어 no-op으로 처리합니다.
  async close() {
    return;
  }

  // 로그인 계정에 대한 새 세션을 메모리에 발급합니다.
  async createSession(
    accountId: string,
    sessionTtlSeconds: number,
    _userAgent: string | null,
    now: Date
  ) {
    this.sessionSequence += 1;
    const sessionId = `session_${this.sessionSequence}`;
    const expiresAt = new Date(now.getTime() + Math.max(sessionTtlSeconds, 1) * 1000);

    this.sessions.set(sessionId, {
      accountId,
      displayName: "Google Tester",
      expiresAt,
      revokedAt: null,
      sessionId
    });

    return {
      expiresAt,
      sessionId
    };
  }

  // 세션 ID로 활성 세션을 조회합니다.
  async getActiveSession(sessionId: string, now: Date) {
    const session = this.sessions.get(sessionId);
    if (!session) {
      return null;
    }

    if (session.revokedAt !== null) {
      return null;
    }

    if (session.expiresAt.getTime() <= now.getTime()) {
      return null;
    }

    return {
      accountId: session.accountId,
      displayName: session.displayName,
      sessionId: session.sessionId
    };
  }

  // 세션을 로그아웃 상태로 표시합니다.
  async revokeSession(sessionId: string, now: Date) {
    const current = this.sessions.get(sessionId);
    if (!current || current.revokedAt !== null) {
      return;
    }

    this.sessions.set(sessionId, {
      ...current,
      revokedAt: now
    });
  }

  // Google identity를 내부 account 규칙으로 매핑합니다.
  async upsertGoogleAccount(identity: VerifiedGoogleIdentity) {
    return {
      accountId: `google:${identity.sub}`,
      displayName: identity.name ?? "Google Tester"
    };
  }
}

// Set-Cookie 헤더에서 cookie name=value 페어를 추출합니다.
function extractCookiePair(setCookieHeader: string | string[] | undefined) {
  if (!setCookieHeader) {
    return null;
  }

  const firstCookie = Array.isArray(setCookieHeader) ? setCookieHeader[0] : setCookieHeader;
  if (!firstCookie) {
    return null;
  }

  return firstCookie.split(";")[0] ?? null;
}

// canonical 퍼시스턴스 테스트용 임시 파일 저장소를 생성합니다.
async function createTemporaryPersistenceStore(temporaryDirs: string[]) {
  const cloudDataDir = await mkdtemp(path.join(os.tmpdir(), "scenaairo-auth-persistence-"));
  temporaryDirs.push(cloudDataDir);
  return new FileBackedPersistenceStore({
    cloudDataDir
  });
}

describe("auth routes integration", () => {
  const appsToClose: ReturnType<typeof buildApp>[] = [];
  const temporaryDirs: string[] = [];
  const initialAuthEnv = Object.fromEntries(
    authEnvKeys.map((key) => [key, process.env[key]])
  ) as Record<(typeof authEnvKeys)[number], string | undefined>;

  afterEach(async () => {
    await Promise.all(appsToClose.map((app) => app.close()));
    appsToClose.length = 0;
    await Promise.all(
      temporaryDirs.map((directory) =>
        rm(directory, {
          force: true,
          recursive: true
        })
      )
    );
    temporaryDirs.length = 0;

    for (const key of authEnvKeys) {
      const value = initialAuthEnv[key];
      if (value === undefined) {
        delete process.env[key];
        continue;
      }
      process.env[key] = value;
    }
  });

  it("returns guest session when no auth cookie is provided", async () => {
    const app = buildApp({
      authStore: new InMemoryAuthStore(),
      googleIdTokenVerifier: async () => {
        throw new Error("should_not_be_called");
      }
    });
    appsToClose.push(app);
    await app.ready();

    const response = await app.inject({
      method: "GET",
      url: "/api/auth/session"
    });

    expect(response.statusCode).toBe(200);
    expect(response.json()).toEqual({
      accountId: null,
      displayName: "Guest Creator",
      mode: "guest"
    });
  });

  it("logs in with a google credential and keeps session via cookie", async () => {
    const app = buildApp({
      authStore: new InMemoryAuthStore(),
      googleIdTokenVerifier: async () => ({
        email: "creator@example.com",
        name: "Creator One",
        picture: null,
        sub: "sub_001"
      })
    });
    appsToClose.push(app);
    await app.ready();

    const loginResponse = await app.inject({
      method: "POST",
      payload: {
        credential: "mock-google-credential"
      },
      url: "/api/auth/google/login"
    });

    expect(loginResponse.statusCode).toBe(200);
    expect(loginResponse.json()).toEqual({
      accountId: "google:sub_001",
      displayName: "Creator One",
      mode: "authenticated"
    });

    const cookiePair = extractCookiePair(loginResponse.headers["set-cookie"]);
    expect(cookiePair).toBeTruthy();

    const sessionResponse = await app.inject({
      headers: {
        cookie: cookiePair as string
      },
      method: "GET",
      url: "/api/auth/session"
    });

    expect(sessionResponse.statusCode).toBe(200);
    expect(sessionResponse.json()).toEqual({
      accountId: "google:sub_001",
      displayName: "Google Tester",
      mode: "authenticated"
    });
  });

  it("revokes the current session on logout", async () => {
    const app = buildApp({
      authStore: new InMemoryAuthStore(),
      googleIdTokenVerifier: async () => ({
        email: "creator@example.com",
        name: "Creator One",
        picture: null,
        sub: "sub_001"
      })
    });
    appsToClose.push(app);
    await app.ready();

    const loginResponse = await app.inject({
      method: "POST",
      payload: {
        credential: "mock-google-credential"
      },
      url: "/api/auth/google/login"
    });
    const cookiePair = extractCookiePair(loginResponse.headers["set-cookie"]);
    expect(cookiePair).toBeTruthy();

    const logoutResponse = await app.inject({
      headers: {
        cookie: cookiePair as string
      },
      method: "POST",
      url: "/api/auth/logout"
    });

    expect(logoutResponse.statusCode).toBe(200);
    expect(logoutResponse.json()).toEqual({
      accountId: null,
      displayName: "Guest Creator",
      mode: "guest"
    });

    const sessionAfterLogout = await app.inject({
      headers: {
        cookie: cookiePair as string
      },
      method: "GET",
      url: "/api/auth/session"
    });

    expect(sessionAfterLogout.statusCode).toBe(200);
    expect(sessionAfterLogout.json()).toEqual({
      accountId: null,
      displayName: "Guest Creator",
      mode: "guest"
    });
  });

  it("blocks accountId path mismatch when session account exists", async () => {
    const app = buildApp({
      authStore: new InMemoryAuthStore(),
      googleIdTokenVerifier: async () => ({
        email: "creator@example.com",
        name: "Creator One",
        picture: null,
        sub: "sub_001"
      })
    });
    appsToClose.push(app);
    await app.ready();

    const loginResponse = await app.inject({
      method: "POST",
      payload: {
        credential: "mock-google-credential"
      },
      url: "/api/auth/google/login"
    });
    const cookiePair = extractCookiePair(loginResponse.headers["set-cookie"]);
    expect(cookiePair).toBeTruthy();

    const mismatchResponse = await app.inject({
      headers: {
        cookie: cookiePair as string
      },
      method: "GET",
      url: "/api/persistence/accounts/demo-account/projects"
    });

    expect(mismatchResponse.statusCode).toBe(403);
    expect(mismatchResponse.json()).toEqual({
      message: "account_mismatch"
    });
  });

  it("requires authentication for canonical persistence routes", async () => {
    const app = buildApp({
      authStore: new InMemoryAuthStore(),
      googleIdTokenVerifier: async () => ({
        email: "creator@example.com",
        name: "Creator One",
        picture: null,
        sub: "sub_001"
      })
    });
    appsToClose.push(app);
    await app.ready();

    const response = await app.inject({
      method: "GET",
      url: "/api/persistence/projects"
    });

    expect(response.statusCode).toBe(401);
    expect(response.json()).toEqual({
      message: "authentication_required"
    });
  });

  it("returns an empty canonical project list for a new authenticated account", async () => {
    const mysqlStore = await createTemporaryPersistenceStore(temporaryDirs);
    const app = buildApp({
      authStore: new InMemoryAuthStore(),
      googleIdTokenVerifier: async () => ({
        email: "new-creator@example.com",
        name: "New Creator",
        picture: null,
        sub: "sub_new_001"
      }),
      persistenceStoreFactories: {
        createMySqlStore: () => mysqlStore
      }
    });
    appsToClose.push(app);
    await app.ready();

    const loginResponse = await app.inject({
      method: "POST",
      payload: {
        credential: "mock-google-credential"
      },
      url: "/api/auth/google/login"
    });
    const cookiePair = extractCookiePair(loginResponse.headers["set-cookie"]);
    expect(cookiePair).toBeTruthy();

    const projectsResponse = await app.inject({
      headers: {
        cookie: cookiePair as string
      },
      method: "GET",
      url: "/api/persistence/projects"
    });

    expect(projectsResponse.statusCode).toBe(200);
    expect(projectsResponse.json()).toEqual({
      projects: []
    });
  });

  it("returns google_auth_not_configured when GOOGLE_CLIENT_ID is missing", async () => {
    delete process.env.GOOGLE_CLIENT_ID;

    const app = buildApp({
      authStore: new InMemoryAuthStore()
    });
    appsToClose.push(app);
    await app.ready();

    const response = await app.inject({
      method: "POST",
      payload: {
        credential: "dummy"
      },
      url: "/api/auth/google/login"
    });

    expect(response.statusCode).toBe(500);
    expect(response.json()).toEqual({
      message: "google_auth_not_configured"
    });
  });

  it("returns google_token_verification_failed when token verification fails", async () => {
    process.env.GOOGLE_CLIENT_ID = "test-client-id.apps.googleusercontent.com";

    const app = buildApp({
      authStore: new InMemoryAuthStore(),
      googleIdTokenVerifier: async () => {
        throw new Error("invalid_google_token");
      }
    });
    appsToClose.push(app);
    await app.ready();

    const response = await app.inject({
      method: "POST",
      payload: {
        credential: "invalid-token"
      },
      url: "/api/auth/google/login"
    });

    expect(response.statusCode).toBe(401);
    expect(response.json()).toEqual({
      message: "google_token_verification_failed"
    });
  });
});
