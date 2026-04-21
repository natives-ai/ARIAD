export interface RecommendationEnv {
  apiKeyName: "RECOMMENDATION_API_KEY";
  appEnv: "local" | "dev" | "staging-like";
  model: string;
  provider: string;
}

function parseAppEnv(value: string | undefined): RecommendationEnv["appEnv"] {
  if (value === "dev" || value === "staging-like") {
    return value;
  }

  return "local";
}

export function loadRecommendationEnv(): RecommendationEnv {
  return {
    apiKeyName: "RECOMMENDATION_API_KEY",
    appEnv: parseAppEnv(process.env.APP_ENV),
    model: process.env.RECOMMENDATION_MODEL ?? "baseline",
    provider: process.env.RECOMMENDATION_PROVIDER ?? "stub"
  };
}
