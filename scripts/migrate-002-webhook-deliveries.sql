-- Webhook delivery tracking for Orbit Image
-- Run this against your Neon/Vercel Postgres database

CREATE TABLE IF NOT EXISTS webhook_deliveries (
  id              SERIAL PRIMARY KEY,
  job_id          VARCHAR(64) NOT NULL,
  url             TEXT NOT NULL,
  status          VARCHAR(16) NOT NULL DEFAULT 'pending',  -- pending, delivered, failed
  attempts        SMALLINT NOT NULL DEFAULT 0,
  last_attempt_at TIMESTAMPTZ,
  response_status SMALLINT,
  error           TEXT,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Indexes for common queries
CREATE INDEX IF NOT EXISTS idx_webhook_job_id ON webhook_deliveries (job_id);
CREATE INDEX IF NOT EXISTS idx_webhook_status ON webhook_deliveries (status);
CREATE INDEX IF NOT EXISTS idx_webhook_created_at ON webhook_deliveries (created_at);
