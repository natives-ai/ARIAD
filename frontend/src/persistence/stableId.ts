// 이 파일은 브라우저 호환 ID 생성을 담당합니다.
import type { PersistedEntityKind } from "@scenaairo/shared";

// 안전한 난수 토큰을 생성합니다.
function createRandomToken() {
  const cryptoApi = globalThis.crypto;

  if (typeof cryptoApi?.randomUUID === "function") {
    return cryptoApi.randomUUID();
  }

  if (typeof cryptoApi?.getRandomValues === "function") {
    const bytes = cryptoApi.getRandomValues(new Uint8Array(16));
    bytes[6] = ((bytes[6] ?? 0) & 0x0f) | 0x40;
    bytes[8] = ((bytes[8] ?? 0) & 0x3f) | 0x80;
    const hex = Array.from(bytes, (byte) => byte.toString(16).padStart(2, "0"));

    return [
      hex.slice(0, 4).join(""),
      hex.slice(4, 6).join(""),
      hex.slice(6, 8).join(""),
      hex.slice(8, 10).join(""),
      hex.slice(10, 16).join("")
    ].join("-");
  }

  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 12)}`;
}

// 접두사를 포함한 클라이언트 ID를 생성합니다.
export function createClientId(prefix: string): string {
  return `${prefix}_${createRandomToken()}`;
}

// 저장 엔티티 ID를 생성합니다.
export function createStableId(kind: PersistedEntityKind): string {
  return createClientId(kind);
}
