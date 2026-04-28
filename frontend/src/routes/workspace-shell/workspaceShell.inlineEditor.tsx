// 이 파일은 WorkspaceShell 인라인 편집/토큰 처리 함수를 제공합니다.
import type { ReactNode } from "react";
import type { KeywordSuggestion } from "@scenaairo/recommendation";

import {
  keywordTokenStart,
  keywordTokenEnd,
  objectTokenStart,
  objectTokenEnd
} from "./workspaceShell.constants";
import type { ObjectMentionQuery } from "./workspaceShell.types";

// 키워드 클라우드 고정 슬롯 수를 정의합니다.
export const keywordCloudSlotCount = 9;

export function escapeRegExp(value: string) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

export function getKeywordTokenPattern() {
  return new RegExp(
    `${escapeRegExp(keywordTokenStart)}([^${escapeRegExp(keywordTokenEnd)}\\n]+?)${escapeRegExp(keywordTokenEnd)}`,
    "g"
  );
}

export function getInlineKeywordToken(keyword: string) {
  return `${keywordTokenStart}${keyword}${keywordTokenEnd}`;
}

export function stripKeywordMarkers(value: string) {
  return value.replace(getKeywordTokenPattern(), "$1");
}

export function stripObjectMentionMarkers(value: string) {
  return value
    .replace(
      new RegExp(
        `${escapeRegExp(objectTokenStart)}([^${escapeRegExp(objectTokenEnd)}\\n]+?)${escapeRegExp(objectTokenEnd)}`,
        "g"
      ),
      "$1"
    )
    .replace(/@([^@\n]+?)@/g, "$1");
}

export function stripInlineFormattingMarkers(value: string) {
  return stripObjectMentionMarkers(stripKeywordMarkers(value));
}

export function extractInlineKeywords(value: string) {
  const matches = value.matchAll(getKeywordTokenPattern());
  const seenKeywords = new Set<string>();
  const keywords: string[] = [];

  for (const match of matches) {
    const nextKeyword = match[1]?.trim();

    if (!nextKeyword || seenKeywords.has(nextKeyword)) {
      continue;
    }

    seenKeywords.add(nextKeyword);
    keywords.push(nextKeyword);
  }

  return keywords;
}

export function buildInlineEditorText(text: string, keywords: string[]) {
  const normalizedText = normalizeInlineObjectMentions(text);

  if (extractInlineKeywords(normalizedText).length > 0 || keywords.length === 0) {
    return normalizedText;
  }

  const keywordPrefix = keywords.map(getInlineKeywordToken).join(" ");

  return normalizedText.trim() ? `${keywordPrefix} ${normalizedText}` : keywordPrefix;
}

export function extractDisplayText(value: string) {
  return stripInlineFormattingMarkers(value).trim();
}

export function extractObjectMentionNames(value: string) {
  const matches = value.matchAll(
    new RegExp(
      `${escapeRegExp(objectTokenStart)}([^${escapeRegExp(objectTokenEnd)}\\n]+?)${escapeRegExp(objectTokenEnd)}|@([^@\\n]+?)@`,
      "g"
    )
  );
  const uniqueNames = new Set<string>();
  const names: string[] = [];

  for (const match of matches) {
    const nextName = (match[1] ?? match[2])?.trim();

    if (!nextName) {
      continue;
    }

    const normalized = nextName.toLowerCase();

    if (uniqueNames.has(normalized)) {
      continue;
    }

    uniqueNames.add(normalized);
    names.push(nextName);
  }

  return names;
}

export function getOpenObjectMentionQuery(value: string, caretIndex: number): ObjectMentionQuery | null {
  const beforeCaret = value.slice(0, caretIndex);
  const mentionDelimiterIndexes = [...beforeCaret.matchAll(/@/g)].map((match) => match.index ?? -1);

  if (mentionDelimiterIndexes.length === 0 || mentionDelimiterIndexes.length % 2 === 0) {
    return null;
  }

  const start = mentionDelimiterIndexes.at(-1);

  if (start === undefined || start < 0) {
    return null;
  }

  const query = value.slice(start + 1, caretIndex);

  if (query.includes("\n")) {
    return null;
  }

  return {
    end: caretIndex,
    mode: "mention",
    query,
    start
  };
}

export function getObjectToken(name: string) {
  return `${objectTokenStart}${name}${objectTokenEnd}`;
}

export function normalizeInlineObjectMentions(value: string) {
  return value.replace(/@([^@\n]+?)@/g, (_, name: string) => getObjectToken(name.trim()));
}

export function getClosedObjectWordQuery(
  value: string,
  caretIndex: number,
  objects: Array<{ name: string }>
): ObjectMentionQuery | null {
  const beforeCaret = value.slice(0, caretIndex);
  const afterCaret = value.slice(caretIndex);
  const trailingWhitespace = beforeCaret.match(/\s+$/)?.[0] ?? "";
  const comparisonBefore = trailingWhitespace
    ? beforeCaret.slice(0, -trailingWhitespace.length)
    : beforeCaret;

  if (!comparisonBefore || getOpenObjectMentionQuery(value, caretIndex)) {
    return null;
  }

  const match = [...objects]
    .sort((left, right) => right.name.length - left.name.length)
    .find((object) => {
      const objectName = object.name.toLowerCase();
      const lowerBefore = comparisonBefore.toLowerCase();

      if (!lowerBefore.endsWith(objectName)) {
        return false;
      }

      const start = comparisonBefore.length - object.name.length;
      const prevChar = start > 0 ? (comparisonBefore[start - 1] ?? "") : "";
      const nextChar = afterCaret[0] ?? "";

      return !/[A-Za-z0-9]/.test(prevChar) && !/[A-Za-z0-9]/.test(nextChar);
    });

  if (!match) {
    return null;
  }

  return {
    end: comparisonBefore.length,
    mode: "word",
    query: match.name,
    start: comparisonBefore.length - match.name.length
  };
}

export function renderTextWithObjectMentions(value: string) {
  const segments: ReactNode[] = [];
  const inlineTokenPattern = new RegExp(
    `${escapeRegExp(keywordTokenStart)}([^${escapeRegExp(keywordTokenEnd)}\\n]+?)${escapeRegExp(keywordTokenEnd)}|${escapeRegExp(objectTokenStart)}([^${escapeRegExp(objectTokenEnd)}\\n]+?)${escapeRegExp(objectTokenEnd)}|@([^@\\n]+?)@`,
    "g"
  );
  let lastIndex = 0;

  for (const match of value.matchAll(inlineTokenPattern)) {
    const matchIndex = match.index ?? 0;

    if (matchIndex > lastIndex) {
      segments.push(
        <span key={`text-${lastIndex}`}>{value.slice(lastIndex, matchIndex)}</span>
      );
    }

    if (match[1]) {
      segments.push(
        <span className="node-inline-keyword" key={`keyword-${matchIndex}`}>
          {match[1]}
        </span>
      );
    } else if (match[2] || match[3]) {
      segments.push(
        <span className="node-object-mention" key={`mention-${matchIndex}`}>
          {match[2] ?? match[3]}
        </span>
      );
    }

    lastIndex = matchIndex + match[0].length;
  }

  if (lastIndex < value.length) {
    segments.push(<span key={`text-${lastIndex}`}>{value.slice(lastIndex)}</span>);
  }

  return segments.length > 0 ? segments : stripInlineFormattingMarkers(value);
}

export function buildDisplayedKeywordSuggestions(
  selectedKeywords: string[],
  suggestions: KeywordSuggestion[],
  refreshCycle: number
) {
  const normalizedSelectedKeywords: string[] = [];
  const selectedLookup = new Set<string>();

  for (const keyword of selectedKeywords) {
    const normalizedKeyword = keyword.trim().toLowerCase();

    if (!normalizedKeyword || selectedLookup.has(normalizedKeyword)) {
      continue;
    }

    selectedLookup.add(normalizedKeyword);
    normalizedSelectedKeywords.push(keyword.trim());
  }

  const pinnedSuggestions = normalizedSelectedKeywords.map((keyword) => {
    const existingSuggestion =
      suggestions.find(
        (suggestion) => suggestion.label.toLowerCase() === keyword.toLowerCase()
      ) ?? null;

    return (
      existingSuggestion ?? {
        label: keyword,
        reason: "Pinned from the current node selection."
      }
    );
  });
  const remainingSuggestions: KeywordSuggestion[] = [];
  const remainingLookup = new Set<string>();

  for (const suggestion of suggestions) {
    const normalizedLabel = suggestion.label.trim().toLowerCase();

    if (
      !normalizedLabel ||
      selectedLookup.has(normalizedLabel) ||
      remainingLookup.has(normalizedLabel)
    ) {
      continue;
    }

    remainingLookup.add(normalizedLabel);
    remainingSuggestions.push(suggestion);
  }

  if (remainingSuggestions.length === 0) {
    return pinnedSuggestions.slice(0, keywordCloudSlotCount);
  }

  const rotation = refreshCycle > 0 ? refreshCycle % remainingSuggestions.length : 0;
  const rotatedSuggestions =
    rotation === 0
      ? remainingSuggestions
      : [
          ...remainingSuggestions.slice(rotation),
          ...remainingSuggestions.slice(0, rotation)
        ];

  return [...pinnedSuggestions, ...rotatedSuggestions].slice(0, keywordCloudSlotCount);
}

export function toggleInlineKeywordToken(
  value: string,
  keyword: string,
  selectionStart: number,
  selectionEnd: number
) {
  const token = getInlineKeywordToken(keyword);

  if (value.includes(token)) {
    const tokenIndex = value.indexOf(token);

    if (tokenIndex === -1) {
      return {
        nextCaret: selectionStart,
        nextText: value
      };
    }

    let removeStart = tokenIndex;
    let removeEnd = tokenIndex + token.length;

    if (value[removeEnd] === " ") {
      removeEnd += 1;
    } else if (removeStart > 0 && value[removeStart - 1] === " ") {
      removeStart -= 1;
    }

    return {
      nextCaret: removeStart,
      nextText: `${value.slice(0, removeStart)}${value.slice(removeEnd)}`
    };
  }

  const prefix = value.slice(0, selectionStart);
  const suffix = value.slice(selectionEnd);
  const needsLeadingSpace = prefix.length > 0 && !/[\s\n]$/.test(prefix);
  const needsTrailingSpace = suffix.length > 0 && !/^[\s\n]/.test(suffix);
  const insertion = `${needsLeadingSpace ? " " : ""}${token}${needsTrailingSpace ? " " : ""}`;

  return {
    nextCaret: prefix.length + insertion.length,
    nextText: `${prefix}${insertion}${suffix}`
  };
}

export function removeAdjacentInlineToken(
  value: string,
  caretIndex: number,
  direction: "backward" | "forward"
) {
  const tokenPattern = new RegExp(
    `${escapeRegExp(keywordTokenStart)}([^${escapeRegExp(keywordTokenEnd)}\\n]+?)${escapeRegExp(keywordTokenEnd)}|${escapeRegExp(objectTokenStart)}([^${escapeRegExp(objectTokenEnd)}\\n]+?)${escapeRegExp(objectTokenEnd)}|@([^@\\n]+?)@`,
    "g"
  );

  for (const match of value.matchAll(tokenPattern)) {
    const start = match.index ?? 0;
    const end = start + match[0].length;
    const touchesToken =
      direction === "backward"
        ? (caretIndex === end || (caretIndex > start && caretIndex <= end))
        : (caretIndex === start || (caretIndex >= start && caretIndex < end));

    if (!touchesToken) {
      continue;
    }

    let removeStart = start;
    let removeEnd = end;

    if (value[removeEnd] === " ") {
      removeEnd += 1;
    } else if (removeStart > 0 && value[removeStart - 1] === " ") {
      removeStart -= 1;
    }

    return {
      nextCaret: removeStart,
      nextText: `${value.slice(0, removeStart)}${value.slice(removeEnd)}`
    };
  }

  return null;
}

// 이 함수는 선택 영역이 토큰을 일부만 포함해도 토큰 단위로 안전하게 삭제합니다.
export function removeInlineSelectionWithTokenBoundaries(
  value: string,
  selectionStart: number,
  selectionEnd: number
) {
  const rangeStart = Math.min(selectionStart, selectionEnd);
  const rangeEnd = Math.max(selectionStart, selectionEnd);

  if (rangeStart === rangeEnd) {
    return null;
  }

  const tokenPattern = new RegExp(
    `${escapeRegExp(keywordTokenStart)}([^${escapeRegExp(keywordTokenEnd)}\\n]+?)${escapeRegExp(keywordTokenEnd)}|${escapeRegExp(objectTokenStart)}([^${escapeRegExp(objectTokenEnd)}\\n]+?)${escapeRegExp(objectTokenEnd)}|@([^@\\n]+?)@`,
    "g"
  );
  let removeStart = rangeStart;
  let removeEnd = rangeEnd;
  let touchedToken = false;

  for (const match of value.matchAll(tokenPattern)) {
    const start = match.index ?? 0;
    const end = start + match[0].length;
    const intersects = removeStart < end && removeEnd > start;

    if (!intersects) {
      continue;
    }

    touchedToken = true;
    removeStart = Math.min(removeStart, start);
    removeEnd = Math.max(removeEnd, end);
  }

  if (!touchedToken) {
    return null;
  }

  if (value[removeEnd] === " ") {
    removeEnd += 1;
  } else if (removeStart > 0 && value[removeStart - 1] === " ") {
    removeStart -= 1;
  }

  return {
    nextCaret: removeStart,
    nextText: `${value.slice(0, removeStart)}${value.slice(removeEnd)}`
  };
}

export function getObjectMentionSignature(value: string) {
  return extractObjectMentionNames(value)
    .map((name) => name.toLowerCase())
    .sort()
    .join("\u0001");
}
export function deriveNodeContentMode(text: string, keywords: string[]) {
  if (stripInlineFormattingMarkers(text).trim()) {
    return "text";
  }

  if (keywords.length > 0) {
    return "keywords";
  }

  return "empty";
}
