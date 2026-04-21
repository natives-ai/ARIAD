# Recommendation Provider Integration

Use this folder for provider-facing integration that stays behind the recommendation boundary.

Keep out:
- product-level policy decisions
- frontend invocation logic
- backend persistence orchestration

Deferred in this slice:
- provider selection
- API client setup
- retry and rate-limit policy
