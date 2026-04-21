import type {
  KeywordRecommendationRequest,
  KeywordRecommendationResponse,
  SentenceRecommendationRequest,
  SentenceRecommendationResponse
} from "@scenaairo/recommendation";

export class RecommendationClient {
  constructor(private readonly apiBaseUrl: string) {}

  async getKeywordSuggestions(request: KeywordRecommendationRequest) {
    return this.post<KeywordRecommendationResponse>("/recommendation/keywords", request);
  }

  async getSentenceSuggestions(request: SentenceRecommendationRequest) {
    return this.post<SentenceRecommendationResponse>(
      "/recommendation/sentences",
      request
    );
  }

  private async post<TResponse>(path: string, payload: object) {
    const response = await fetch(`${this.apiBaseUrl}${path}`, {
      body: JSON.stringify(payload),
      headers: {
        "Content-Type": "application/json"
      },
      method: "POST"
    });

    if (!response.ok) {
      const error = await response
        .json()
        .catch(() => ({ message: "recommendation_failed" })) as { message?: string };

      throw new Error(error.message ?? "recommendation_failed");
    }

    return response.json() as Promise<TResponse>;
  }
}
