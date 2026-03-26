-- Usage logs table for Orbit Image
-- Run this against your Neon/Vercel Postgres database

CREATE TABLE IF NOT EXISTS usage_logs (
  id            SERIAL PRIMARY KEY,
  client_id     VARCHAR(32) NOT NULL,
  client_name   VARCHAR(100) NOT NULL,
  brand         VARCHAR(64) NOT NULL,
  purpose       VARCHAR(32) NOT NULL,
  style         VARCHAR(32),
  image_count   SMALLINT NOT NULL DEFAULT 1,
  quality       VARCHAR(10) NOT NULL DEFAULT 'hd',
  estimated_cost_usd DECIMAL(8, 4) NOT NULL DEFAULT 0,
  processing_time_ms INTEGER NOT NULL DEFAULT 0,
  cached        BOOLEAN NOT NULL DEFAULT FALSE,
  endpoint      VARCHAR(10) NOT NULL DEFAULT 'rest',
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Indexes for common queries
CREATE INDEX IF NOT EXISTS idx_usage_client_id ON usage_logs (client_id);
CREATE INDEX IF NOT EXISTS idx_usage_created_at ON usage_logs (created_at);
CREATE INDEX IF NOT EXISTS idx_usage_brand ON usage_logs (brand);
