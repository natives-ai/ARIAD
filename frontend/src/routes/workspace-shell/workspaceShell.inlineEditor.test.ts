// 이 파일은 인라인 키워드/멘션 토큰 삭제 동작을 검증합니다.
import { describe, expect, it } from "vitest";

import {
  getInlineKeywordToken,
  getObjectToken,
  removeAdjacentInlineToken,
  removeInlineSelectionWithTokenBoundaries
} from "./workspaceShell.inlineEditor";

describe("workspaceShell.inlineEditor removeAdjacentInlineToken", () => {
  it("removes a whole keyword token when backspace is pressed inside the token", () => {
    const token = getInlineKeywordToken("pressure");
    const value = `start ${token} end`;
    const tokenStart = value.indexOf(token);
    const caretInsideToken = tokenStart + 3;

    const next = removeAdjacentInlineToken(value, caretInsideToken, "backward");

    expect(next).not.toBeNull();
    expect(next?.nextText).toBe("start end");
  });

  it("removes a whole keyword token when delete is pressed inside the token", () => {
    const token = getInlineKeywordToken("hesitation");
    const value = `start ${token} end`;
    const tokenStart = value.indexOf(token);
    const caretInsideToken = tokenStart + 2;

    const next = removeAdjacentInlineToken(value, caretInsideToken, "forward");

    expect(next).not.toBeNull();
    expect(next?.nextText).toBe("start end");
  });

  it("removes a whole object token when delete is pressed inside the token", () => {
    const token = getObjectToken("Heroine's Mother");
    const value = `beat ${token} closes`;
    const tokenStart = value.indexOf(token);
    const caretInsideToken = tokenStart + 1;

    const next = removeAdjacentInlineToken(value, caretInsideToken, "forward");

    expect(next).not.toBeNull();
    expect(next?.nextText).toBe("beat closes");
  });

  it("removes a whole object token when range delete intersects the token", () => {
    const token = getObjectToken("Heroine's Mother");
    const value = `beat ${token} closes`;
    const tokenStart = value.indexOf(token);
    const selectionStart = tokenStart + 2;
    const selectionEnd = tokenStart + 8;

    const next = removeInlineSelectionWithTokenBoundaries(
      value,
      selectionStart,
      selectionEnd
    );

    expect(next).not.toBeNull();
    expect(next?.nextText).toBe("beat closes");
  });

  it("returns null when range delete does not intersect any token", () => {
    const value = "plain text only";
    const next = removeInlineSelectionWithTokenBoundaries(value, 0, 5);

    expect(next).toBeNull();
  });
});
