# Backend Repository Split Plan

## Goal

Extract backend code from the monorepo (`cerul-ai/cerul`) into two separate private repositories, so the core business logic, database schema, and indexing pipelines are not exposed if the frontend is open-sourced.

## Current Architecture

```
cerul/
├── api/              # Cloudflare Workers API (Hono + TypeScript)
├── frontend/         # Next.js app (React + TypeScript)
├── db/migrations/    # PostgreSQL schema migrations
├── workers/          # Python background jobs (indexing, processing)
├── scripts/          # Mixed: dev, migration, Python experiments
├── config/           # YAML config (algorithm/business params)
├── eval/             # Search quality evaluation results
├── .env              # Shared environment variables
├── CLAUDE.md         # Project conventions
├── rebuild.sh        # Full rebuild orchestrator
└── .github/          # CI/CD workflows
```

## Target: Three Repositories

| Repo | Content | Tech | Deploy Target |
|------|---------|------|---------------|
| **`cerul`** | Frontend | Next.js + TypeScript | Vercel |
| **`cerul-api`** | API + DB migrations | Hono + TypeScript | Cloudflare Workers |
| **`cerul-worker`** | Indexing workers + eval | Python + Docker | VPS |

All three share the same Neon PostgreSQL database. No shared code or images between repos.

## Pre-migration Cleanup

Before splitting, fix these issues in the current monorepo:

- [ ] Remove debug `console.log` in `frontend/components/dashboard/dashboard-usage-context.tsx:43` — logs wallet balance every 30 seconds on refresh, likely a debug leftover

## What Goes Where

### `cerul-api` (new, private)

| Source (in cerul/) | Destination | Notes |
|--------------------|-------------|-------|
| `api/src/` | `src/` | All API source code |
| `api/wrangler.toml` | `wrangler.toml` | CF Workers config |
| `api/package.json` | `package.json` | Dependencies |
| `api/tsconfig.json` | `tsconfig.json` | TypeScript config |
| `db/migrations/` | `db/migrations/` | All migration files |
| `scripts/migrate-db.sh` | `scripts/migrate-db.sh` | Migration runner |
| `scripts/seed-sources.sql` | `scripts/seed-sources.sql` | DB seed data |
| `scripts/source-stats.sql` | `scripts/source-stats.sql` | DB stats query |
| `openapi.yaml` | `openapi.yaml` | API spec (source of truth; publish a copy to cerul or docs site) |

**`rebuild.sh`** — every repo must have one, convention is run this single script to set up and test locally:
```bash
#!/usr/bin/env bash
set -euo pipefail

# 1. Install dependencies
npm ci

# 2. Sync .env → .dev.vars (wrangler needs this)
#    Extract relevant vars from .env into .dev.vars format
node -e "
  const fs = require('fs');
  const lines = fs.readFileSync('.env','utf8').split('\n');
  const out = lines.filter(l => l && !l.startsWith('#')).join('\n');
  fs.writeFileSync('.dev.vars', out);
"

# 3. Run database migrations
./scripts/migrate-db.sh

# 4. Seed data
psql "$DATABASE_URL" -f scripts/seed-sources.sql

# 5. Type check
npx tsc --noEmit

# 6. Start dev server
npm run dev
```

**`.env.example`:**
```
# Runtime
CERUL_ENV=development
API_BASE_URL=http://localhost:8787
WEB_BASE_URL=http://localhost:3000
DEMO_MODE=true

# Core
DATABASE_URL=
BETTER_AUTH_SECRET=
ADMIN_CONSOLE_EMAILS=
BOOTSTRAP_ADMIN_SECRET=

# Embedding (API needs these for search)
GEMINI_API_KEY=
EMBEDDING_BACKEND=gemini
EMBEDDING_MODEL=gemini-embedding-2-preview
EMBEDDING_DIMENSION=3072
EMBEDDING_NORMALIZE=true

# Reranking
JINA_API_KEY=
RERANK_MODEL=jina-reranker-v3

# Cloudflare R2
R2_ACCOUNT_ID=
R2_ACCESS_KEY_ID=
R2_SECRET_ACCESS_KEY=
R2_BUCKET_NAME=cerul-cdn
R2_PUBLIC_URL=https://cdn.cerul.ai

# Stripe billing
STRIPE_SECRET_KEY=
STRIPE_WEBHOOK_SECRET=
STRIPE_PRO_PRICE_ID=
```

**`CLAUDE.md` keeps:** Configuration Architecture (env + yaml two-layer rule), Database section (migrations, Neon behavior, backfill rules), API key format, tracking links, search surface attribution.

### `cerul-worker` (new, private)

| Source (in cerul/) | Destination | Notes |
|--------------------|-------------|-------|
| `workers/` | `workers/` | All Python worker code |
| `config/base.yaml` | `config/base.yaml` | Algorithm/business params (only workers read this) |
| `eval/` | `eval/` | Search quality evaluation data |
| `Dockerfile` | `Dockerfile` | Worker Docker image |
| `docker-compose.yml` | `docker-compose.yml` | Worker orchestration |
| `docker-compose.worker.yml` | `docker-compose.worker.yml` | Worker-specific compose |
| `.env.worker.example` | `.env.example` | Worker env template |
| `.dockerignore` | `.dockerignore` | Rewrite for new directory structure |
| `scripts/eval_*.py` | `scripts/` | Evaluation scripts |
| `scripts/reindex_*.py` | `scripts/` | Re-indexing scripts |
| `scripts/sweep_*.py` | `scripts/` | Parameter sweep scripts |
| `scripts/experiment_*.py` | `scripts/` | Experiment scripts |
| `scripts/plot_*.py` | `scripts/` | Plotting scripts |
| `scripts/seed_latest_videos.py` | `scripts/` | Content seeding |
| `scripts/backfill_source_metadata.py` | `scripts/` | Backfill script |
| `scripts/run_*.py` | `scripts/` | Experiment runners |
| `scripts/test_bulk_download.sh` | `scripts/` | Download test |
| `scripts/video_ids.txt` | `scripts/` | Test video list |

**Configuration architecture preserved:** `.env` for secrets/credentials, `config/base.yaml` for algorithm tuning (thresholds, top-N, quality settings).

**`rebuild.sh`:**
```bash
#!/usr/bin/env bash
set -euo pipefail

# 1. Create/update Python venv
python3 -m venv venv
source venv/bin/activate
pip install -r workers/requirements.txt

# 2. Build Docker image
docker compose -f docker-compose.worker.yml build

# 3. Run worker locally
docker compose -f docker-compose.worker.yml up
```

**`CLAUDE.md` keeps:** Configuration Architecture (two-layer pattern), Database connection behavior, backfill rules.

### `cerul` (stays, public-safe server-side Next.js app)

| Item | Notes |
|------|-------|
| `frontend/` | Next.js app, components, auth logic |
| `scripts/dev.sh` | Adjusted — frontend only |
| `scripts/ensure-local-infra.sh` | Local environment setup |
| `rebuild.sh` | Adjusted — frontend only |
| `docs/` (public only) | Public-facing docs; internal API docs move to cerul-api |
| `skills/` | Public Cerul CLI skill |
| `.vercel/` | Vercel deployment config |
| `.github/workflows/` | Frontend CI only |

**Files to remove from cerul after split:**
- `api/`, `db/`, `workers/`, `config/`, `eval/`
- `Dockerfile`, `docker-compose.yml`, `docker-compose.worker.yml`, `.dockerignore`
- `.env.worker.example`
- `scripts/push-secrets.sh` (each repo manages its own secrets)
- All Python scripts in `scripts/`
- `scripts/migrate-db.sh`, `scripts/seed-sources.sql`, `scripts/source-stats.sql`

**Note:** This is NOT a pure frontend repo. It is a server-side Next.js app that still requires `DATABASE_URL` for Better Auth session management, user registration hooks, bootstrap admin, and password reset. It can be open-sourced because it contains no business logic (search, billing algorithms, indexing pipelines), but it does directly connect to the shared PostgreSQL database.

**`rebuild.sh`:**
```bash
#!/usr/bin/env bash
set -euo pipefail

# 1. Install dependencies
pnpm --dir frontend install

# 2. Build
pnpm --dir frontend build

# 3. Start dev server
pnpm --dir frontend dev
```

**`.env.example`:**
```
# Runtime
CERUL_ENV=development
API_BASE_URL=http://localhost:8787
WEB_BASE_URL=http://localhost:3000
NEXT_PUBLIC_API_BASE_URL=http://localhost:8787
NEXT_PUBLIC_SITE_URL=http://localhost:3000
DEMO_MODE=true

# Core (shared with backend)
DATABASE_URL=
BETTER_AUTH_SECRET=

# OAuth providers
GOOGLE_CLIENT_ID=
GOOGLE_CLIENT_SECRET=
GITHUB_CLIENT_ID=
GITHUB_CLIENT_SECRET=

# Email
RESEND_API_KEY=
EMAIL_FROM=Cerul <noreply@cerul.ai>
```

**`CLAUDE.md` keeps:** Console proxy, dev startup (frontend only), z-index note, Better Auth pool timeout note.

## Coupling Points and Solutions

### 1. Shared Database (keep as-is)

All three repos connect to the same Neon PostgreSQL. The database is the integration layer. `DATABASE_URL` appears in all three `.env` files.

### 2. Auth Secret Must Be Identical

Both frontend and API use `BETTER_AUTH_SECRET` — frontend for session management (Better Auth), API for HMAC signature verification (console proxy). If they're out of sync, authenticated dashboard/admin requests will fail.

### 3. Auth Proxy (no code change needed)

Frontend proxies dashboard/admin requests through `/api/console/[...path]` → signs with HMAC (`BETTER_AUTH_SECRET`) → forwards to API at `API_BASE_URL`. Works across repos as long as both secrets match and the URL is correct.

### 4. Registration Hook Writes to API Tables

`frontend/lib/auth-db.ts` directly writes to `api_keys`, `credit_grants`, `credit_transactions` during signup.

**Recommendation:** Start with no change (Option A). Later, add `POST /internal/user-setup` in API and call it from frontend instead of direct DB writes.

### 5. DB Migrations Ownership

Migrations live in `cerul-api`. Workers and frontend don't run migrations — they only consume the schema. If a worker needs a schema change, the migration is authored in `cerul-api` and deployed before the worker update.

### 6. `.env` → `.dev.vars` Sync

Currently `scripts/dev.sh` syncs 22+ variables from root `.env` to `api/.dev.vars` for wrangler. After split, `cerul-api` handles this itself in its own `rebuild.sh` — read from its own `.env` and write `.dev.vars`.

### 7. CI/CD Workflow Split

Current monorepo workflows must be split:

| Current workflow | What it does | Target repo |
|-----------------|--------------|-------------|
| `ci.yml` → `frontend-*` jobs | Lint, build, test frontend | `cerul` |
| `ci.yml` → `api-typecheck` job | TypeScript check | `cerul-api` |
| `ci.yml` → `workers-test` job | Pytest | `cerul-worker` |
| `ci.yml` → `docker-build-test` job | Docker build | `cerul-worker` |
| `release.yml` → wrangler deploy | Deploy API to CF Workers | `cerul-api` |
| `release.yml` → Docker build/push | Build and push worker image | `cerul-worker` |
| `deploy-staging.yml` | Staging API deploy | `cerul-api` |
| `migration-check.yml` | Validate migrations | `cerul-api` |

### 8. Config Semantic Coupling

Some tuning parameters exist in both `config/base.yaml` (workers) and `api/wrangler.toml` (API):
- `EMBEDDING_BACKEND`, `EMBEDDING_MODEL`, `RERANK_MODEL` etc.

These are set via `.env` in both repos. Values must match for search quality consistency. Document this in both repos' `CLAUDE.md`.

### 9. Documentation Split

| Content | Target repo |
|---------|-------------|
| Internal API architecture docs | `cerul-api` |
| Public user-facing docs | `cerul` |
| Search quality evaluation docs | `cerul-worker` |
| `docs/api-split-plan.md` (this file) | Delete after migration complete |

### 10. Shared Contracts: Source of Truth

After the split, several configuration values must stay in sync across repos. Define a clear owner for each:

| Parameter | Owner | Consumers | Sync Strategy |
|-----------|-------|-----------|---------------|
| DB schema (migrations) | `cerul-api` | all three | API deploys migration first, then worker/frontend update |
| `BETTER_AUTH_SECRET` | Shared | `cerul`, `cerul-api` | Same value in both `.env`; rotate together |
| `DATABASE_URL` | Shared | all three | Same Neon instance; each repo has its own `.env` |
| Embedding config (`EMBEDDING_MODEL`, `EMBEDDING_DIMENSION`) | `.env` per repo | `cerul-api`, `cerul-worker` | Must match; document in both `CLAUDE.md` |
| Rerank config (`RERANK_MODEL`) | `.env` per repo | `cerul-api`, `cerul-worker` | Must match |
| Search tuning (`mmr_lambda`, `rerank_top_n`, etc.) | `cerul-worker` (`config/base.yaml`) | `cerul-worker` only | API has hardcoded defaults in `config.ts`; if API needs these values, read from DB or env, not yaml |
| `openapi.yaml` (API contract) | `cerul-api` (source) | `cerul` (public copy) | On API release, publish updated spec to cerul repo or docs site |

**Rule:** If a value changes in the owner repo and consumers don't update, things should fail loudly (e.g., embedding dimension mismatch → search errors), not silently produce wrong results.

### 11. `scripts/push-secrets.sh` Becomes Obsolete

Currently pushes secrets to both Vercel and Cloudflare from one script. After split, each repo manages its own secrets deployment. Delete from `cerul`, don't migrate.

## Migration Steps

### Phase 1: Pre-migration cleanup
1. Remove debug `console.log` in `dashboard-usage-context.tsx:43`
2. Review `docs/` for internal vs public content

### Phase 2: Create `cerul-api`
1. Create private repo `cerul-ai/cerul-api`
2. Copy `api/` contents (flatten: `api/src/` → `src/`), `db/migrations/`, migration scripts, `openapi.yaml`
3. Write `rebuild.sh`, `.env.example`, `CLAUDE.md`
4. Create `.env` → `.dev.vars` sync in `rebuild.sh`
5. Verify `./rebuild.sh` works end to end (install, migrate, type check, dev server)
6. Verify `wrangler deploy` works standalone
7. Set up CI workflows (typecheck, migration check, deploy)

### Phase 3: Create `cerul-worker`
1. Create private repo `cerul-ai/cerul-worker`
2. Copy `workers/`, `config/`, `eval/`, Dockerfile, docker-compose files, `.dockerignore` (rewritten), Python scripts
3. Write `rebuild.sh`, `.env.example`, `CLAUDE.md`
4. Verify `./rebuild.sh` works (venv, docker build, worker startup)
5. Set up CI workflows (pytest, Docker build/push)

### Phase 4: Clean up `cerul`
1. Remove all backend files (see "Files to remove" list above)
2. Rewrite `rebuild.sh` (frontend only: pnpm install → build → dev)
3. Rewrite `scripts/dev.sh` (frontend only, no API startup, no `.dev.vars` sync)
4. Trim `.env.example` to frontend-only vars
5. Trim `CLAUDE.md` to frontend-relevant sections
6. Split CI workflows — keep only frontend jobs
7. Delete `scripts/push-secrets.sh`
8. Add README note about backend repos

### Phase 5: Refactor registration hook (optional, later)
1. Add `POST /internal/user-setup` endpoint in `cerul-api`
2. Migrate `auth-db.ts` signup logic to call API instead of direct DB writes

## Risk Checklist

- [ ] Verify `./rebuild.sh` works in `cerul-api` (install, migrate, type check, dev server)
- [ ] Verify `wrangler deploy` from `cerul-api`
- [ ] Verify `./rebuild.sh` works in `cerul-worker` (venv, docker build, worker startup)
- [ ] Verify `config/base.yaml` loads correctly in `cerul-worker`
- [ ] Verify `./rebuild.sh` works in `cerul` (pnpm install, build, dev)
- [ ] Verify frontend console proxy works with API at `API_BASE_URL`
- [ ] Verify `BETTER_AUTH_SECRET` matches across `cerul` and `cerul-api`
- [ ] Verify local dev workflow (three terminals: frontend + API + worker)
- [ ] Verify CI passes in all three repos independently
- [ ] Ensure production env vars are set in all deployment environments
- [ ] Verify `.env` → `.dev.vars` sync works in `cerul-api`
- [ ] Verify Docker image builds correctly from `cerul-worker` (new directory structure)
