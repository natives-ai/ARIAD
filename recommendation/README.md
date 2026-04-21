# Recommendation Boundary Baseline

This module is reserved for recommendation logic that must remain separable from frontend UI code and backend persistence code.

Service-boundary intent:
- context assembly
- request and response contracts
- provider integration
- application orchestration

Deferred in this slice:
- provider choice
- framework or runtime choice
- transport or deployment model
- prompt implementation details
- concrete recommendation schemas
- concrete evaluation fixtures

Folder intent:
- `context/` prepares recommendation inputs from approved story context.
- `contracts/` defines recommendation-facing request and response shapes once needed.
- `provider/` isolates model-provider integration behind the recommendation boundary.
- `orchestration/` coordinates application-side recommendation flow without absorbing UI or persistence concerns.
