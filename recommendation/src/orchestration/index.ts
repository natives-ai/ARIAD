import {
  buildRecommendationContext
} from "../context/index.js";
import type {
  KeywordRecommendationRequest,
  KeywordRecommendationResponse,
  SentenceRecommendationRequest,
  SentenceRecommendationResponse
} from "../contracts/index.js";
import type { RecommendationProvider } from "../provider/index.js";

export function createRecommendationService(provider: RecommendationProvider) {
  return {
    async getKeywordSuggestions(
      request: KeywordRecommendationRequest
    ): Promise<KeywordRecommendationResponse> {
      const context = buildRecommendationContext(request);
      const suggestions = await provider.requestKeywords(context);

      return {
        suggestions
      };
    },
    async getSentenceSuggestions(
      request: SentenceRecommendationRequest
    ): Promise<SentenceRecommendationResponse> {
      if (request.selectedKeywords.length === 0) {
        throw new Error("selected_keywords_required");
      }

      const context = buildRecommendationContext(request);
      const suggestions = await provider.requestSentences(context);

      return {
        suggestions
      };
    }
  };
}
