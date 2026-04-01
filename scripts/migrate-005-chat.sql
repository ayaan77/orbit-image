-- migrate-005-chat.sql
-- Orbit Chat: 7 new tables, zero changes to existing schema

CREATE TABLE IF NOT EXISTS workspaces (
  id          VARCHAR(32) PRIMARY KEY,
  brand_id    VARCHAR(64) UNIQUE NOT NULL,
  name        VARCHAR(100) NOT NULL,
  slug        VARCHAR(64) UNIQUE NOT NULL,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS workspace_members (
  workspace_id  VARCHAR(32) NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  user_id       VARCHAR(32) NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  role          VARCHAR(16) NOT NULL DEFAULT 'member',
  joined_at     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (workspace_id, user_id)
);

CREATE TABLE IF NOT EXISTS channels (
  id            VARCHAR(32) PRIMARY KEY,
  workspace_id  VARCHAR(32) NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  name          VARCHAR(64) NOT NULL,
  description   TEXT,
  is_dm         BOOLEAN NOT NULL DEFAULT FALSE,
  created_by    VARCHAR(32) REFERENCES users(id),
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (workspace_id, name)
);

CREATE TABLE IF NOT EXISTS channel_members (
  channel_id  VARCHAR(32) NOT NULL REFERENCES channels(id) ON DELETE CASCADE,
  user_id     VARCHAR(32) NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  PRIMARY KEY (channel_id, user_id)
);

CREATE TABLE IF NOT EXISTS messages (
  id          VARCHAR(32) PRIMARY KEY,
  channel_id  VARCHAR(32) NOT NULL REFERENCES channels(id) ON DELETE CASCADE,
  user_id     VARCHAR(32) NOT NULL REFERENCES users(id),
  content     TEXT NOT NULL DEFAULT '',
  type        VARCHAR(16) NOT NULL DEFAULT 'text',
  parent_id   VARCHAR(32) REFERENCES messages(id),
  deleted_at  TIMESTAMPTZ,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_messages_channel_created ON messages(channel_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_messages_parent ON messages(parent_id) WHERE parent_id IS NOT NULL;

CREATE TABLE IF NOT EXISTS message_images (
  message_id      VARCHAR(32) PRIMARY KEY REFERENCES messages(id) ON DELETE CASCADE,
  generation_ref  VARCHAR(64),
  brand           VARCHAR(64) NOT NULL,
  prompt          TEXT NOT NULL,
  model           VARCHAR(32) NOT NULL,
  image_url       TEXT NOT NULL,
  mime_type       VARCHAR(32) NOT NULL DEFAULT 'image/png',
  dimensions      JSONB NOT NULL,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS message_reactions (
  id          VARCHAR(32) PRIMARY KEY,
  message_id  VARCHAR(32) NOT NULL REFERENCES messages(id) ON DELETE CASCADE,
  user_id     VARCHAR(32) NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  emoji       VARCHAR(16) NOT NULL,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (message_id, user_id, emoji)
);
CREATE INDEX IF NOT EXISTS idx_reactions_message ON message_reactions(message_id);

CREATE TABLE IF NOT EXISTS mentions (
  id                  VARCHAR(32) PRIMARY KEY,
  message_id          VARCHAR(32) NOT NULL REFERENCES messages(id) ON DELETE CASCADE,
  mentioned_user_id   VARCHAR(32) NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  read_at             TIMESTAMPTZ,
  created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_mentions_user_unread ON mentions(mentioned_user_id) WHERE read_at IS NULL;
