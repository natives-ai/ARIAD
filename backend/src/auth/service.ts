// 이 파일은 Google 로그인, 세션 조회, 로그아웃을 조합하는 인증 서비스 레이어를 제공합니다.

import type { AuthSession } from "@scenaairo/shared";

import type { MySqlConfig } from "../config/env.js";
import {
  buildClearedSessionCookie,
  buildSessionCookie,
  getCookieValue,
  type AuthCookieSameSite
} from "./cookie.js";
import {
  createGoogleIdTokenVerifier,
  type GoogleIdTokenVerifier,
  type VerifiedGoogleIdentity
} from "./google-id-token.js";
import { MySqlAuthStore } from "./store.js";

interface UpsertedGoogleAccount {
  accountId: string;
  displayName: string;
}

interface CreatedSessionRecord {
  expiresAt: Date;
  sessionId: string;
}

interface ActiveSessionRecord {
  accountId: string;
  displayName: string;
  sessionId: string;
}

export interface AuthStore {
  close(): Promise<void>;
  createSession(
    accountId: string,
    sessionTtlSeconds: number,
    userAgent: string | null,
    now: Date
  ): Promise<CreatedSessionRecord>;
  getActiveSession(sessionId: string, now: Date): Promise<ActiveSessionRecord | null>;
  revokeSession(sessionId: string, now: Date): Promise<void>;
  upsertGoogleAccount(identity: VerifiedGoogleIdentity): Promise<UpsertedGoogleAccount>;
}

interface CreateBackendAuthServiceOptions {
  cookieName: string;
  cookieSameSite: AuthCookieSameSite;
  cookieSecure: boolean;
  googleClientId: string | null;
  mysql: MySqlConfig;
  now?: () => Date;
  store?: AuthStore;
  tokenVerifier?: GoogleIdTokenVerifier;
  sessionTtlSeconds: number;
}

interface AuthServiceCookieOptions {
  cookieName: string;
  sameSite: AuthCookieSameSite;
  secure: boolean;
}

export interface AuthServiceSessionSnapshot {
  accountId: string | null;
  session: AuthSession;
  sessionId: string | null;
  shouldClearCookie: boolean;
}

export interface GoogleLoginResult {
  cookie: string;
  session: AuthSession;
}

export interface LogoutResult {
  clearCookie: string;
  session: AuthSession;
}

// guest 기본 세션 페이로드를 생성합니다.
function createGuestSession(): AuthSession {
  return {
    accountId: null,
    displayName: "Guest Creator",
    mode: "guest"
  };
}

// 인증 서비스 옵션으로부터 쿠키 옵션을 추출합니다.
function toCookieOptions(options: CreateBackendAuthServiceOptions): AuthServiceCookieOptions {
  return {
    cookieName: options.cookieName,
    sameSite: options.cookieSameSite,
    secure: options.cookieSecure
  };
}

// 인증/세션 핵심 흐름을 제공하는 백엔드 서비스 클래스입니다.
export class BackendAuthService {
  private readonly cookieOptions: AuthServiceCookieOptions;
  private readonly googleClientId: string | null;

  private readonly now: () => Date;

  private readonly store: AuthStore;

  private readonly tokenVerifier: GoogleIdTokenVerifier;

  // 실행 환경 설정과 의존성을 바탕으로 인증 서비스를 구성합니다.
  constructor(private readonly options: CreateBackendAuthServiceOptions) {
    this.googleClientId = options.googleClientId;
    this.now = options.now ?? (() => new Date());
    this.store = options.store ?? new MySqlAuthStore(options.mysql);
    this.cookieOptions = toCookieOptions(options);
    this.tokenVerifier =
      options.tokenVerifier ??
      createGoogleIdTokenVerifier({
        clientId: this.googleClientId
      });
  }

  // Google credential을 검증해 계정/세션을 만들고 Set-Cookie 값을 반환합니다.
  async loginWithGoogleCredential(
    credential: string,
    userAgent: string | null
  ): Promise<GoogleLoginResult> {
    const identity = await this.tokenVerifier(credential);
    const account = await this.store.upsertGoogleAccount(identity);
    const createdSession = await this.store.createSession(
      account.accountId,
      this.options.sessionTtlSeconds,
      userAgent,
      this.now()
    );

    return {
      cookie: buildSessionCookie(createdSession.sessionId, this.cookieOptions),
      session: {
        accountId: account.accountId,
        displayName: account.displayName,
        mode: "authenticated"
      }
    };
  }

  // Cookie 헤더를 기준으로 현재 세션 상태를 해석합니다.
  async readSessionFromCookieHeader(cookieHeader: string | undefined): Promise<AuthServiceSessionSnapshot> {
    const sessionId = getCookieValue(cookieHeader, this.cookieOptions.cookieName);
    if (!sessionId) {
      return {
        accountId: null,
        session: createGuestSession(),
        sessionId: null,
        shouldClearCookie: false
      };
    }

    const session = await this.store.getActiveSession(sessionId, this.now());
    if (!session) {
      return {
        accountId: null,
        session: createGuestSession(),
        sessionId,
        shouldClearCookie: true
      };
    }

    return {
      accountId: session.accountId,
      session: {
        accountId: session.accountId,
        displayName: session.displayName,
        mode: "authenticated"
      },
      sessionId: session.sessionId,
      shouldClearCookie: false
    };
  }

  // Cookie 헤더를 기준으로 세션을 폐기하고 guest 상태를 반환합니다.
  async logoutFromCookieHeader(cookieHeader: string | undefined): Promise<LogoutResult> {
    const sessionId = getCookieValue(cookieHeader, this.cookieOptions.cookieName);
    if (sessionId) {
      await this.store.revokeSession(sessionId, this.now());
    }

    return {
      clearCookie: this.buildClearCookie(),
      session: createGuestSession()
    };
  }

  // 세션 스냅샷에서 계정 ID만 추출하는 헬퍼를 제공합니다.
  async resolveSessionAccountId(cookieHeader: string | undefined) {
    const snapshot = await this.readSessionFromCookieHeader(cookieHeader);
    return snapshot.accountId;
  }

  // 무효 세션 정리용 만료 쿠키를 생성합니다.
  buildClearCookie() {
    return buildClearedSessionCookie(this.cookieOptions);
  }

  // Google 로그인 설정 준비 여부를 반환합니다.
  isGoogleAuthConfigured() {
    return this.googleClientId !== null;
  }

  // 종료 시 저장소 리소스를 정리합니다.
  async close() {
    await this.store.close();
  }
}
