import { afterEach, describe, expect, it } from "vitest";

import { buildApp } from "./app.js";

describe("backend baseline", () => {
  const appsToClose: ReturnType<typeof buildApp>[] = [];
  const initialGoogleClientId = process.env.GOOGLE_CLIENT_ID;

  afterEach(async () => {
    await Promise.all(appsToClose.map((app) => app.close()));
    appsToClose.length = 0;

    if (initialGoogleClientId === undefined) {
      delete process.env.GOOGLE_CLIENT_ID;
    } else {
      process.env.GOOGLE_CLIENT_ID = initialGoogleClientId;
    }
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

  it("serves a readiness endpoint with ready status when MySQL and Google auth are configured", async () => {
    process.env.GOOGLE_CLIENT_ID = "test-client-id.apps.googleusercontent.com";

    const app = buildApp({
      mysqlReadinessProbe: async () => ({
        checkedAt: "2026-04-23T00:00:00.000Z",
        detail: null,
        durationMs: 5,
        reachable: true
      })
    });
    appsToClose.push(app);
    await app.ready();

    const response = await app.inject({
      method: "GET",
      url: "/api/health/readiness"
    });

    expect(response.statusCode).toBe(200);
    expect(response.json()).toEqual({
      checks: {
        googleAuthConfigured: true,
        mysql: {
          checkedAt: "2026-04-23T00:00:00.000Z",
          detail: null,
          durationMs: 5,
          reachable: true
        }
      },
      environment: "local",
      service: "backend",
      status: "ready"
    });

  });

  it("serves a readiness endpoint with degraded status when MySQL is unreachable", async () => {
    process.env.GOOGLE_CLIENT_ID = "test-client-id.apps.googleusercontent.com";

    const app = buildApp({
      mysqlReadinessProbe: async () => ({
        checkedAt: "2026-04-23T00:00:00.000Z",
        detail: "connect ECONNREFUSED",
        durationMs: 15,
        reachable: false
      })
    });
    appsToClose.push(app);
    await app.ready();

    const response = await app.inject({
      method: "GET",
      url: "/api/health/readiness"
    });

    expect(response.statusCode).toBe(503);
    expect(response.json()).toEqual({
      checks: {
        googleAuthConfigured: true,
        mysql: {
          checkedAt: "2026-04-23T00:00:00.000Z",
          detail: "connect ECONNREFUSED",
          durationMs: 15,
          reachable: false
        }
      },
      environment: "local",
      service: "backend",
      status: "degraded"
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
    expect(response.json().suggestions).toHaveLength(10);
  });
});
