# Cerul — Project Conventions

## Configuration Architecture

Runtime configuration is split into two layers by sensitivity:

### `.env` files — Secrets, credentials, and deployment-specific settings
API keys, database URLs, auth secrets, model names, embedding dimensions, URLs, feature flags.
- `.env.example` — template (committed to git)
- `.env` — local development (gitignored)
- `.env.production` — production deployment (gitignored)

### `config/base.yaml` — Algorithm and business parameters only
Search thresholds, rerank counts, scene detection sensitivity, download quality, feature toggles.
These are values that rarely change between environments.

### Decision rule for new parameters

| Question | Location |
|----------|----------|
| Is this a secret (API key, password, token, connection string)? | `.env` |
| Does this change between environments (URLs, model names, dimensions)? | `.env` |
| Is this a tuning knob that's the same everywhere (thresholds, top-N counts)? | `config/base.yaml` |

When adding a new parameter:
1. Add to **all three** `.env` files if it belongs in `.env`, keeping keys in sync
2. Only add to `config/base.yaml` if it's a pure algorithm/business parameter

## Database (Neon Serverless Postgres)

### Connection behavior
- Neon free tier auto-suspends after inactivity; cold starts take 3-5 seconds.
- Launch tier can disable auto-suspend ("Scale to zero") in Branches → Edit Compute.
- Set `connectionTimeoutMillis: 60_000` in Node.js Pool config to survive cold starts.
- Better Auth's `resetAuthDatabaseState()` calls `pool.end()` on timeout, poisoning all subsequent requests. Restart the Next.js dev server to recover.

### Migrations
- Run with `./scripts/migrate-db.sh`. Use `--from` to target specific migrations.
- **Never do large UPDATE backfills in a single transaction on Neon.** A single-transaction UPDATE over 100k+ rows will hang for hours on serverless compute. Always batch (5,000 rows per commit) using a shell loop with independent transactions.
- Migration files: `db/migrations/NNN_name.sql`. Tracked in `schema_migrations` table.

## Local Development

### Proxy / Network
- The local API runs on Cloudflare Workers dev (`wrangler dev` / `workerd`) which does **not** respect `http_proxy`/`https_proxy` env vars.
- If your network requires a proxy (e.g. in China), enable Clash TUN mode or use `proxychains4` to wrap `wrangler dev`. Otherwise outbound requests to Gemini, Neon, etc. will silently time out.

### Dev startup
- `./rebuild.sh` — install deps, sync `.dev.vars`, run migrations, build.
- `./scripts/dev.sh` — start frontend (Next.js) + API (wrangler dev) together.
- API binds to `API_BASE_URL` from `.env` (default `localhost:8000`). Frontend proxies dashboard/admin API calls through `/api/console/[...path]`.

## Architecture Notes

### API key format
- Prefix: `cerul_` followed by 32 hex chars. Auth middleware pattern: `^cerul_[A-Za-z0-9]{32,}$` (also matches legacy `cerul_sk_` keys).
- Keys are SHA256-hashed before storage. Raw key shown only once at creation.
- A default key named "Default" is auto-created on user signup.
- Users cannot delete their last active key (backend returns 403).

### Tracking links
- Each `retrieval_unit` has a permanent `short_id` (deterministic: `sha256(video_id:unit_type:unit_index)[:12]`), generated at index time.
- Search results return `/v/{short_id}?req={request_id}&rank={rank}` — no per-search DB writes for redirect links.
- Redirect handler looks up `retrieval_units` + `videos` to build the target URL dynamically (never stale).
- Legacy `tracking_links` table still exists for old short links (fallback lookup).
- Click tracking: `tracking_events` records `short_id`, `request_id`, `result_rank` from URL query params.

### Search surface attribution
- `query_logs.search_surface` distinguishes `"api"` vs `"playground"` searches.
- `query_logs.results_preview` (JSONB) stores a lightweight snapshot of returned results per request, used for dashboard history and as the impression denominator for CTR analytics.

### Console proxy
- Frontend dashboard/admin API calls go through Next.js at `/api/console/[...path]`, which authenticates via Better Auth session, signs the request with HMAC, and forwards to the Hono API.
- The dialog/modal z-index must be > 80 (header z-index) to properly overlay the top nav.
