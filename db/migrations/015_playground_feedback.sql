-- Playground feedback: thumbs-up / thumbs-down on individual search results.
-- Used to collect human preference signals for future model training.

CREATE TABLE IF NOT EXISTS playground_feedback (
    id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id     TEXT NOT NULL REFERENCES user_profiles(id) ON DELETE CASCADE,
    request_id  TEXT NOT NULL,
    result_id   TEXT NOT NULL,
    rating      SMALLINT NOT NULL CHECK (rating IN (-1, 1)),
    created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    UNIQUE (user_id, request_id, result_id)
);

CREATE INDEX idx_playground_feedback_user   ON playground_feedback (user_id);
CREATE INDEX idx_playground_feedback_request ON playground_feedback (request_id);
