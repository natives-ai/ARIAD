# Local MySQL Setup (Test)

## 1) Start MySQL container

```bash
yarn db:mysql:up
```

## 2) Configure backend env

Use `backend/.env.example` values or set:

```env
PERSISTENCE_DRIVER=mysql
MYSQL_HOST=127.0.0.1
MYSQL_PORT=3306
MYSQL_USER=scenaairo
MYSQL_PASSWORD=scenaairo
MYSQL_DATABASE=scenaairo_local
MYSQL_READINESS_TIMEOUT_MS=1500
GOOGLE_CLIENT_ID=your-google-client-id.apps.googleusercontent.com
AUTH_SESSION_COOKIE_NAME=scenaairo_session
AUTH_SESSION_TTL_SECONDS=2592000
AUTH_COOKIE_SAME_SITE=lax
AUTH_COOKIE_SECURE=false
```

## 3) Run backend

```bash
yarn dev:backend
```

## 4) Logs / shutdown

```bash
yarn db:mysql:logs
yarn db:mysql:down
```

Readiness check:

```bash
curl http://127.0.0.1:3001/api/health/readiness
```

## 5) Created persistence tables

When `PERSISTENCE_DRIVER=mysql` is enabled, backend persistence uses normalized tables:

- `cloud_accounts` (future account/auth metadata; prepared for Google sign-in linkage)
- `cloud_sessions` (opaque session id + account binding for server session auth)
- `cloud_projects`
- `cloud_episodes`
- `cloud_objects`
- `cloud_nodes`
- `cloud_node_keywords`
- `cloud_node_object_links`
- `cloud_temporary_drawer`

`cloud_projects.snapshot_json` is still written for backward compatibility, but runtime CRUD is executed against the normalized tables.
