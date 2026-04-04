BEGIN;

CREATE EXTENSION IF NOT EXISTS pgcrypto;

ALTER TABLE query_logs
    ADD COLUMN IF NOT EXISTS results_preview JSONB NOT NULL DEFAULT '[]'::JSONB;

ALTER TABLE retrieval_units
    ADD COLUMN IF NOT EXISTS short_id TEXT;

-- Existing rows intentionally stay NULL here.
-- Retrieval paths already fall back to the deterministic short_id expression at read time,
-- and any production backfill should be done operationally in small batches rather than
-- as a single migration transaction on Neon.

CREATE UNIQUE INDEX IF NOT EXISTS idx_retrieval_units_short_id
    ON retrieval_units (short_id)
    WHERE short_id IS NOT NULL;

ALTER TABLE tracking_events
    DROP CONSTRAINT IF EXISTS tracking_events_short_id_fkey;

COMMIT;
