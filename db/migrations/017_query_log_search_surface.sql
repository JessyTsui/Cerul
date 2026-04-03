BEGIN;

ALTER TABLE query_logs
    ADD COLUMN IF NOT EXISTS search_surface TEXT;

ALTER TABLE query_logs
    DROP CONSTRAINT IF EXISTS query_logs_search_surface_check;

ALTER TABLE query_logs
    ADD CONSTRAINT query_logs_search_surface_check
    CHECK (
        search_surface IS NULL
        OR search_surface IN ('api', 'playground')
    );

CREATE INDEX IF NOT EXISTS idx_query_logs_search_surface_created_at
    ON query_logs (search_surface, created_at DESC);

COMMIT;
