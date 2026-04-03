-- Revert API key raw storage.
-- API keys remain visible only at creation time and are no longer persisted for later retrieval.

ALTER TABLE api_keys
    DROP COLUMN IF EXISTS raw_key;
