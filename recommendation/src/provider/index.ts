import type {
  KeywordSuggestion,
  RecommendationContext,
  SentenceSuggestion
} from "../contracts/index.js";

const fillerWords = new Set([
  "a",
  "an",
  "and",
  "as",
  "at",
  "but",
  "for",
  "from",
  "her",
  "his",
  "into",
  "of",
  "on",
  "or",
  "the",
  "their",
  "to",
  "with"
]);

const levelSeedSuggestions: Record<
  RecommendationContext["nodeLevel"],
  KeywordSuggestion[]
> = {
  detail: [
    { label: "hidden intention", reason: "Keeps the beat focused on subtext rather than polished dialogue." },
    { label: "held breath", reason: "Adds a small physical cue that can carry tension." },
    { label: "side glance", reason: "Suggests an emotional signal without over-explaining it." },
    { label: "stalled reply", reason: "Creates a momentary hesitation that can sharpen the exchange." },
    { label: "tight grip", reason: "Turns the beat into a visible reaction cue." },
    { label: "averted eyes", reason: "Signals emotional pressure through a readable action." },
    { label: "muted anger", reason: "Keeps the detail emotionally active without turning it melodramatic." },
    { label: "half truth", reason: "Introduces implied meaning instead of direct exposition." },
    { label: "forced calm", reason: "Adds contrast between surface behavior and inner pressure." },
    { label: "small retreat", reason: "Suggests the character giving ground in a subtle way." },
    { label: "deflecting line", reason: "Offers a dialogue-level dodge without resolving the conflict." },
    { label: "quiet threat", reason: "Adds weight to the beat while staying compact." }
  ],
  major: [
    { label: "turning point", reason: "Keeps the node focused on episode-level direction." },
    { label: "episode hook", reason: "Strengthens the beat as a major story turn." },
    { label: "hard choice", reason: "Pushes the event toward a commitment or rupture." },
    { label: "public fallout", reason: "Adds visible consequences that can move the episode forward." },
    { label: "relationship shift", reason: "Frames the beat as a structural change rather than small dialogue." },
    { label: "power reversal", reason: "Raises stakes by changing who controls the scene." },
    { label: "pressure spike", reason: "Keeps the event large enough to matter on the major lane." },
    { label: "emotional pivot", reason: "Supports a major transition in the episode flow." },
    { label: "unwanted reveal", reason: "Adds a decisive disclosure with structural impact." },
    { label: "forced separation", reason: "Creates a clean episode-shaping disruption." },
    { label: "last warning", reason: "Pushes the story toward a stronger endpoint." },
    { label: "crossed line", reason: "Marks the moment as a meaningful escalation." }
  ],
  minor: [
    { label: "hesitation beat", reason: "Creates a useful bridge between major events." },
    { label: "rising pressure", reason: "Keeps scene energy climbing without jumping too far ahead." },
    { label: "misread signal", reason: "Adds friction that can complicate the next choice." },
    { label: "defensive reply", reason: "Supports emotional movement inside the scene." },
    { label: "pacing pause", reason: "Gives the beat breathing room while maintaining tension." },
    { label: "causal nudge", reason: "Helps the event push cleanly into the next structure unit." },
    { label: "scene pivot", reason: "Creates a change of direction without needing a full major turn." },
    { label: "relationship pressure", reason: "Keeps the beat centered on shifting dynamics." },
    { label: "unsteady alliance", reason: "Introduces instability that can feed the next scene." },
    { label: "surface politeness", reason: "Lets the beat carry tension under a calm exterior." },
    { label: "delayed answer", reason: "Creates a small but useful structural hold." },
    { label: "action progression", reason: "Pushes the scene physically forward while preserving subtext." }
  ]
};

const dynamicSuffixes: Record<
  RecommendationContext["nodeLevel"],
  Array<{ reason: string; suffix: string }>
> = {
  detail: [
    { reason: "Turns a context anchor into a detail-level emotional cue.", suffix: "glance" },
    { reason: "Keeps the suggestion specific to gesture and subtext.", suffix: "pause" },
    { reason: "Helps the beat land through a small reveal.", suffix: "tell" }
  ],
  major: [
    { reason: "Turns the context anchor into a structural episode beat.", suffix: "turn" },
    { reason: "Frames the anchor as a decisive episode move.", suffix: "decision" },
    { reason: "Pushes the anchor toward consequence and fallout.", suffix: "fallout" }
  ],
  minor: [
    { reason: "Turns the context anchor into a bridge beat with pressure.", suffix: "pressure" },
    { reason: "Keeps the suggestion tied to scene movement.", suffix: "pivot" },
    { reason: "Adds a causal push without making it a full major event.", suffix: "shift" }
  ]
};

function cleanList(values: string[]) {
  return [...new Set(values.map((value) => value.trim()).filter(Boolean))];
}

function toTitleCase(value: string) {
  return value
    .split(/\s+/)
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}

function extractAnchorPhrases(context: RecommendationContext) {
  const phrases: string[] = [];

  for (const anchor of context.anchors) {
    const tokens = anchor
      .toLowerCase()
      .split(/[^a-z0-9]+/)
      .filter((token) => token.length > 2 && !fillerWords.has(token));

    if (tokens.length === 0) {
      continue;
    }

    for (let index = 0; index < tokens.length; index += 2) {
      const phrase = toTitleCase(tokens.slice(index, index + 2).join(" "));

      if (phrase) {
        phrases.push(phrase);
      }
    }
  }

  return cleanList(phrases).slice(0, 6);
}

function buildKeywordSuggestions(context: RecommendationContext) {
  const suggestions: KeywordSuggestion[] = [];
  const seenLabels = new Set<string>();

  const pushSuggestion = (suggestion: KeywordSuggestion) => {
    const label = suggestion.label.trim().toLowerCase();

    if (!label || seenLabels.has(label)) {
      return;
    }

    seenLabels.add(label);
    suggestions.push({
      label: suggestion.label.trim(),
      reason: suggestion.reason.trim()
    });
  };

  for (const phrase of extractAnchorPhrases(context)) {
    for (const template of dynamicSuffixes[context.nodeLevel]) {
      pushSuggestion({
        label: `${phrase} ${template.suffix}`,
        reason: template.reason
      });
    }
  }

  for (const suggestion of levelSeedSuggestions[context.nodeLevel]) {
    pushSuggestion(suggestion);
  }

  const fallbackPhrases = cleanList([
    ...context.selectedKeywords,
    ...extractAnchorPhrases(context),
    context.focus
  ]);

  for (const phrase of fallbackPhrases) {
    pushSuggestion({
      label: toTitleCase(phrase),
      reason: "Keeps the cloud anchored to the current episode context."
    });
  }

  while (suggestions.length < 25) {
    const index = suggestions.length + 1;
    pushSuggestion({
      label: `${toTitleCase(context.nodeLevel)} cue ${index}`,
      reason: "Fills the cloud while keeping it within the node's current storytelling granularity."
    });
  }

  return suggestions.slice(0, 25);
}

function shortenFocus(value: string) {
  const words = value.trim().split(/\s+/).filter(Boolean);
  return words.slice(0, 7).join(" ");
}

function pickKeywords(context: RecommendationContext) {
  const keywords = cleanList(context.selectedKeywords);

  if (keywords.length > 0) {
    return keywords;
  }

  return buildKeywordSuggestions(context)
    .slice(0, 3)
    .map((suggestion) => suggestion.label.toLowerCase());
}

function buildSentenceSuggestions(context: RecommendationContext) {
  const keywords = pickKeywords(context);
  const [firstKeyword, secondKeyword, thirdKeyword] = [
    keywords[0] ?? "pressure",
    keywords[1] ?? "hesitation",
    keywords[2] ?? "shift"
  ];
  const focus = shortenFocus(context.focus);

  switch (context.nodeLevel) {
    case "major":
      return [
        {
          reason: "Keeps the beat at a decisive, episode-shaping scale.",
          text: `${toTitleCase(firstKeyword)} hardens into a turning point, and ${secondKeyword} pushes the episode toward ${focus}.`
        },
        {
          reason: "Treats the node like a major event with clear consequence.",
          text: `A ${firstKeyword} move triggers ${secondKeyword}, turning the scene into a major beat that points straight at ${focus}.`
        },
        {
          reason: "Builds a cleaner episode hook without over-writing the scene.",
          text: `${toTitleCase(firstKeyword)} breaks the balance, ${secondKeyword} raises the cost, and the story tilts toward ${focus}.`
        }
      ];
    case "minor":
      return [
        {
          reason: "Keeps the sentence in the scene-bridging minor-event range.",
          text: `A ${firstKeyword} exchange adds ${secondKeyword}, nudging the scene closer to ${focus}.`
        },
        {
          reason: "Creates a causal bridge without jumping to a full climax.",
          text: `${toTitleCase(firstKeyword)} surfaces first, and ${secondKeyword} quietly shifts the beat toward ${focus}.`
        },
        {
          reason: "Lets the scene move while preserving room for the creator's own phrasing.",
          text: `The moment stays small but tense as ${firstKeyword} feeds ${thirdKeyword} and sets up ${focus}.`
        }
      ];
    case "detail":
      return [
        {
          reason: "Focuses on detail-level emotional and gesture support.",
          text: `A ${firstKeyword} pause lets ${secondKeyword} show through before anyone says what they mean.`
        },
        {
          reason: "Keeps the line useful as subtext rather than polished final dialogue.",
          text: `${toTitleCase(firstKeyword)} slips into the beat, and the ${secondKeyword} underneath it becomes impossible to miss.`
        },
        {
          reason: "Offers a compact detail the creator can expand or replace.",
          text: `The response lands softly, but ${firstKeyword} and ${thirdKeyword} make the hidden tension readable.`
        }
      ];
  }
}

export interface RecommendationProvider {
  requestKeywords(context: RecommendationContext): Promise<KeywordSuggestion[]>;
  requestSentences(context: RecommendationContext): Promise<SentenceSuggestion[]>;
}

export function createStaticRecommendationProvider(
  suggestions: {
    keywords: KeywordSuggestion[];
    sentences?: SentenceSuggestion[];
  }
): RecommendationProvider {
  return {
    async requestKeywords(context) {
      if (!context.focus.trim()) {
        return [];
      }

      return suggestions.keywords;
    },
    async requestSentences(context) {
      if (context.selectedKeywords.length === 0) {
        return [];
      }

      return suggestions.sentences ?? [];
    }
  };
}

export function createHeuristicRecommendationProvider(): RecommendationProvider {
  return {
    async requestKeywords(context) {
      if (!context.focus.trim()) {
        return [];
      }

      return buildKeywordSuggestions(context);
    },
    async requestSentences(context) {
      if (context.selectedKeywords.length === 0) {
        return [];
      }

      return buildSentenceSuggestions(context);
    }
  };
}
