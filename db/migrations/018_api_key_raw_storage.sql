-- Store raw API keys so users can view them later in the dashboard.
-- Existing keys created before this migration will have raw_key = NULL (unrecoverable).

ALTER TABLE api_keys ADD COLUMN IF NOT EXISTS raw_key TEXT;
