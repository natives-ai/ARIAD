// 이 파일은 Google ID token을 검증해 신뢰 가능한 사용자 식별 정보를 추출합니다.

import { createPublicKey, verify } from "node:crypto";

const GOOGLE_JWKS_URL = "https://www.googleapis.com/oauth2/v3/certs";
const ALLOWED_GOOGLE_ISSUERS = new Set([
  "accounts.google.com",
  "https://accounts.google.com"
]);

interface JwtHeader {
  alg?: string;
  kid?: string;
}

interface JwtPayload {
  aud?: string | string[];
  email?: string;
  exp?: number;
  iat?: number;
  iss?: string;
  name?: string;
  picture?: string;
  sub?: string;
}

interface GoogleJwk {
  e: string;
  kid: string;
  kty: string;
  n: string;
}

interface GoogleJwksResponse {
  keys?: GoogleJwk[];
}

interface CachedGoogleJwks {
  expiresAt: number;
  keys: GoogleJwk[];
}

interface CreateGoogleIdTokenVerifierOptions {
  clientId: string | null;
  fetchImpl?: typeof fetch;
  now?: () => Date;
}

export interface VerifiedGoogleIdentity {
  email: string | null;
  name: string | null;
  picture: string | null;
  sub: string;
}

export type GoogleIdTokenVerifier = (idToken: string) => Promise<VerifiedGoogleIdentity>;

let cachedGoogleJwks: CachedGoogleJwks | null = null;

// base64url 세그먼트를 Buffer로 디코딩합니다.
function decodeBase64UrlToBuffer(value: string) {
  const normalized = value.replace(/-/g, "+").replace(/_/g, "/");
  const padded = normalized.padEnd(
    normalized.length + ((4 - (normalized.length % 4)) % 4),
    "="
  );
  return Buffer.from(padded, "base64");
}

// base64url 세그먼트를 JSON 객체로 역직렬화합니다.
function decodeBase64UrlJson<T>(value: string): T {
  const decodedText = decodeBase64UrlToBuffer(value).toString("utf8");
  return JSON.parse(decodedText) as T;
}

// Cache-Control 헤더에서 max-age를 읽어 JWK 캐시 수명을 계산합니다.
function resolveMaxAgeMs(cacheControl: string | null) {
  if (!cacheControl) {
    return 60_000;
  }

  const matched = cacheControl.match(/max-age=(\d+)/i);
  if (!matched) {
    return 60_000;
  }

  const parsedSeconds = Number(matched[1]);
  if (!Number.isInteger(parsedSeconds) || parsedSeconds <= 0) {
    return 60_000;
  }

  return parsedSeconds * 1000;
}

// Google JWK 세트를 조회하고 캐시에서 재사용합니다.
async function loadGoogleJwks(fetchImpl: typeof fetch, now: () => Date) {
  if (cachedGoogleJwks && cachedGoogleJwks.expiresAt > now().getTime()) {
    return cachedGoogleJwks.keys;
  }

  let response: Awaited<ReturnType<typeof fetch>>;
  try {
    response = await fetchImpl(GOOGLE_JWKS_URL);
  } catch {
    throw new Error("google_jwks_fetch_failed");
  }

  if (!response.ok) {
    throw new Error("google_jwks_fetch_failed");
  }

  let payload: GoogleJwksResponse;
  try {
    payload = (await response.json()) as GoogleJwksResponse;
  } catch {
    throw new Error("google_jwks_fetch_failed");
  }
  if (!Array.isArray(payload.keys) || payload.keys.length === 0) {
    throw new Error("google_jwks_fetch_failed");
  }

  cachedGoogleJwks = {
    expiresAt: now().getTime() + resolveMaxAgeMs(response.headers.get("cache-control")),
    keys: payload.keys
  };

  return payload.keys;
}

// JWT audience가 현재 백엔드 clientId와 일치하는지 확인합니다.
function isAudienceMatched(audience: string | string[] | undefined, clientId: string) {
  if (typeof audience === "string") {
    return audience === clientId;
  }

  if (Array.isArray(audience)) {
    return audience.includes(clientId);
  }

  return false;
}

// JWT 만료 시각이 현재 시각 기준으로 유효한지 확인합니다.
function isTokenExpired(exp: number | undefined, now: () => Date) {
  if (!Number.isFinite(exp)) {
    return true;
  }

  const expirationMs = Number(exp) * 1000;
  return expirationMs <= now().getTime();
}

// 서명 입력값과 JWK를 사용해 RS256 서명을 검증합니다.
function verifyJwtSignature(signingInput: string, signatureSegment: string, jwk: GoogleJwk) {
  const key = createPublicKey({
    format: "jwk",
    key: {
      e: jwk.e,
      kty: jwk.kty,
      n: jwk.n
    }
  });

  return verify(
    "RSA-SHA256",
    Buffer.from(signingInput, "utf8"),
    key,
    decodeBase64UrlToBuffer(signatureSegment)
  );
}

// Google ID token 검증기를 생성합니다.
export function createGoogleIdTokenVerifier(
  options: CreateGoogleIdTokenVerifierOptions
): GoogleIdTokenVerifier {
  const fetchImpl = options.fetchImpl ?? fetch;
  const now = options.now ?? (() => new Date());

  return async (idToken: string) => {
    if (!options.clientId) {
      throw new Error("missing_google_client_id");
    }

    const segments = idToken.split(".");
    if (segments.length !== 3) {
      throw new Error("invalid_google_token");
    }

    const headerSegment = segments[0]!;
    const payloadSegment = segments[1]!;
    const signatureSegment = segments[2]!;

    let header: JwtHeader;
    let payload: JwtPayload;
    try {
      header = decodeBase64UrlJson<JwtHeader>(headerSegment);
      payload = decodeBase64UrlJson<JwtPayload>(payloadSegment);
    } catch {
      throw new Error("invalid_google_token");
    }

    if (header.alg !== "RS256" || typeof header.kid !== "string" || header.kid.length === 0) {
      throw new Error("invalid_google_token");
    }

    const jwks = await loadGoogleJwks(fetchImpl, now);
    const matchedJwk = jwks.find((jwk) => jwk.kid === header.kid);
    if (!matchedJwk) {
      throw new Error("google_jwks_key_not_found");
    }

    const isSignatureValid = verifyJwtSignature(
      `${headerSegment}.${payloadSegment}`,
      signatureSegment,
      matchedJwk
    );
    if (!isSignatureValid) {
      throw new Error("google_token_signature_invalid");
    }

    if (!ALLOWED_GOOGLE_ISSUERS.has(payload.iss ?? "")) {
      throw new Error("invalid_google_issuer");
    }

    if (!isAudienceMatched(payload.aud, options.clientId)) {
      throw new Error("invalid_google_audience");
    }

    if (isTokenExpired(payload.exp, now)) {
      throw new Error("expired_google_token");
    }

    if (typeof payload.sub !== "string" || payload.sub.length === 0) {
      throw new Error("invalid_google_subject");
    }

    return {
      email: typeof payload.email === "string" ? payload.email : null,
      name: typeof payload.name === "string" ? payload.name : null,
      picture: typeof payload.picture === "string" ? payload.picture : null,
      sub: payload.sub
    };
  };
}
