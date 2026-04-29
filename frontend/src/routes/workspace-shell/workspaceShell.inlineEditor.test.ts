// 이 파일은 인라인 키워드/멘션 토큰 삭제 동작을 검증합니다.
import { describe, expect, it } from "vitest";

import {
  buildDisplayedKeywordSuggestions,
  expandSelectionToObjectTokenBoundaries,
  extractInlineKeywords,
  getInlineObjectTokenRanges,
  getObjectMentionCreateCandidate,
  getInlineKeywordToken,
  getKeywordTokenUnwrapCandidate,
  getObjectToken,
  getObjectTokenDeleteSelection,
  getProtectedKeywordMarkerCaret,
  getSnappedObjectTokenCaret,
  hasObjectTokenInternalMutation,
  keywordCloudSlotCount,
  normalizeInlineKeywordTokens,
  removeAdjacentInlineToken,
  removeInlineSelectionWithTokenBoundaries,
  toggleInlineKeywordToken
} from "./workspaceShell.inlineEditor";

describe("workspaceShell.inlineEditor removeAdjacentInlineToken", () => {
  it("does not remove a keyword token when backspace is pressed inside the token", () => {
    const token = getInlineKeywordToken("pressure");
    const value = `start ${token} end`;
    const tokenStart = value.indexOf(token);
    const caretInsideToken = tokenStart + 3;

    const next = removeAdjacentInlineToken(value, caretInsideToken, "backward");

    expect(next).toBeNull();
  });

  it("does not remove a keyword token when delete is pressed inside the token", () => {
    const token = getInlineKeywordToken("hesitation");
    const value = `start ${token} end`;
    const tokenStart = value.indexOf(token);
    const caretInsideToken = tokenStart + 2;

    const next = removeAdjacentInlineToken(value, caretInsideToken, "forward");

    expect(next).toBeNull();
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

  it("leaves keyword range deletion to normal text editing", () => {
    const keywordToken = getInlineKeywordToken("pressure");
    const value = `beat ${keywordToken} closes`;
    const tokenStart = value.indexOf(keywordToken);
    const next = removeInlineSelectionWithTokenBoundaries(
      value,
      tokenStart + 2,
      tokenStart + 8
    );

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
    expect(getObjectMentionCreateCandidate("hero", [
      { name: "Hero" }
    ])).toBeNull();
    expect(getObjectMentionCreateCandidate("Heroine's Mother", [
      { name: "heroine's mother" }
    ])).toBeNull();
    expect(getObjectMentionCreateCandidate("x".repeat(81), [])).toBeNull();
  });
});

describe("workspaceShell.inlineEditor object token atomic editing", () => {
  it("parses object token ranges separately from keyword tokens", () => {
    const objectToken = getObjectToken("Heroine's Mother");
    const keywordToken = getInlineKeywordToken("pressure");
    const value = `${keywordToken} meets ${objectToken}`;

    expect(getInlineObjectTokenRanges(value)).toEqual([
      {
        end: value.length,
        label: "Heroine's Mother",
        markerEnd: value.length - 1,
        markerStart: value.indexOf(objectToken),
        objectId: null,
        start: value.indexOf(objectToken)
      }
    ]);
  });

  it("snaps an object-token caret to the requested boundary", () => {
    const objectToken = getObjectToken("Heroine's Mother");
    const value = `beat ${objectToken} closes`;
    const tokenStart = value.indexOf(objectToken);
    const caretInsideToken = tokenStart + 4;

    expect(getSnappedObjectTokenCaret(value, caretInsideToken, "backward")).toBe(
      tokenStart
    );
    expect(getSnappedObjectTokenCaret(value, caretInsideToken, "forward")).toBe(
      tokenStart + objectToken.length
    );
  });

  it("selects an object token first and deletes it only after the full token is selected", () => {
    const objectToken = getObjectToken("Heroine's Mother");
    const value = `beat ${objectToken} closes`;
    const tokenStart = value.indexOf(objectToken);
    const tokenEnd = tokenStart + objectToken.length;
    const firstDelete = getObjectTokenDeleteSelection(value, tokenEnd, "backward");

    expect(firstDelete).toEqual({
      selectionEnd: tokenEnd,
      selectionStart: tokenStart
    });

    const expandedSelection = expandSelectionToObjectTokenBoundaries(
      value,
      tokenStart + 2,
      tokenStart + 8
    );

    expect(expandedSelection).toEqual({
      selectionEnd: tokenEnd,
      selectionStart: tokenStart
    });
  });

  it("detects object token label or marker damage but allows keyword label edits", () => {
    const objectToken = getObjectToken("Heroine's Mother");

    expect(
      hasObjectTokenInternalMutation(
        `beat ${objectToken}`,
        `beat ${getObjectToken("Heroine's Motheer")}`
      )
    ).toBe(true);
    expect(
      hasObjectTokenInternalMutation(
        `beat ${objectToken}`,
        "beat Heroine's Mother"
      )
    ).toBe(true);
    expect(hasObjectTokenInternalMutation("beat", "beat")).toBe(false);
  });
});

describe("workspaceShell.inlineEditor keyword token editing", () => {
  it("unwraps keyword markers at the boundary while preserving the label", () => {
    const keywordToken = getInlineKeywordToken("pressure");
    const value = `beat ${keywordToken} closes`;
    const tokenStart = value.indexOf(keywordToken);
    const candidate = getKeywordTokenUnwrapCandidate(
      value,
      tokenStart + keywordToken.length
    );

    expect(candidate).toMatchObject({
      nextCaret: tokenStart + "pressure".length,
      nextText: "beat pressure closes",
      tokenEnd: tokenStart + keywordToken.length,
      tokenStart
    });
  });

  it("protects keyword marker deletion while allowing label-edge typing", () => {
    const keywordToken = getInlineKeywordToken("pressure");
    const value = `beat ${keywordToken} closes`;
    const tokenStart = value.indexOf(keywordToken);

    expect(getProtectedKeywordMarkerCaret(value, tokenStart, "forward")).toBe(
      tokenStart + 1
    );
    expect(
      getProtectedKeywordMarkerCaret(
        value,
        tokenStart + keywordToken.length - 1,
        "forward"
      )
    ).toBe(tokenStart + keywordToken.length - 1);
  });

  it("removes empty keyword tokens and de-duplicates edited labels case-insensitively", () => {
    const emptyToken = getInlineKeywordToken(" ");
    const value = `${getInlineKeywordToken("student")} ${getInlineKeywordToken("Student")} ${emptyToken}`;

    expect(normalizeInlineKeywordTokens(value)).toBe(
      `${getInlineKeywordToken("student")} ${getInlineKeywordToken("Student")} `
    );
    expect(
      normalizeInlineKeywordTokens(value)
        .match(/\u2063/g)
        ?.length
    ).toBe(2);
    expect(extractInlineKeywords(normalizeInlineKeywordTokens(value))).toEqual([
      "student"
    ]);
  });

  it("inserts a cloud keyword outside the currently edited keyword token", () => {
    const editedToken = getInlineKeywordToken("pressure spik");
    const value = `beat ${editedToken} closes`;
    const tokenStart = value.indexOf(editedToken);
    const caretInsideLabel = tokenStart + editedToken.length - 2;
    const next = toggleInlineKeywordToken(
      value,
      "pressure spike",
      caretInsideLabel,
      caretInsideLabel
    );

    expect(next.nextText).toBe(
      `beat ${editedToken} ${getInlineKeywordToken("pressure spike")} closes`
    );
  });

  it("does not add a trailing space after a keyword inserted at the end", () => {
    const token = getInlineKeywordToken("pressure spike");
    const next = toggleInlineKeywordToken("", "pressure spike", 0, 0);

    expect(next.nextText).toBe(token);
    expect(next.nextCaret).toBe(next.nextText.length);
  });
});
