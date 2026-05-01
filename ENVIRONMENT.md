# Environment Discipline

ARIAD uses environment variables for environment-specific configuration.

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
- `backend/.env.example` is the runtime source-of-truth for server and recommendation provider values.
- Google login configuration must be aligned:
  - `frontend`: `VITE_GOOGLE_CLIENT_ID`
  - `backend`: `GOOGLE_CLIENT_ID`
  - Both must point to the same Google OAuth client ID for `/api/auth/google/login` session exchange to succeed.

Deferred:
- auth provider choice
- recommendation provider choice
- deployment-managed secret storage
- production credential rotation
