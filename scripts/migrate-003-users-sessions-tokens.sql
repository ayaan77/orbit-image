-- Users, sessions, and MCP tokens for Orbit Image
-- Run this against your Neon/Vercel Postgres database

-- ─── Users ───
CREATE TABLE IF NOT EXISTS users (
  id              VARCHAR(32) PRIMARY KEY,
  username        VARCHAR(100) UNIQUE NOT NULL,
  email           VARCHAR(255) UNIQUE,
  password_hash   VARCHAR(255) NOT NULL,
  role            VARCHAR(16) NOT NULL DEFAULT 'user',
  rate_limit      INTEGER,
  monthly_budget_usd DECIMAL(8, 4),
  active          BOOLEAN NOT NULL DEFAULT TRUE,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_users_username ON users (username);
CREATE INDEX IF NOT EXISTS idx_users_role ON users (role);

-- ─── Sessions ───
CREATE TABLE IF NOT EXISTS sessions (
  id          VARCHAR(64) PRIMARY KEY,
  user_id     VARCHAR(32) NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  expires_at  TIMESTAMPTZ NOT NULL,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_sessions_user_id ON sessions (user_id);
CREATE INDEX IF NOT EXISTS idx_sessions_expires_at ON sessions (expires_at);

-- ─── MCP Tokens ───
CREATE TABLE IF NOT EXISTS mcp_tokens (
  id                  VARCHAR(32) PRIMARY KEY,
  key_hash            VARCHAR(64) UNIQUE NOT NULL,
  name                VARCHAR(100) NOT NULL,
  created_by          VARCHAR(32) NOT NULL REFERENCES users(id),
  active              BOOLEAN NOT NULL DEFAULT TRUE,
  rate_limit          INTEGER,
  scopes              TEXT[],
  default_webhook_url TEXT,
  monthly_budget_usd  DECIMAL(8, 4),
  created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_mcp_tokens_key_hash ON mcp_tokens (key_hash);
CREATE INDEX IF NOT EXISTS idx_mcp_tokens_created_by ON mcp_tokens (created_by);

-- ─── Add user_id to usage_logs ───
ALTER TABLE usage_logs ADD COLUMN IF NOT EXISTS user_id VARCHAR(32);
CREATE INDEX IF NOT EXISTS idx_usage_user_id ON usage_logs (user_id);
