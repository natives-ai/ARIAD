# Environment Discipline

SCENAAIRO uses environment variables for environment-specific configuration.

Environment depth:
- `local`
- `dev`
- `staging-like`

Rules:
- Keep real secret values out of the repository.
- Commit only example files such as `.env.example`.
- Use secret names and configuration contracts in code, not hardcoded values.
- Treat auth, provider, payment, deployment, and credential operations as approval-required work.

Current baseline:
- `frontend/.env.example` documents browser-facing values.
- `backend/.env.example` documents server runtime values.
- `recommendation/.env.example` documents recommendation-module expectations.

Deferred:
- auth provider choice
- recommendation provider choice
- deployment-managed secret storage
- production credential rotation
