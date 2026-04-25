// 이 파일은 인증 세션 쿠키를 파싱하고 생성하는 공통 유틸을 제공합니다.

export type AuthCookieSameSite = "lax" | "none" | "strict";

interface BuildSessionCookieOptions {
  cookieName: string;
  sameSite: AuthCookieSameSite;
  secure: boolean;
}

// Cookie 헤더 문자열에서 key/value 맵을 추출합니다.
function parseCookieHeader(cookieHeader: string | undefined) {
  const parsed = new Map<string, string>();

  if (!cookieHeader) {
    return parsed;
  }

  const pairs = cookieHeader.split(";");

  for (const pair of pairs) {
    const [rawKey, ...rawValueParts] = pair.split("=");
    const key = rawKey?.trim();

    if (!key) {
      continue;
    }

    const rawValue = rawValueParts.join("=").trim();
    if (!rawValue) {
      parsed.set(key, "");
      continue;
    }

    try {
      parsed.set(key, decodeURIComponent(rawValue));
    } catch {
      parsed.set(key, rawValue);
    }
  }

  return parsed;
}

// 특정 이름의 쿠키 값을 조회합니다.
export function getCookieValue(cookieHeader: string | undefined, cookieName: string) {
  const cookies = parseCookieHeader(cookieHeader);
  return cookies.get(cookieName) ?? null;
}

// 세션 ID를 담은 HttpOnly 쿠키 문자열을 생성합니다.
export function buildSessionCookie(
  sessionId: string,
  options: BuildSessionCookieOptions
) {
  const segments = [
    `${options.cookieName}=${encodeURIComponent(sessionId)}`,
    "Path=/",
    "HttpOnly",
    `SameSite=${options.sameSite.charAt(0).toUpperCase()}${options.sameSite.slice(1)}`
  ];

  if (options.secure) {
    segments.push("Secure");
  }

  return segments.join("; ");
}

// 세션 쿠키를 즉시 만료시키는 Set-Cookie 문자열을 생성합니다.
export function buildClearedSessionCookie(options: BuildSessionCookieOptions) {
  const segments = [
    `${options.cookieName}=`,
    "Path=/",
    "HttpOnly",
    "Max-Age=0",
    "Expires=Thu, 01 Jan 1970 00:00:00 GMT",
    `SameSite=${options.sameSite.charAt(0).toUpperCase()}${options.sameSite.slice(1)}`
  ];

  if (options.secure) {
    segments.push("Secure");
  }

  return segments.join("; ");
}
