# Admin Analytics Implementation Plan

## Purpose

This document is the execution checklist for the admin analytics workstream.

It replaces the earlier brainstorming draft with a task board that can be used
as the single source of truth for implementation, review, and progress tracking.

## Working Rules

- Always pick the first unchecked task (`[ ]`) unless there is an explicit reason
  to reorder work.
- Before starting a task, change its status to in progress (`[-]`).
- After implementation and verification are complete, change the task status to
  done (`[x]`) and record the verification notes in the task section.
- Do not add new analytics surfaces until their metric definitions are written
  down in this document.
- Treat this document as public-repo-safe. Keep product strategy, internal
  thresholds, and non-public ranking logic out of scope.

## Primary Goals

1. Measure what users actually clicked within returned search results, not just
   raw click volume.
2. Show which videos and creators receive the most outbound demand from Cerul.
3. Surface search quality issues such as empty searches, high-impression
   low-click results, and rank-position effects.
4. Make analytics available inside the existing admin experience with consistent
   loading, auth, and range filtering patterns.

## Non-Goals

- Do not introduce a new `creators` table in the first phase.
- Do not rely on `tracking_links` as the long-term analytics source.
- Do not mix playground-only feedback with whole-product preference metrics.
- Do not ship analytics definitions that lack an exposure denominator.

## Canonical Metric Definitions

### Search Surface

The product must distinguish where a search came from.

- `api`: the public API search route
- `playground`: the dashboard playground flow

Future surfaces may be added later, but phase 1 only needs these two.

### Impression

An impression is one returned result item inside `query_logs.results_preview`.

Canonical shape:

- one search request can emit zero to `N` impressions
- one impression is identified by `request_id + rank + short_id`
- one impression belongs to exactly one retrieval result and one source search

### Outbound Intent Click

An outbound click is the first successful outbound action for a result within a
single search request.

Canonical dedupe rule:

- use the earliest `tracking_events` row whose `event_type` is `redirect` or
  `outbound_click`
- dedupe by `request_id + short_id`
- use `request_id + unit_id + video_id + result_rank` only as a legacy fallback
  if `short_id` is missing

This keeps repeated clicks from the same request from inflating CTR.

### Detail Page View

A detail page view is a `tracking_events.event_type = 'page_view'` row attached
to a result impression.

This metric is used to compute detail-page assist rate:

- `detail assist rate = unique result page_views / unique result impressions`
- `detail to outbound rate = unique result outbound clicks / unique result page_views`

### CTR

CTR must always have both numerator and denominator:

- `result CTR = unique outbound clicks / impressions`
- `video CTR = unique outbound clicks to the video's returned results / video impressions`
- `creator CTR = unique outbound clicks to a creator's returned results / creator impressions`
- `position CTR = unique outbound clicks on rank N / impressions shown at rank N`

All leaderboard CTR views must enforce a minimum exposure threshold before
ranking, for example `impressions >= 30`.

### Rank-Adjusted CTR

Raw CTR is biased by ranking position. Rank-adjusted CTR compares a result
against the baseline CTR of its average rank position.

Phase 1 definition:

- compute baseline CTR per rank position
- compute result CTR per video or per retrieval unit
- report `ctr_delta = result_ctr - baseline_ctr_for_avg_rank`

### Cross-Query Breadth

Cross-query breadth measures how widely a result or video attracts demand across
different user intents.

Phase 1 definition:

- `distinct_queries_clicked = count(distinct normalized query_text)` among
  unique outbound click requests

### Feedback

`playground_feedback` is explicitly a playground-only signal. It is useful for
evaluation and internal quality review, but it must not be labeled as global
user preference.

## Data Sources

| Source | Role in analytics | Notes |
| --- | --- | --- |
| `query_logs` | search requests and result impressions | `results_preview` is the source of truth for impressions |
| `tracking_events` | page views and outbound actions | use deduped result-level events |
| `retrieval_units` | stable result identity | `short_id` is the stable result key |
| `videos` | video-level aggregation | use `creator`, `source`, and metadata |
| `playground_feedback` | explicit playground-only feedback | keep separate from click analytics |
| `usage_events` | usage and credits trends | secondary business context only |

## Creator Attribution Strategy

Phase 1 will not create a separate `creators` table.

Instead, creator attribution will use:

- `videos.creator`
- `videos.source`
- `videos.metadata->>'channel_id'` when available

This is enough to answer:

- which creators received the most impressions
- which creators received the most outbound clicks
- which creators have the highest CTR above a minimum impression threshold

## Task Board

- [x] Task 0: Establish the analytics foundation required for impression-aware tracking
- [x] Task 1: Add explicit search surface attribution to search logs
- [x] Task 2: Implement reusable analytics primitives for impressions and deduped clicks
- [x] Task 3: Add admin analytics backend endpoints
- [x] Task 4: Add admin analytics client types, loaders, and route entry points
- [x] Task 5: Build the admin analytics overview surface
- [x] Task 6: Build content and creator performance views
- [x] Task 7: Build search quality and feedback views
- [x] Task 8: Complete QA, documentation polish, and rollout notes

---

## Task 0: Establish the analytics foundation required for impression-aware tracking

Status: `[x] Done`

### Background

CTR analytics are impossible without stable result identity and request-level
result snapshots. The previous design depended on per-search `tracking_links`,
which could not support stable long-term analytics.

### Purpose

Provide the storage and routing foundation required for impression-aware admin
analytics.

### Deliverables

- stable `retrieval_units.short_id`
- `query_logs.results_preview` snapshots
- stable `/v/:short_id` routing with `req` and `rank`
- legacy fallback for old `tracking_links`
- history views reading from `results_preview`

### Verification

- `pnpm --dir frontend test`
- `npm --prefix api run check`

### Done Criteria

- search results carry stable result URLs
- history can render without depending on transient `tracking_links`
- tracking routes preserve request context through detail and outbound steps

---

## Task 1: Add explicit search surface attribution to search logs

Status: `[x] Done`

### Background

Current analytics cannot split API searches from playground searches because both
flows write the same generic search type value.

### Purpose

Add a first-class field that identifies the origin surface of each search so the
admin dashboard can filter and compare behavior by surface.

### Deliverables

- database migration adding a `search_surface` field to `query_logs`
- route writes for:
  - public API search -> `api`
  - dashboard playground search -> `playground`
- updated TypeScript types and any shared payload contracts
- backward-compatible read behavior for older rows with null surface values

### Testing Plan

- migration applies cleanly on a local database
- route-level tests verify the correct surface is written for each flow
- analytics service tests verify null legacy rows do not break aggregation
- `npm --prefix api run check`

### Verification

- Added `db/migrations/017_query_log_search_surface.sql`
- Updated both query log write paths:
  - public API search writes `search_surface = 'api'`
  - dashboard playground search writes `search_surface = 'playground'`
- Extended dashboard query-log responses to expose `search_surface`
- Verified frontend client parsing for both explicit and legacy-null surfaces
- `pnpm --dir frontend test -- frontend/lib/api.test.ts`
- `npm --prefix api run check`

### Done Criteria

- every new search row records its surface
- analytics queries can filter by surface without ad hoc request-path logic

---

## Task 2: Implement reusable analytics primitives for impressions and deduped clicks

Status: `[x] Done`

### Background

Raw SQL for each chart will drift unless impressions, clicks, and page views are
defined once and reused everywhere.

### Purpose

Create the shared analytics query layer that every admin endpoint will build on.

### Deliverables

- a dedicated analytics service module in `api/src/services/`
- reusable query builders or SQL helpers for:
  - impressions from `query_logs.results_preview`
  - unique outbound clicks from `tracking_events`
  - unique detail page views
  - rank-position baselines
  - query normalization used by cross-query breadth
- explicit range filtering utilities
- minimum impression threshold support for CTR leaderboards

### Testing Plan

- add focused service tests with fixture data covering:
  - repeated clicks within one request
  - legacy events without `short_id`
  - searches with zero results
  - searches with impressions but zero clicks
  - page view followed by outbound click
- verify rank-position CTR uses impression counts as denominator
- `npm --prefix api run check`

### Verification

- Added `api/src/services/admin-analytics.ts`
- Implemented shared analytics dataset CTEs for:
  - `query_scope`
  - `impressions`
  - `unique_outbound_clicks`
  - `unique_page_views`
- Added reusable exported primitives for:
  - core analytics summary
  - rank-position baselines
  - normalized query performance
- Verified the new service with `npm --prefix api run check`
- Verified a compiled smoke run against a fake database after emitting the API bundle to `/tmp/cerul-api-analytics-smoke`

### Done Criteria

- all core analytics metrics can be derived from shared primitives
- CTR and position CTR definitions are mathematically correct
- dedupe behavior is consistent across endpoints

---

## Task 3: Add admin analytics backend endpoints

Status: `[x] Done`

### Background

The existing admin router already exposes summary-style endpoints. Analytics
should follow the same auth and query patterns instead of creating a parallel
backend shape.

### Purpose

Expose stable admin API endpoints for the analytics dashboard.

### Deliverables

- new authenticated admin routes for:
  - overview summary
  - content performance
  - creator attribution
  - search quality
  - playground feedback
- shared range and filter parsing
- documented response shapes in code comments or nearby types

### Testing Plan

- route tests for happy path and invalid range/filter input
- authorization checks to confirm admin auth is enforced
- snapshot or shape assertions for response payloads
- `npm --prefix api run check`

### Verification

- Added admin analytics routes under `/admin/analytics/*`
- Added backend route handlers for:
  - overview
  - content
  - creators
  - search quality
  - feedback
- Wired these routes to shared analytics primitives in `api/src/services/admin-analytics.ts`
- Added independent admin analytics route tests in `api/src/routes/admin.test.ts`
- Added an `api` test script powered by Vitest
- `npm --prefix api test`
- `npm --prefix api run check`

### Done Criteria

- frontend can load analytics data without bespoke route wiring
- each response has a clear, typed structure

---

## Task 4: Add admin analytics client types, loaders, and route entry points

Status: `[x] Done`

### Background

The frontend admin area already has patterns for route-specific loaders, range
pickers, and consistent loading and error states.

### Purpose

Create the frontend plumbing required to render analytics screens inside the
existing admin shell.

### Deliverables

- admin API client methods in `frontend/lib/admin-api.ts`
- shared TypeScript types for analytics payloads
- admin navigation entry for analytics
- route entry point for `/admin/analytics`
- reusable loader hooks where needed

### Testing Plan

- client tests covering request URLs and query params
- route/component smoke tests for loading, error, and success states
- `pnpm --dir frontend test`

### Verification

- Added `frontend/lib/admin-analytics.ts`
- Added typed client helpers and payload normalizers for all analytics surfaces
- Added `/admin/analytics` route entry point
- Added admin navigation entry for Analytics
- Added frontend client tests in `frontend/lib/admin-analytics.test.ts`
- `pnpm --dir frontend test`

### Done Criteria

- analytics routes are reachable from the admin navigation
- frontend data loading matches the backend contract

---

## Task 5: Build the admin analytics overview surface

Status: `[x] Done`

### Background

Operators need a fast answer to whether Cerul is generating useful outbound
traffic, not just whether usage volume is going up.

### Purpose

Ship the top-level analytics screen with the highest-signal summary metrics.

### Deliverables

- overview cards for:
  - searches
  - impressions
  - unique outbound clicks
  - overall CTR
  - detail assist rate
  - answer vs no-answer CTR
- one or more trend charts for:
  - searches over time
  - outbound clicks over time
  - CTR over time
- surface filter support when Task 1 is complete

### Testing Plan

- component tests for empty, loading, and error states
- visual verification in desktop and mobile layouts
- manual sanity check that overview totals align with backend response values
- `pnpm --dir frontend test`

### Verification

- Built the overview section inside `frontend/components/admin/analytics-screen.tsx`
- Added:
  - overview metric cards
  - trend chart
  - answer vs no-answer CTR split
  - surface attribution breakdown
- Verified the page compiles in production build
- `pnpm --dir frontend test`
- `pnpm --dir frontend build`

### Done Criteria

- an admin can understand demand and outbound performance from one screen
- all displayed metrics use the canonical definitions above

---

## Task 6: Build content and creator performance views

Status: `[x] Done`

### Background

The user wants to know which videos, creators, and returned clips receive the
most useful demand from searches.

### Purpose

Show both volume-based and rate-based performance for videos, retrieval units,
and creators.

### Deliverables

- content tables for:
  - top videos by outbound clicks
  - top videos by CTR with minimum impression threshold
  - top retrieval units by CTR
  - high-impression low-click videos
- creator tables for:
  - creators by impressions
  - creators by outbound clicks
  - creators by CTR with minimum impression threshold
  - creator outbound share vs impression share
- columns should include at least:
  - impressions
  - unique outbound clicks
  - CTR
  - average rank
  - distinct clicked queries
  - source
  - creator or channel identifier when available
- rank-adjusted CTR for at least one content leaderboard

### Testing Plan

- service tests validating video and creator aggregation logic
- frontend tests for table rendering and filter changes
- manual spot checks against raw SQL for one creator and one video
- `pnpm --dir frontend test`
- `npm --prefix api run check`

### Verification

- Added content views for:
  - top videos by outbound clicks
  - top videos by CTR
  - top results by CTR
  - high-impression low-click videos
  - cross-query winners
- Added creator views for:
  - top creators by clicks
  - top creators by CTR
  - creator share delta leaders
- Included creator attribution via `videos.creator`, `videos.source`, and `videos.metadata->>'channel_id'`
- `pnpm --dir frontend test`
- `npm --prefix api run check`

### Done Criteria

- admins can see who receives the most traffic
- admins can distinguish between high-volume exposure and genuinely strong CTR

---

## Task 7: Build search quality and feedback views

Status: `[x] Done`

### Background

Search performance needs more than click totals. We need to see where retrieval
quality, ranking, or snippet quality is failing.

### Purpose

Expose the analytics views that help diagnose search quality and interpret
playground feedback correctly.

### Deliverables

- search quality views for:
  - top queries by demand
  - zero-result queries
  - high-impression low-click queries
  - position CTR by rank
  - queries with the strongest outbound engagement
- feedback views for:
  - playground-only like/dislike totals
  - most liked videos or results in playground
  - most disliked results in playground
- explicit UI labeling that feedback is playground-only

### Testing Plan

- service tests for query aggregation and position CTR
- component tests confirming playground-only labeling is visible
- manual verification that zero-result queries do not leak into CTR tables
- `pnpm --dir frontend test`
- `npm --prefix api run check`

### Verification

- Added search quality views for:
  - top queries by demand
  - zero-result queries
  - high-impression low-click queries
  - strongest outbound queries
  - rank baseline CTR by position
- Added feedback views for:
  - summary counts
  - most liked videos
  - most liked results
  - most disliked results
- Added explicit playground-only labeling in the UI and payload handling
- `pnpm --dir frontend test`
- `npm --prefix api run check`

### Done Criteria

- admins can identify search gaps and ranking weaknesses
- feedback is clearly separated from live click analytics

---

## Task 8: Complete QA, documentation polish, and rollout notes

Status: `[x] Done`

### Background

Analytics code can be numerically correct but still hard to trust unless we
document assumptions and verify edge cases.

### Purpose

Finish the workstream with confidence, explicit caveats, and rollout guidance.

### Deliverables

- final pass on endpoint and UI naming consistency
- rollout notes covering:
  - legacy rows without `search_surface`
  - CTR threshold behavior
  - known limits of playground-only feedback
- updated docs in this file reflecting final status
- any follow-up issues captured for phase 2 ideas

### Testing Plan

- run the full frontend test suite
- run API typecheck and any added route/service tests
- manual regression test of admin navigation and tracking-dependent analytics

### Verification

- `npm --prefix api test`
- `pnpm --dir frontend test`
- `pnpm --dir frontend build`
- `npm --prefix api run check`
- Confirmed `/admin/analytics` is generated in the production build output

### Rollout Notes

- Run `db/migrations/017_query_log_search_surface.sql` before deploying the updated API.
- Older `query_logs` rows may have `search_surface = NULL`; the overview intentionally labels these as legacy rows.
- CTR leaderboards enforce impression floors:
  - videos and creators: `30`
  - result rows: `20`
  - query tables: `20`
- Playground feedback remains an explicit, playground-only signal and should not be interpreted as global user preference.

### Done Criteria

- all tasks above are marked done
- the admin analytics dashboard is usable without hidden metric ambiguity
- known caveats are documented in repo-safe language

## Future Ideas (Out of Current Scope)

- creator entity normalization across platforms
- cohort analysis by user or customer account
- freshness-versus-CTR reporting
- saved admin analytics exports
- anomaly detection or alerting for CTR regressions
