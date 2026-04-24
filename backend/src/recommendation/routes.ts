import type { FastifyInstance } from "fastify";
import type {
  KeywordRecommendationRequest,
  SentenceRecommendationRequest
} from "@ariad/recommendation";
import {
  createHeuristicRecommendationProvider,
  createRecommendationService
} from "@ariad/recommendation";

export async function registerRecommendationRoutes(app: FastifyInstance) {
  const service = createRecommendationService(createHeuristicRecommendationProvider());

  app.post("/api/recommendation/keywords", async (request, reply) => {
    const body = request.body as KeywordRecommendationRequest;

    if (!body?.story) {
      return reply.status(400).send({
        message: "story is required"
      });
    }

    try {
      return await service.getKeywordSuggestions(body);
    } catch (error) {
      return reply.status(400).send({
        message: error instanceof Error ? error.message : "recommendation_failed"
      });
    }
  });

  app.post("/api/recommendation/sentences", async (request, reply) => {
    const body = request.body as SentenceRecommendationRequest;

    if (!body?.story) {
      return reply.status(400).send({
        message: "story is required"
      });
    }

    if (!Array.isArray(body.selectedKeywords) || body.selectedKeywords.length === 0) {
      return reply.status(400).send({
        message: "selected_keywords_required"
      });
    }

    try {
      return await service.getSentenceSuggestions(body);
    } catch (error) {
      return reply.status(400).send({
        message: error instanceof Error ? error.message : "recommendation_failed"
      });
    }
  });
}
