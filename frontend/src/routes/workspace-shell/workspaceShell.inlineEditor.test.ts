// 이 파일은 인라인 키워드/멘션 토큰 삭제 동작을 검증합니다.
import { describe, expect, it } from "vitest";

import {
  buildDisplayedKeywordSuggestions,
  getObjectMentionCreateCandidate,
  getInlineKeywordToken,
  getObjectToken,
  keywordCloudSlotCount,
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

describe("workspaceShell.inlineEditor buildDisplayedKeywordSuggestions", () => {
  it("keeps selected keywords first and caps the cloud to nine slots", () => {
    const selectedKeywords = ["BETA", "alpha"];
    const suggestions = [
      { label: "alpha", reason: "existing" },
      { label: "gamma", reason: "r1" },
      { label: "delta", reason: "r2" },
      { label: "epsilon", reason: "r3" },
      { label: "zeta", reason: "r4" },
      { label: "eta", reason: "r5" },
      { label: "theta", reason: "r6" },
      { label: "iota", reason: "r7" },
      { label: "kappa", reason: "r8" },
      { label: "lambda", reason: "r9" },
      { label: "mu", reason: "r10" }
    ];

    const displayed = buildDisplayedKeywordSuggestions(selectedKeywords, suggestions, 0);

    expect(displayed).toHaveLength(keywordCloudSlotCount);
    expect(displayed[0]?.label).toBe("BETA");
    expect(displayed[1]?.label).toBe("alpha");
    expect(new Set(displayed.map((entry) => entry.label.toLowerCase())).size).toBe(
      displayed.length
    );
  });

  it("limits overflowed selected keywords to the first nine in selection order", () => {
    const selectedKeywords = [
      "k1",
      "k2",
      "k3",
      "k4",
      "k5",
      "k6",
      "k7",
      "k8",
      "k9",
      "k10"
    ];

    const displayed = buildDisplayedKeywordSuggestions(selectedKeywords, [], 0);

    expect(displayed).toHaveLength(keywordCloudSlotCount);
    expect(displayed.map((entry) => entry.label)).toEqual(
      selectedKeywords.slice(0, keywordCloudSlotCount)
    );
  });
});

describe("workspaceShell.inlineEditor getObjectMentionCreateCandidate", () => {
  it("creates a candidate for unmatched mention text and preserves display casing", () => {
    const candidate = getObjectMentionCreateCandidate("New Coat", [
      { name: "Heroine's Mother" }
    ]);

    expect(candidate).toEqual({
      name: "New Coat",
      normalizedName: "new coat"
    });
  });

  it("hides the candidate for blank, long, or exact existing names", () => {
    expect(getObjectMentionCreateCandidate("   ", [])).toBeNull();
    expect(getObjectMentionCreateCandidate("Heroine's Mother", [
      { name: "heroine's mother" }
    ])).toBeNull();
    expect(getObjectMentionCreateCandidate("x".repeat(81), [])).toBeNull();
  });
});
