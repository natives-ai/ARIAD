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

type RecommendationLanguage = RecommendationContext["language"];
type NonEnglishRecommendationLanguage = Exclude<RecommendationLanguage, "en">;

const localizedSeedLabels: Record<
  NonEnglishRecommendationLanguage,
  Record<RecommendationContext["nodeLevel"], string[]>
> = {
  ja: {
    detail: [
      "隠れた意図",
      "息を止める瞬間",
      "横目の合図",
      "返事の遅れ",
      "強く握る手",
      "逸らした視線",
      "抑えた怒り",
      "半分の真実",
      "作った平静",
      "小さな後退",
      "かわす一言",
      "静かな脅し"
    ],
    major: [
      "転換点",
      "エピソードのフック",
      "厳しい選択",
      "表面化する余波",
      "関係の変化",
      "力関係の逆転",
      "圧力の急上昇",
      "感情の転換",
      "望まぬ暴露",
      "強制的な別離",
      "最後の警告",
      "越えた一線"
    ],
    minor: [
      "ためらいのビート",
      "高まる圧力",
      "読み違えた合図",
      "防御的な返事",
      "間を置く瞬間",
      "因果のひと押し",
      "場面の転換",
      "関係の圧力",
      "不安定な同盟",
      "表面上の礼儀",
      "遅れた答え",
      "行動の進行"
    ]
  },
  ko: {
    detail: [
      "숨은 의도",
      "멈춘 숨",
      "곁눈질",
      "늦어진 대답",
      "꽉 쥔 손",
      "피한 시선",
      "눌린 분노",
      "반쪽 진실",
      "억지 평온",
      "작은 후퇴",
      "회피하는 대사",
      "조용한 위협"
    ],
    major: [
      "전환점",
      "에피소드 후크",
      "어려운 선택",
      "드러난 후폭풍",
      "관계 변화",
      "권력 역전",
      "압박 고조",
      "감정 전환",
      "원치 않은 폭로",
      "강제 이별",
      "마지막 경고",
      "넘어선 선"
    ],
    minor: [
      "망설임 비트",
      "높아지는 압박",
      "오해한 신호",
      "방어적 대답",
      "호흡을 늦추는 순간",
      "인과의 밀어붙임",
      "장면 전환",
      "관계 압박",
      "불안정한 동맹",
      "겉도는 예의",
      "늦어진 답",
      "행동 진행"
    ]
  }
};

const localizedReasonCopy: Record<
  RecommendationLanguage,
  Record<"fallback" | "seed", string>
> = {
  en: {
    fallback: "Keeps the cloud anchored to the current episode context.",
    seed: "Keeps the suggestion useful at the current node level."
  },
  ja: {
    fallback: "現在のエピソード文脈に沿った候補です。",
    seed: "現在のノード粒度で使いやすい候補です。"
  },
  ko: {
    fallback: "현재 에피소드 맥락에 맞춘 제안입니다.",
    seed: "현재 노드 단계에서 바로 쓰기 좋은 제안입니다."
  }
};

const englishDynamicSuffixes: Record<
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

const dynamicSuffixesByLanguage: Record<
  RecommendationLanguage,
  Record<RecommendationContext["nodeLevel"], Array<{ reason: string; suffix: string }>>
> = {
  en: englishDynamicSuffixes,
  ja: {
    detail: [
      { reason: "文脈の手がかりを細部の感情サインに変えます。", suffix: "の視線" },
      { reason: "ジェスチャーと含みを保った候補です。", suffix: "の間" },
      { reason: "小さな露見としてビートを着地させます。", suffix: "の気配" }
    ],
    major: [
      { reason: "文脈の手がかりを構造的なエピソードビートに変えます。", suffix: "の転換" },
      { reason: "決定的なエピソード上の動きとして扱います。", suffix: "の決断" },
      { reason: "結果と余波へ向かう候補です。", suffix: "の余波" }
    ],
    minor: [
      { reason: "文脈の手がかりを圧力のある橋渡しビートに変えます。", suffix: "の圧力" },
      { reason: "場面の動きに結びつく候補です。", suffix: "の転換" },
      { reason: "大きな事件にせず因果を少し押します。", suffix: "の変化" }
    ]
  },
  ko: {
    detail: [
      { reason: "맥락 단서를 세부 감정 신호로 바꿉니다.", suffix: "시선" },
      { reason: "제스처와 숨은 의미에 맞춘 제안입니다.", suffix: "멈춤" },
      { reason: "작은 드러남으로 비트를 착지시킵니다.", suffix: "기척" }
    ],
    major: [
      { reason: "맥락 단서를 구조적인 에피소드 비트로 바꿉니다.", suffix: "전환" },
      { reason: "결정적인 에피소드 움직임으로 잡아 줍니다.", suffix: "결정" },
      { reason: "결과와 후폭풍으로 밀어 주는 제안입니다.", suffix: "후폭풍" }
    ],
    minor: [
      { reason: "맥락 단서를 압박감 있는 연결 비트로 바꿉니다.", suffix: "압박" },
      { reason: "장면의 움직임에 붙는 제안입니다.", suffix: "전환" },
      { reason: "큰 사건으로 키우지 않고 인과를 살짝 밀어 줍니다.", suffix: "변화" }
    ]
  }
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

function getLevelSeedSuggestions(context: RecommendationContext) {
  if (context.language === "en") {
    return levelSeedSuggestions[context.nodeLevel];
  }

  return localizedSeedLabels[context.language][context.nodeLevel].map((label) => ({
    label,
    reason: localizedReasonCopy[context.language].seed
  }));
}

function getFallbackCueLabel(context: RecommendationContext, index: number) {
  if (context.language === "ko") {
    const levelLabels: Record<RecommendationContext["nodeLevel"], string> = {
      detail: "세부",
      major: "주요",
      minor: "보조"
    };

    return `${levelLabels[context.nodeLevel]} 단서 ${index}`;
  }

  if (context.language === "ja") {
    const levelLabels: Record<RecommendationContext["nodeLevel"], string> = {
      detail: "詳細",
      major: "主要",
      minor: "補助"
    };

    return `${levelLabels[context.nodeLevel]}手がかり ${index}`;
  }

  return `${toTitleCase(context.nodeLevel)} cue ${index}`;
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

  const dynamicSuffixes = dynamicSuffixesByLanguage[context.language];

  for (const phrase of extractAnchorPhrases(context)) {
    for (const template of dynamicSuffixes[context.nodeLevel]) {
      pushSuggestion({
        label: `${phrase} ${template.suffix}`,
        reason: template.reason
      });
    }
  }

  for (const suggestion of getLevelSeedSuggestions(context)) {
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
      reason: localizedReasonCopy[context.language].fallback
    });
  }

  while (suggestions.length < 25) {
    const index = suggestions.length + 1;
    pushSuggestion({
      label: getFallbackCueLabel(context, index),
      reason:
        context.language === "ko"
          ? "현재 노드의 이야기 단계를 유지하며 클라우드를 채웁니다."
          : context.language === "ja"
            ? "現在のノードの物語粒度を保ちながら候補を補います。"
            : "Fills the cloud while keeping it within the node's current storytelling granularity."
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

function buildLocalizedSentenceSuggestions(
  context: RecommendationContext,
  keywords: string[],
  focus: string
) {
  const [firstKeyword, secondKeyword, thirdKeyword] = [
    keywords[0] ?? (context.language === "ko" ? "압박" : "圧力"),
    keywords[1] ?? (context.language === "ko" ? "망설임" : "ためらい"),
    keywords[2] ?? (context.language === "ko" ? "변화" : "変化")
  ];

  if (context.language === "ko") {
    switch (context.nodeLevel) {
      case "major":
        return [
          {
            reason: "에피소드를 바꾸는 결정적인 규모를 유지합니다.",
            text: `${firstKeyword}이 전환점으로 굳어지고, ${secondKeyword}이 이야기를 ${focus} 쪽으로 밀어낸다.`
          },
          {
            reason: "노드를 결과가 분명한 주요 사건으로 다룹니다.",
            text: `${firstKeyword}의 선택이 ${secondKeyword}을 촉발하며, 장면은 ${focus}로 향하는 주요 비트가 된다.`
          },
          {
            reason: "장면을 과하게 쓰지 않고 에피소드 후크를 정리합니다.",
            text: `${firstKeyword}이 균형을 깨고 ${secondKeyword}이 대가를 키우며, 이야기는 ${focus} 쪽으로 기운다.`
          }
        ];
      case "minor":
        return [
          {
            reason: "장면을 잇는 보조 이벤트 범위에 맞춥니다.",
            text: `${firstKeyword} 교환이 ${secondKeyword}을 더하며 장면을 ${focus}에 가깝게 민다.`
          },
          {
            reason: "클라이맥스로 뛰지 않고 인과 다리를 만듭니다.",
            text: `${firstKeyword}이 먼저 드러나고, ${secondKeyword}이 조용히 비트를 ${focus} 쪽으로 옮긴다.`
          },
          {
            reason: "창작자의 문장을 남겨 두면서 장면을 움직입니다.",
            text: `작지만 긴장된 순간 속에서 ${firstKeyword}이 ${thirdKeyword}을 부추기며 ${focus}를 준비한다.`
          }
        ];
      case "detail":
        return [
          {
            reason: "세부 감정과 제스처 보조에 집중합니다.",
            text: `${firstKeyword}의 멈춤이 ${secondKeyword}을 드러내고, 말보다 먼저 속뜻이 보인다.`
          },
          {
            reason: "완성 대사보다 서브텍스트로 쓰기 좋게 유지합니다.",
            text: `${firstKeyword}이 비트 안으로 스며들고, 그 아래의 ${secondKeyword}이 더는 숨겨지지 않는다.`
          },
          {
            reason: "창작자가 확장하거나 바꿀 수 있는 압축된 디테일입니다.",
            text: `대답은 부드럽게 내려앉지만 ${firstKeyword}과 ${thirdKeyword}이 숨은 긴장을 읽히게 한다.`
          }
        ];
    }
  }

  switch (context.nodeLevel) {
    case "major":
      return [
        {
          reason: "エピソードを動かす決定的な規模を保ちます。",
          text: `${firstKeyword}が転換点として固まり、${secondKeyword}がエピソードを${focus}へ押し出す。`
        },
        {
          reason: "結果の見える主要イベントとして扱います。",
          text: `${firstKeyword}の動きが${secondKeyword}を引き起こし、場面は${focus}へ向かう主要ビートになる。`
        },
        {
          reason: "場面を書き過ぎず、エピソードのフックを整えます。",
          text: `${firstKeyword}が均衡を破り、${secondKeyword}が代償を高め、物語は${focus}へ傾く。`
        }
      ];
    case "minor":
      return [
        {
          reason: "場面をつなぐ補助イベントの範囲に合わせます。",
          text: `${firstKeyword}のやり取りが${secondKeyword}を加え、場面を${focus}へ近づける。`
        },
        {
          reason: "クライマックスへ飛ばずに因果の橋を作ります。",
          text: `${firstKeyword}が先に表れ、${secondKeyword}が静かにビートを${focus}へずらす。`
        },
        {
          reason: "作者自身の表現余地を残しながら場面を進めます。",
          text: `小さく緊張した瞬間の中で、${firstKeyword}が${thirdKeyword}を促し、${focus}を準備する。`
        }
      ];
    case "detail":
      return [
        {
          reason: "細部の感情とジェスチャー補助に集中します。",
          text: `${firstKeyword}の間が${secondKeyword}をにじませ、言葉より先に本音が見える。`
        },
        {
          reason: "完成台詞ではなくサブテキストとして使いやすく保ちます。",
          text: `${firstKeyword}がビートに入り込み、その下の${secondKeyword}が隠せなくなる。`
        },
        {
          reason: "作者が広げたり置き換えたりできる圧縮されたディテールです。",
          text: `返事は柔らかく落ちるが、${firstKeyword}と${thirdKeyword}が隠れた緊張を読ませる。`
        }
      ];
  }

  return [];
}

function buildSentenceSuggestions(context: RecommendationContext) {
  const keywords = pickKeywords(context);
  const [firstKeyword, secondKeyword, thirdKeyword] = [
    keywords[0] ?? "pressure",
    keywords[1] ?? "hesitation",
    keywords[2] ?? "shift"
  ];
  const focus = shortenFocus(context.focus);

  if (context.language !== "en") {
    return buildLocalizedSentenceSuggestions(context, keywords, focus);
  }

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

  return [];
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
