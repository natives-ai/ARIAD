import { afterEach, describe, expect, it } from "vitest";

import { buildApp } from "./app.js";

describe("backend baseline", () => {
  const appsToClose: ReturnType<typeof buildApp>[] = [];

  afterEach(async () => {
    await Promise.all(appsToClose.map((app) => app.close()));
    appsToClose.length = 0;
  });

  it("serves a health endpoint", async () => {
    const app = buildApp();
    appsToClose.push(app);
    await app.ready();

    const response = await app.inject({
      method: "GET",
      url: "/api/health"
    });

    expect(response.statusCode).toBe(200);
    expect(response.json()).toEqual({
      environment: "local",
      service: "backend",
      status: "ok"
    });
  });

  it("serves the recommendation keyword endpoint", async () => {
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
          nodeLevel: "major",
          nodeText: "",
          objectAnchors: ["Mother: authority pressure"],
          parentSummary: null,
          projectSummary: "A weekly workspace for episode structure.",
          projectTitle: "Cafe Confrontation"
        }
      },
      url: "/api/recommendation/keywords"
    });

    expect(response.statusCode).toBe(200);
    expect(response.json().suggestions).toHaveLength(25);
  });
});
