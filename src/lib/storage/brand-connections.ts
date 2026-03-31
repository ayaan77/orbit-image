import { getDb } from "@/lib/storage/db";

export interface BrandConnection {
  readonly brandId: string;
  readonly connected: boolean;
  readonly connectedAt: string;
}

function rowToConnection(row: Record<string, unknown>): BrandConnection {
  return {
    brandId: row.brand_id as string,
    connected: row.connected as boolean,
    connectedAt: (row.connected_at as Date).toISOString(),
  };
}

/**
 * Get all connected brand IDs.
 * Returns empty array if Postgres is not configured.
 */
export async function getConnectedBrands(): Promise<readonly BrandConnection[]> {
  const db = getDb();
  if (!db) return [];

  try {
    const rows = await db`
      SELECT brand_id, connected, connected_at
      FROM brand_connections
      WHERE connected = true
      ORDER BY connected_at DESC
    `;
    return rows.map(rowToConnection);
  } catch {
    // Table may not exist yet — graceful fallback
    return [];
  }
}

/**
 * Connect a brand (upsert).
 */
export async function connectBrand(brandId: string): Promise<BrandConnection | null> {
  const db = getDb();
  if (!db) return null;

  try {
    const rows = await db`
      INSERT INTO brand_connections (brand_id, connected, connected_at, updated_at)
      VALUES (${brandId}, true, NOW(), NOW())
      ON CONFLICT (brand_id)
      DO UPDATE SET connected = true, connected_at = NOW(), updated_at = NOW()
      RETURNING brand_id, connected, connected_at
    `;
    return rows.length > 0 ? rowToConnection(rows[0]) : null;
  } catch {
    return null;
  }
}

/**
 * Disconnect a brand.
 */
export async function disconnectBrand(brandId: string): Promise<boolean> {
  const db = getDb();
  if (!db) return false;

  try {
    await db`
      UPDATE brand_connections
      SET connected = false, updated_at = NOW()
      WHERE brand_id = ${brandId}
    `;
    return true;
  } catch {
    return false;
  }
}
