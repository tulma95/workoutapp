# Deployment (Coolify)

The app ships as a **single Docker image** (`Dockerfile`) that serves the Express API and the built frontend on one port (`3001` by default). Production runs on [Coolify](https://coolify.io); the database is a managed/standalone PostgreSQL.

## How a deploy happens

1. Push to `main` triggers `.github/workflows/deploy.yml`.
2. `deploy.sh` runs the gate, then builds & pushes the image:
   - **Step 0** — production dependency audit (`scripts/audit-gate.mjs`, allowlist by advisory ID).
   - **Step 1** — backend integration tests against a real Postgres.
   - **Step 2/3** — build the production image and run the Playwright E2E suite against it.
   - On success, push the image to `ghcr.io/<owner>/treenisofta`.
3. The **Redeploy on Coolify** step calls Coolify's API so it pulls the new image and redeploys.
4. On container start, `docker-entrypoint.sh` runs `npx prisma migrate deploy` (migrations auto-apply), then boots the server.
5. Coolify gates the rollout on the image `HEALTHCHECK` (`GET /api/health`, DB-backed).

## Required production env vars (set on the Coolify application)

| Var | Required | Notes |
|-----|----------|-------|
| `DATABASE_URL` | **yes** | Postgres connection string (`postgresql://user:pass@host:5432/db`). |
| `JWT_SECRET` | **yes** | Secret for signing access tokens. Use a long random value. |
| `VAPID_PUBLIC_KEY` | **yes** | Web Push VAPID public key (SPKI DER base64url — exactly what the generate script below emits; the server converts it to the raw EC point clients need). |
| `VAPID_PRIVATE_KEY` | **yes** | Web Push VAPID private key. |
| `NODE_ENV` | recommended | Set to `production` — enables auth rate limiting, error-message masking, and the fail-safe CORS default. |
| `DATABASE_POOL_MAX` | recommended | Caps the Prisma/pg connection pool per replica so Coolify's Postgres connection limit isn't exhausted (e.g. `10`). Defaults to pg's default when unset. |
| `CORS_ORIGIN` | optional | Only needed if the frontend is served from a **different** origin than the API. For the default single-image (same-origin) deploy, leave unset — in production an unset value locks CORS down (fail-safe). |
| `PORT` | optional | Defaults to `3001`. |
| `LOG_LEVEL` | optional | Defaults to `info` in production. |

The Web Push VAPID *subject* is hardcoded (`mailto:admin@setforge.app`) and is **not** an env var.

## GitHub Actions secrets (for the redeploy step)

| Secret | Notes |
|--------|-------|
| `COOLIFY_URL` | Base URL of the Coolify instance, e.g. `https://coolify.example.com`. |
| `COOLIFY_RESOURCE_UUID` | The application's UUID in Coolify (Application → General). |
| `COOLIFY_API_TOKEN` | A Coolify API token with deploy permission (Keys & Tokens → API tokens). |

`GITHUB_TOKEN` (auto-provided) is used to push the image to ghcr.io; ensure Coolify can pull from ghcr (public image, or a registry credential in Coolify).

## Generating VAPID keys

```bash
cd backend && node --experimental-strip-types src/scripts/generate-vapid-keys.mts
# prints VAPID_PUBLIC_KEY=... and VAPID_PRIVATE_KEY=... — copy both into Coolify
```

## Notes

- **Migrations** run automatically on every deploy via the entrypoint — no manual step.
- **Health check**: `GET /api/health` returns 200 only when the DB is reachable; Coolify uses it to gate redeploys.
- **Postgres**: provision it as a Coolify resource (or external) and point `DATABASE_URL` at it. The repo's `docker-compose.yml` is for **local dev only**.
