// 이 파일은 Google ID 토큰을 사용해 세션 기반 인증을 처리합니다.
import type { AuthSession } from "@scenaairo/shared";

const SESSION_FALLBACK: AuthSession = {
  accountId: null,
  displayName: "Guest Creator",
  mode: "guest"
};

interface GoogleIdentityResponse {
  credential: string;
}

interface AuthBoundaryOptions {
  fetchImpl?: typeof fetch;
  googleClientId?: string | null;
}

interface SessionResponse {
  accountId?: string | null;
  displayName?: string | null;
  mode?: "guest" | "authenticated";
}

interface GoogleIdentitySdk {
  accounts?: {
    id?: {
      initialize: (options: {
        callback: (payload: GoogleIdentityResponse) => void;
        client_id: string;
        cancel_on_tap_outside?: boolean;
        context?: string;
        ux_mode?: "popup" | "redirect";
        use_fedcm?: boolean;
      }) => void;
      prompt?: (callback?: (state: {
        isNotDisplayed: () => boolean;
        isSkippedMoment: () => boolean;
        getNotDisplayedReason?: () => string;
      }) => void) => void;
      renderButton?: (
        parent: HTMLElement,
        options?: {
          theme?: string;
          size?: "large" | "medium" | "small";
          text?: string;
          shape?: "pill" | "rectangular";
          width?: string;
          type?: "standard";
        }
      ) => void;
    };
  };
}

type GoogleIdentitySigner = NonNullable<
  NonNullable<GoogleIdentitySdk["accounts"]>["id"]
>;

const AUTH_ENDPOINT_SESSION = "/auth/session";
const AUTH_ENDPOINT_LOGOUT = "/auth/logout";
const AUTH_ENDPOINT_GOOGLE_LOGIN = "/auth/google/login";
const GUEST_RESPONSE_STATUSES = new Set([401, 403]);

// 기본 fetch를 메서드 컨텍스트와 분리해 안전하게 호출합니다.
function createSafeFetch(fetchImpl?: typeof fetch): typeof fetch {
  if (fetchImpl) {
    return (...args) => fetchImpl(...args);
  }

  return (...args) => fetch(...args);
}

// 브라우저 전역에서 Google Identity SDK 객체를 읽습니다.
function getGoogleIdentitySdk(): GoogleIdentitySdk | undefined {
  return (globalThis as unknown as { google?: GoogleIdentitySdk }).google;
}

// 서버 응답 본문을 화면 세션 형태로 정규화합니다.
function normalizeSessionPayload(raw: unknown): AuthSession {
  const payload = (raw ?? {}) as SessionResponse;
  const accountId = payload.accountId === null ? null : payload.accountId ?? null;
  const displayName = typeof payload.displayName === "string" ? payload.displayName : null;

  return {
    accountId,
    displayName: displayName ?? "Guest Creator",
    mode: payload.mode === "authenticated" ? "authenticated" : "guest"
  };
}

// 서버 응답을 JSON 세션으로 변환합니다.
async function parseSessionResponse(response: Response): Promise<AuthSession> {
  try {
    const raw = (await response.json()) as unknown;
    return normalizeSessionPayload(raw);
  } catch {
    return SESSION_FALLBACK;
  }
}

// 응답 객체가 Google credential 구조인지 판별합니다.
function isGoogleCredential(value: unknown): value is GoogleIdentityResponse {
  return (
    typeof value === "object" &&
    value !== null &&
    "credential" in value &&
    typeof (value as GoogleIdentityResponse).credential === "string" &&
    (value as GoogleIdentityResponse).credential.length > 0
  );
}

// 세션 기반 인증 경계를 제공합니다.
export class SessionAuthBoundary {
  private readonly fetchImpl: typeof fetch;
  private readonly googleClientId: string | null;
  private scriptLoad?: Promise<boolean>;

  constructor(
    private readonly apiBaseUrl: string,
    options: AuthBoundaryOptions = {}
  ) {
    this.fetchImpl = createSafeFetch(options.fetchImpl);
    this.googleClientId = options.googleClientId ?? null;
  }

  // 현재 브라우저 세션 상태를 서버에서 조회합니다.
  async getCurrentSession(): Promise<AuthSession> {
    try {
      const response = await this.fetchImpl(`${this.apiBaseUrl}${AUTH_ENDPOINT_SESSION}`, {
        credentials: "include",
        method: "GET"
      });

      if (!response.ok) {
        if (GUEST_RESPONSE_STATUSES.has(response.status)) {
          return SESSION_FALLBACK;
        }

        throw new Error(`auth_session_request_failed:${response.status}`);
      }

      return parseSessionResponse(response);
    } catch {
      return SESSION_FALLBACK;
    }
  }

  // Google 로그인 팝업을 열어 credential을 받아 서버와 교환해 세션을 만듭니다.
  async signIn(): Promise<AuthSession> {
    if (!this.googleClientId) {
      throw new Error("google_client_id_is_not_configured");
    }

    if (!("window" in globalThis)) {
      throw new Error("browser_environment_required");
    }

    await this.ensureGoogleIdentityScript();
    const sdk = getGoogleIdentitySdk();
    const signer = sdk?.accounts?.id;

    if (!signer) {
      throw new Error("google_identity_sdk_not_loaded");
    }

    if (typeof signer.renderButton === "function") {
      const credential = await this.signInWithGoogleButtonSurface(signer);

      return this.exchangeCredential(credential);
    }

    const prompt = signer.prompt;

    if (typeof prompt !== "function") {
      throw new Error("google_identity_sdk_not_loaded");
    }

    const credentialResponse = await new Promise<GoogleIdentityResponse>((resolve, reject) => {
      let completed = false;
      const tryComplete = () => {
        if (completed) {
          return false;
        }

        completed = true;
        return true;
      };

      signer.initialize({
        callback: (payload) => {
          if (!tryComplete()) {
            return;
          }

          if (!isGoogleCredential(payload)) {
            reject(new Error("invalid_google_credential_response"));
            return;
          }

          resolve(payload);
        },
        client_id: this.googleClientId as string,
        cancel_on_tap_outside: false,
        context: "signin",
        ux_mode: "popup"
      });

      prompt((state) => {
        if (!tryComplete()) {
          return;
        }

        if (state.isNotDisplayed()) {
          reject(
            new Error(`google_prompt_not_displayed:${state.getNotDisplayedReason?.() ?? "unknown"}`)
          );
          return;
        }

        if (state.isSkippedMoment()) {
          reject(new Error("google_prompt_skipped"));
        }
      });
    });

    return this.exchangeCredential(credentialResponse.credential);
  }

  // Google 렌더 버튼을 표시해 사용자가 직접 로그인 UI를 클릭하도록 유도합니다.
  private async signInWithGoogleButtonSurface(
    signer: GoogleIdentitySigner
  ): Promise<string> {
    const authSurface = document.createElement("div");
    const overlay = document.createElement("div");
    const buttonHost = document.createElement("div");
    const closeButton = document.createElement("button");
    const instruction = document.createElement("p");

    authSurface.style.alignItems = "center";
    authSurface.style.background = "rgba(18, 23, 29, 0.45)";
    authSurface.style.bottom = "0";
    authSurface.style.display = "grid";
    authSurface.style.justifyItems = "center";
    authSurface.style.left = "0";
    authSurface.style.position = "fixed";
    authSurface.style.right = "0";
    authSurface.style.top = "0";
    authSurface.style.zIndex = "2000";

    overlay.style.background = "#fff";
    overlay.style.borderRadius = "0.9rem";
    overlay.style.display = "grid";
    overlay.style.gap = "0.45rem";
    overlay.style.maxWidth = "20rem";
    overlay.style.minWidth = "18rem";
    overlay.style.padding = "0.85rem 0.95rem";
    overlay.style.textAlign = "center";
    overlay.style.width = "100%";
    overlay.style.boxSizing = "border-box";
    overlay.style.margin = "0 1rem";

    instruction.textContent = "Sign in with your Google account to continue.";
    instruction.style.fontSize = "0.88rem";
    instruction.style.margin = "0 0 0.35rem 0";
    closeButton.type = "button";
    closeButton.textContent = "Cancel";
    closeButton.style.marginTop = "0.15rem";

    overlay.append(instruction, buttonHost, closeButton);
    authSurface.appendChild(overlay);

    const credentialResponse = await new Promise<GoogleIdentityResponse>((resolve, reject) => {
      let completed = false;
      let autoCloseTimer: ReturnType<typeof window.setTimeout> | null = null;

      const cleanup = () => {
        if (completed) {
          return;
        }

        completed = true;
        closeButton.removeEventListener("click", onCancel);
        window.removeEventListener("keydown", onEscape);
        if (autoCloseTimer) {
          clearTimeout(autoCloseTimer);
        }
        if (authSurface.parentElement) {
          authSurface.parentElement.removeChild(authSurface);
        }
      };

      const onFailure = (error: Error) => {
        cleanup();
        reject(error);
      };

      const onSuccess = (payload: GoogleIdentityResponse) => {
        cleanup();
        if (!isGoogleCredential(payload)) {
          onFailure(new Error("invalid_google_credential_response"));
          return;
        }

        resolve(payload);
      };
      const onEscape = (event: KeyboardEvent) => {
        if (event.key === "Escape") {
          onFailure(new Error("google_prompt_skipped"));
        }
      };

      const onCancel = () => {
        onFailure(new Error("google_prompt_skipped"));
      };

      autoCloseTimer = setTimeout(() => {
        onFailure(new Error("google_prompt_skipped"));
      }, 15 * 60 * 1000);

      signer.initialize({
        callback: onSuccess,
        client_id: this.googleClientId as string,
        cancel_on_tap_outside: false,
        context: "signin",
        ux_mode: "popup"
      });

      const renderButton = signer.renderButton;

      if (typeof renderButton !== "function") {
        onFailure(new Error("google_identity_sdk_not_loaded"));
        return;
      }

      renderButton(buttonHost, {
        theme: "outline",
        text: "signin_with",
        type: "standard",
        width: "100%"
      });

      closeButton.addEventListener("click", onCancel);
      window.addEventListener("keydown", onEscape);
      document.body.appendChild(authSurface);
    });

    return credentialResponse.credential;
  }

  // 세션 종료 요청을 서버에 전송합니다.
  async signOut(): Promise<AuthSession> {
    try {
      const response = await this.fetchImpl(`${this.apiBaseUrl}${AUTH_ENDPOINT_LOGOUT}`, {
        credentials: "include",
        method: "POST"
      });

      if (!response.ok) {
        throw new Error(`auth_logout_request_failed:${response.status}`);
      }

      return parseSessionResponse(response);
    } catch {
      return SESSION_FALLBACK;
    }
  }

  // Google credential을 세션 로그인 API로 교환합니다.
  async exchangeCredential(credential: string): Promise<AuthSession> {
    const response = await this.fetchImpl(
      `${this.apiBaseUrl}${AUTH_ENDPOINT_GOOGLE_LOGIN}`,
      {
        body: JSON.stringify({ credential }),
        credentials: "include",
        headers: {
          "Content-Type": "application/json"
        },
        method: "POST"
      }
    );

    if (!response.ok) {
      let errorMessage = `google_login_request_failed:${response.status}`;

      try {
        const raw = (await response.json()) as { message?: unknown };
        if (typeof raw.message === "string" && raw.message.length > 0) {
          errorMessage = raw.message;
        }
      } catch {
        // no-op
      }

      throw new Error(errorMessage);
    }

    return parseSessionResponse(response);
  }

  // Google Identity SDK 스크립트를 한 번만 로드합니다.
  private async ensureGoogleIdentityScript(): Promise<void> {
    if (getGoogleIdentitySdk()?.accounts?.id) {
      return;
    }

    if (!this.scriptLoad) {
      this.scriptLoad = new Promise<boolean>((resolve) => {
        const script = document.createElement("script");
        script.src = "https://accounts.google.com/gsi/client";
        script.async = true;
        script.defer = true;
        script.onload = () => resolve(true);
        script.onerror = () => resolve(false);
        document.head.appendChild(script);
      });
    }

    const loaded = await this.scriptLoad;
    if (!loaded) {
      throw new Error("google_identity_script_load_failed");
    }
  }
}
