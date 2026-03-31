-- Brand connections for Orbit Image
-- Tracks which brands are "connected" (active in the admin panel)
-- Run: psql $POSTGRES_URL < scripts/migrate-004-brand-connections.sql

CREATE TABLE IF NOT EXISTS brand_connections (
  brand_id      VARCHAR(64) PRIMARY KEY,
  connected     BOOLEAN NOT NULL DEFAULT true,
  connected_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_brand_connections_connected
  ON brand_connections (connected) WHERE connected = true;
