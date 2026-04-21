import { describe, expect, it } from "vitest";

import { createRecommendationService } from "./index.js";
import {
  createHeuristicRecommendationProvider,
  createStaticRecommendationProvider
} from "../provider/index.js";

describe("recommendation service baseline", () => {
  it("returns provider-backed keyword suggestions", async () => {
    const service = createRecommendationService(
      createStaticRecommendationProvider({
        keywords: [
          { label: "Confrontation", reason: "Raises the scene temperature." }
        ]
      })
    );

    await expect(
      service.getKeywordSuggestions({
        story: {
          episodeEndpoint: "The mother orders the lead away.",
          episodeObjective: "Bridge a tense meeting to the episode hook.",
          existingKeywords: [],
          lockedFacts: ["The heroine's mother intervenes at the end."],
          nodeLevel: "minor",
          nodeText: "",
          objectAnchors: ["Mother: authority pressure"],
          parentSummary: null,
          projectSummary: "A weekly workspace for episode structure.",
          projectTitle: "Cafe Confrontation"
        }
      })
    ).resolves.toEqual({
      suggestions: [
        { label: "Confrontation", reason: "Raises the scene temperature." }
      ]
    });
  });

  it("returns provider-backed sentence suggestions only after keywords are selected", async () => {
    const service = createRecommendationService(
      createStaticRecommendationProvider({
        keywords: [{ label: "Confrontation", reason: "Raises the scene temperature." }],
        sentences: [
          {
            reason: "Keeps the beat short.",
            text: "A tense reply sharpens the confrontation before the episode hook lands."
          }
        ]
      })
    );

    await expect(
      service.getSentenceSuggestions({
        selectedKeywords: ["confrontation"],
        story: {
          episodeEndpoint: "The mother orders the lead away.",
          episodeObjective: "Bridge a tense meeting to the episode hook.",
          existingKeywords: ["confrontation"],
          lockedFacts: ["The heroine's mother intervenes at the end."],
          nodeLevel: "minor",
          nodeText: "",
          objectAnchors: ["Mother: authority pressure"],
          parentSummary: null,
          projectSummary: "A weekly workspace for episode structure.",
          projectTitle: "Cafe Confrontation"
        }
      })
    ).resolves.toEqual({
      suggestions: [
        {
          reason: "Keeps the beat short.",
          text: "A tense reply sharpens the confrontation before the episode hook lands."
        }
      ]
    });
  });

  it("generates a full keyword cloud and gated sentence fallbacks with the heuristic provider", async () => {
    const service = createRecommendationService(createHeuristicRecommendationProvider());

    const keywordResponse = await service.getKeywordSuggestions({
      story: {
        episodeEndpoint: "The mother orders the lead away.",
        episodeObjective: "Bridge a tense meeting to the episode hook.",
        existingKeywords: [],
        lockedFacts: ["The heroine's mother intervenes at the end."],
        nodeLevel: "detail",
        nodeText: "",
        objectAnchors: ["Mother: authority pressure", "Cafe: public exposure"],
        parentSummary: "rising pressure",
        projectSummary: "A weekly workspace for episode structure.",
        projectTitle: "Cafe Confrontation"
      }
    });

    expect(keywordResponse.suggestions).toHaveLength(25);

    const sentenceResponse = await service.getSentenceSuggestions({
      selectedKeywords: keywordResponse.suggestions.slice(0, 2).map((suggestion) => suggestion.label),
      story: {
        episodeEndpoint: "The mother orders the lead away.",
        episodeObjective: "Bridge a tense meeting to the episode hook.",
        existingKeywords: [],
        lockedFacts: ["The heroine's mother intervenes at the end."],
        nodeLevel: "detail",
        nodeText: "",
        objectAnchors: ["Mother: authority pressure", "Cafe: public exposure"],
        parentSummary: "rising pressure",
        projectSummary: "A weekly workspace for episode structure.",
        projectTitle: "Cafe Confrontation"
      }
    });

    expect(sentenceResponse.suggestions).toHaveLength(3);
    expect(sentenceResponse.suggestions[0]?.text.toLowerCase()).toContain(
      keywordResponse.suggestions[0]!.label.toLowerCase().split(" ")[0]!
    );
  });

  it("rejects sentence requests with no selected keywords", async () => {
    const service = createRecommendationService(createHeuristicRecommendationProvider());

    await expect(
      service.getSentenceSuggestions({
        selectedKeywords: [],
        story: {
          episodeEndpoint: "The mother orders the lead away.",
          episodeObjective: "Bridge a tense meeting to the episode hook.",
          existingKeywords: [],
          lockedFacts: ["The heroine's mother intervenes at the end."],
          nodeLevel: "minor",
          nodeText: "",
          objectAnchors: [],
          parentSummary: null,
          projectSummary: "A weekly workspace for episode structure.",
          projectTitle: "Cafe Confrontation"
        }
      })
    ).rejects.toThrowError("selected_keywords_required");
  });
});
