// 이 파일은 SessionAuthBoundary의 fetch 바인딩 안정성과 로그인 교환 경로를 검증합니다.
import { afterEach, describe, expect, it } from "vitest";

import { SessionAuthBoundary } from "./sessionAuthBoundary";

interface GoogleSdkMock {
  accounts?: {
    id?: {
      initialize: (options: {
        callback: (payload: { credential: string }) => void;
        client_id: string;
      }) => void;
      prompt?: () => void;
      renderButton?: (parent: HTMLElement) => void;
    };
  };
}

interface MutableGlobal {
  fetch: typeof fetch;
  google: GoogleSdkMock | undefined;
  window: (Window & typeof globalThis) | undefined;
}

// JSON 세션 응답 객체를 생성합니다.
function createJsonResponse(payload: unknown, status = 200) {
  return new Response(JSON.stringify(payload), {
    headers: {
      "Content-Type": "application/json"
    },
    status
  });
}

describe("session auth boundary", () => {
  const globals = globalThis as unknown as MutableGlobal;
  const originalFetch = globals.fetch;
  const originalGoogle = globals.google;
  const originalWindow = globals.window;

  afterEach(() => {
    globals.fetch = originalFetch;
    globals.google = originalGoogle;
    globals.window = originalWindow;
  });

  it("uses a safe fetch wrapper so method-context invocation does not break session reads", async () => {
    const callContexts: unknown[] = [];

    globals.fetch = (function (this: unknown) {
      callContexts.push(this);
      if (this !== undefined) {
        throw new TypeError("Failed to execute 'fetch' on 'Window': Illegal invocation");
      }

      return Promise.resolve(
        createJsonResponse({
          accountId: "account-1",
          displayName: "Creator",
          mode: "authenticated"
        })
      );
    }) as typeof fetch;

    const boundary = new SessionAuthBoundary("/api");
    const session = await boundary.getCurrentSession();

    expect(session.mode).toBe("authenticated");
    expect(session.accountId).toBe("account-1");
    expect(callContexts).toHaveLength(1);
    expect(callContexts[0]).toBeUndefined();
  });

  it("posts Google credentials to the login endpoint and returns an authenticated session", async () => {
    const callContexts: unknown[] = [];
    const requests: Array<{ init: RequestInit | undefined; url: string }> = [];
    let callback: ((payload: { credential: string }) => void) | null = null;
    globals.window = globalThis as Window & typeof globalThis;

    globals.fetch = (function (this: unknown, input: RequestInfo | URL, init?: RequestInit) {
      callContexts.push(this);
      if (this !== undefined) {
        throw new TypeError("Failed to execute 'fetch' on 'Window': Illegal invocation");
      }

      requests.push({
        init,
        url: String(input)
      });

      return Promise.resolve(
        createJsonResponse({
          accountId: "account-2",
          displayName: "Creator",
          mode: "authenticated"
        })
      );
    }) as typeof fetch;

    globals.google = {
      accounts: {
        id: {
          initialize(options) {
            callback = options.callback;
          },
          prompt() {
            callback?.({
              credential: "token-from-google"
            });
          }
        }
      }
    };

    const boundary = new SessionAuthBoundary("/api", {
      googleClientId: "google-client-id"
    });
    const session = await boundary.signIn();

    expect(session.mode).toBe("authenticated");
    expect(session.accountId).toBe("account-2");
    expect(requests).toHaveLength(1);
    expect(requests[0]?.url).toBe("/api/auth/google/login");
    expect(requests[0]?.init?.method).toBe("POST");
    expect(requests[0]?.init?.credentials).toBe("include");
    expect(requests[0]?.init?.body).toBe(
      JSON.stringify({ credential: "token-from-google" })
    );
    expect(callContexts).toHaveLength(1);
    expect(callContexts[0]).toBeUndefined();
  });
});
