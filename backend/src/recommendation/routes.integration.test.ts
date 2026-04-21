import { afterEach, describe, expect, it } from "vitest";
import type {
  KeywordRecommendationRequest,
  SentenceRecommendationRequest
} from "@scenaairo/recommendation";

import { buildApp } from "../app.js";

describe("recommendation routes integration", () => {
  const appsToClose: ReturnType<typeof buildApp>[] = [];

  afterEach(async () => {
    await Promise.all(appsToClose.map((app) => app.close()));
    appsToClose.length = 0;
  });

  it("returns a full keyword cloud for an explicit keyword request", async () => {
    const app = buildApp();
    appsToClose.push(app);
    await app.ready();

    const response = await app.inject({
      method: "POST",
      payload: {
        story: {
          episodeEndpoint: "The heroine's mother orders the lead away.",
          episodeObjective: "Bridge the tense meeting to the episode hook.",
          existingKeywords: [],
          lockedFacts: ["The heroine's mother intervenes at the end."],
          nodeLevel: "minor",
          nodeText: "",
          objectAnchors: ["Mother: authority pressure", "Cafe: public exposure"],
          parentSummary: "meeting, pressure, hesitation",
          projectSummary: "A weekly workspace for episode structure.",
          projectTitle: "Cafe Confrontation"
        }
      } satisfies KeywordRecommendationRequest,
      url: "/api/recommendation/keywords"
    });

    expect(response.statusCode).toBe(200);
    expect(response.json().suggestions).toHaveLength(25);
  });

  it("gates sentence suggestions until the user has selected at least one keyword", async () => {
    const app = buildApp();
    appsToClose.push(app);
    await app.ready();

    const blockedResponse = await app.inject({
      method: "POST",
      payload: {
        selectedKeywords: [],
        story: {
          episodeEndpoint: "The heroine's mother orders the lead away.",
          episodeObjective: "Bridge the tense meeting to the episode hook.",
          existingKeywords: [],
          lockedFacts: ["The heroine's mother intervenes at the end."],
          nodeLevel: "detail",
          nodeText: "",
          objectAnchors: ["Mother: authority pressure"],
          parentSummary: "rising pressure",
          projectSummary: "A weekly workspace for episode structure.",
          projectTitle: "Cafe Confrontation"
        }
      } satisfies SentenceRecommendationRequest,
      url: "/api/recommendation/sentences"
    });

    expect(blockedResponse.statusCode).toBe(400);
    expect(blockedResponse.json()).toEqual({
      message: "selected_keywords_required"
    });
  });

  it("returns three sentence suggestions after the user selects keywords", async () => {
    const app = buildApp();
    appsToClose.push(app);
    await app.ready();

    const response = await app.inject({
      method: "POST",
      payload: {
        selectedKeywords: ["rising pressure", "defensive reply"],
        story: {
          episodeEndpoint: "The heroine's mother orders the lead away.",
          episodeObjective: "Bridge the tense meeting to the episode hook.",
          existingKeywords: ["rising pressure", "defensive reply"],
          lockedFacts: ["The heroine's mother intervenes at the end."],
          nodeLevel: "minor",
          nodeText: "",
          objectAnchors: ["Mother: authority pressure", "Cafe: public exposure"],
          parentSummary: "meeting, pressure, hesitation",
          projectSummary: "A weekly workspace for episode structure.",
          projectTitle: "Cafe Confrontation"
        }
      } satisfies SentenceRecommendationRequest,
      url: "/api/recommendation/sentences"
    });

    expect(response.statusCode).toBe(200);
    expect(response.json().suggestions).toHaveLength(3);
    expect(response.json().suggestions[0].text).toContain("pressure");
  });
});
