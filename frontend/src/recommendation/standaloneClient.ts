import {
  createHeuristicRecommendationProvider,
  createRecommendationService,
  type KeywordRecommendationRequest,
  type KeywordRecommendationResponse,
  type SentenceRecommendationRequest,
  type SentenceRecommendationResponse
} from "@scenaairo/recommendation";

export class StandaloneRecommendationClient {
  private readonly service = createRecommendationService(
    createHeuristicRecommendationProvider()
  );

  async getKeywordSuggestions(request: KeywordRecommendationRequest) {
    return this.service.getKeywordSuggestions(request) as Promise<KeywordRecommendationResponse>;
  }

  async getSentenceSuggestions(request: SentenceRecommendationRequest) {
    return this.service.getSentenceSuggestions(request) as Promise<SentenceRecommendationResponse>;
  }
}
