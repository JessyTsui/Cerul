BEGIN;

CREATE EXTENSION IF NOT EXISTS pgcrypto;

ALTER TABLE query_logs
    ADD COLUMN IF NOT EXISTS results_preview JSONB NOT NULL DEFAULT '[]'::JSONB;

ALTER TABLE retrieval_units
    ADD COLUMN IF NOT EXISTS short_id TEXT;

UPDATE retrieval_units
SET short_id = SUBSTRING(
    ENCODE(
        DIGEST(
            CONCAT_WS(':', video_id::text, unit_type, unit_index::text),
            'sha256'
        ),
        'hex'
    )
    FROM 1 FOR 12
)
WHERE short_id IS NULL;

CREATE UNIQUE INDEX IF NOT EXISTS idx_retrieval_units_short_id
    ON retrieval_units (short_id)
    WHERE short_id IS NOT NULL;

ALTER TABLE tracking_events
    DROP CONSTRAINT IF EXISTS tracking_events_short_id_fkey;

COMMIT;
