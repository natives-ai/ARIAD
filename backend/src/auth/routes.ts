// 이 파일은 인증 세션 API 엔드포인트를 Fastify에 등록합니다.

import type { FastifyInstance } from "fastify";

import type { BackendAuthService } from "./service.js";

interface RegisterAuthRoutesOptions {
  authService: BackendAuthService;
}

interface GoogleLoginRequestBody {
  credential?: string;
}

interface AuthErrorResponseShape {
  message: string;
  statusCode: number;
}

const verificationFailureMessages = new Set([
  "invalid_google_token",
  "invalid_google_subject",
  "invalid_google_issuer",
  "invalid_google_audience",
  "expired_google_token",
  "google_token_signature_invalid",
  "google_jwks_key_not_found"
]);

// 인증 예외를 외부 계약용 오류 코드/상태로 정규화합니다.
function toAuthErrorResponse(message: string): AuthErrorResponseShape {
  if (message === "missing_google_client_id") {
    return {
      message: "google_auth_not_configured",
      statusCode: 500
    };
  }

  if (verificationFailureMessages.has(message)) {
    return {
      message: "google_token_verification_failed",
      statusCode: 401
    };
  }

  if (message === "google_jwks_fetch_failed") {
    return {
      message: "google_token_verification_failed",
      statusCode: 502
    };
  }

  return {
    message: "google_login_failed",
    statusCode: 400
  };
}

// 인증 세션 관련 API를 Fastify 앱에 연결합니다.
export async function registerAuthRoutes(
  app: FastifyInstance,
  options: RegisterAuthRoutesOptions
) {
  app.post("/api/auth/google/login", async (request, reply) => {
    const body = request.body as GoogleLoginRequestBody;
    const credential = body?.credential?.trim();

    if (!credential) {
      return reply.status(400).send({
        message: "credential_required"
      });
    }

    try {
      const result = await options.authService.loginWithGoogleCredential(
        credential,
        request.headers["user-agent"] ?? null
      );
      reply.header("Set-Cookie", result.cookie);
      return result.session;
    } catch (error) {
      const message = error instanceof Error ? error.message : "google_login_failed";
      const normalized = toAuthErrorResponse(message);
      return reply.status(normalized.statusCode).send({
        message: normalized.message
      });
    }
  });

  app.get("/api/auth/session", async (request, reply) => {
    try {
      const snapshot = await options.authService.readSessionFromCookieHeader(request.headers.cookie);

      if (snapshot.shouldClearCookie) {
        reply.header("Set-Cookie", options.authService.buildClearCookie());
      }

      return snapshot.session;
    } catch {
      return reply.status(500).send({
        message: "auth_session_failed"
      });
    }
  });

  app.post("/api/auth/logout", async (request, reply) => {
    try {
      const result = await options.authService.logoutFromCookieHeader(request.headers.cookie);
      reply.header("Set-Cookie", result.clearCookie);
      return result.session;
    } catch {
      return reply.status(500).send({
        message: "auth_logout_failed"
      });
    }
  });
}
