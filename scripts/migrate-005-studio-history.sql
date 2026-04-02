-- Studio history: persists generated images per user in Postgres.
-- Replace localStorage (5 MB quota) with server-side storage.

CREATE TABLE IF NOT EXISTS studio_history (
  id                  VARCHAR(32)  PRIMARY KEY,
  user_id             VARCHAR(32)  NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  topic               TEXT         NOT NULL,
  purpose             VARCHAR(32)  NOT NULL,
  brand               VARCHAR(64)  NOT NULL DEFAULT '',
  model               VARCHAR(64)  NOT NULL,
  image_data_url      TEXT         NOT NULL DEFAULT '', -- Blob URL or thumbnail data URL
  mime_type           VARCHAR(32)  NOT NULL DEFAULT 'image/png',
  width               INTEGER      NOT NULL DEFAULT 1024,
  height              INTEGER      NOT NULL DEFAULT 1024,
  processing_time_ms  INTEGER      NOT NULL DEFAULT 0,
  brand_context_used  BOOLEAN      NOT NULL DEFAULT FALSE,
  created_at          TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_studio_history_user_id    ON studio_history (user_id);
CREATE INDEX IF NOT EXISTS idx_studio_history_created_at ON studio_history (created_at);
