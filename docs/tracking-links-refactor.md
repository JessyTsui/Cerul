# Tracking Links Refactor

## Problem

The previous tracking design created a new random short link for every search result and wrote it into `tracking_links` during request handling.

That caused four problems:

1. Search traffic created write amplification on the redirect path.
2. Redirects depended on stored `target_url` snapshots that could go stale.
3. `tracking_links` growth followed search volume instead of content volume.
4. Dashboard query history depended on `tracking_links`, so removing per-search writes would break historical result previews.

## Implemented Design

We split tracking into two separate responsibilities:

1. Stable redirect identity lives on `retrieval_units.short_id`
2. Request-level result snapshots live on `query_logs.results_preview`

This keeps redirects stable without losing the exact results returned for a specific request.

## Stable Short IDs

Each retrieval unit now has a deterministic `short_id`.

The identifier is derived from the retrieval unit's stable natural key:

```text
sha256("${video_id}:${unit_type}:${unit_index}")[:12]
```

Why this key:

- it is stable across normal upserts
- the worker can compute it before insert
- it avoids depending on a generated UUID that only exists after the row is written

The value is stored in `retrieval_units.short_id` and backfilled in migration `016_tracking_query_snapshots.sql`.

## Search Response Behavior

Search no longer creates per-request rows in `tracking_links`.

Instead, each result returns a stable tracking URL:

```text
/v/{short_id}?req={request_id}&rank={result_rank}
```

The `req` and `rank` query parameters carry request-specific attribution, while the `short_id` identifies the retrieval unit itself.

## Query History Snapshots

Dashboard history no longer reads result previews from `tracking_links`.

Each search request now stores a lightweight result snapshot in `query_logs.results_preview`, including:

- rank
- result id
- tracking url
- title
- source
- thumbnail
- score

This preserves request-level history even though redirects are now content-based instead of request-row-based.

## Redirect Route Behavior

Tracking routes now work in this order:

1. Look up a permanent short link from `retrieval_units.short_id`
2. Fall back to legacy `tracking_links.short_id` for older links

Redirect targets are built from current `videos` and `retrieval_units` data whenever the permanent path is used, so source URL changes do not stale new links.

The `/v/:shortId`, `/v/:shortId/detail`, and `/v/:shortId/go` routes all read `req` and `rank` from query parameters. The detail page preserves those values when linking onward to `/go`.

## Tracking Events

`tracking_events` no longer keeps a foreign key to `tracking_links.short_id`.

The event row stores:

- `short_id`
- `request_id`
- `result_rank`
- `unit_id`
- `video_id`

That keeps redirect logging best-effort and compatible with both permanent and legacy links.

## Worker Changes

The unified worker now computes and writes `short_id` during retrieval unit upsert. In-memory and database-backed repository implementations both follow the same rule.

## Migration Summary

`016_tracking_query_snapshots.sql` does the following:

1. adds `query_logs.results_preview`
2. adds `retrieval_units.short_id`
3. backfills `short_id`
4. creates a unique index on `retrieval_units.short_id`
5. drops the `tracking_events -> tracking_links.short_id` foreign key

## Result

After this refactor:

- search requests no longer write redirect rows
- dashboard history still has request-specific result previews
- new short links stay tied to content instead of individual searches
- old short links continue to resolve through legacy fallback
