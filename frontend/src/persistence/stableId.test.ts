// 이 파일은 브라우저 호환 ID 생성 동작을 검증합니다.
import { afterEach, describe, expect, it, vi } from "vitest";

import { createClientId, createStableId } from "./stableId";

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("stable id generation", () => {
  it("uses native randomUUID when available", () => {
    vi.stubGlobal("crypto", {
      randomUUID: () => "00000000-0000-4000-8000-000000000000"
    });

    expect(createStableId("node")).toBe("node_00000000-0000-4000-8000-000000000000");
  });

  it("falls back to getRandomValues when randomUUID is unavailable", () => {
    vi.stubGlobal("crypto", {
      getRandomValues: (array: Uint8Array) => {
        array.set(Array.from({ length: array.length }, (_, index) => index));
        return array;
      }
    });

    expect(createClientId("folder")).toBe("folder_00010203-0405-4607-8809-0a0b0c0d0e0f");
  });
});
