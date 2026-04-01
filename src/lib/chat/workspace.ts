import { randomBytes } from 'crypto';
import { createCachedCortexClient } from '@/lib/cortex/cached-client';
import { getDb } from '@/lib/storage/db';

const DEFAULT_CHANNELS = [
  { name: 'general', description: 'General discussion' },
  { name: 'blog-hero', description: 'Blog hero image generation' },
  { name: 'social-og', description: 'Social Open Graph image generation' },
  { name: 'ad-creative', description: 'Ad creative image generation' },
] as const;

function generateId(): string {
  return randomBytes(16).toString('hex');
}

function slugify(name: string): string {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');
}

/**
 * Fetches brands from Cortex, upserts workspaces, seeds default channels,
 * and adds all existing users as workspace members with 'member' role.
 */
export async function syncWorkspacesFromCortex(): Promise<void> {
  const db = getDb();
  if (!db) return;

  const client = createCachedCortexClient();
  const brands = await client.listBrands();

  // Fetch all existing users once
  const userRows = await db`SELECT id FROM users WHERE active = TRUE`;
  const userIds = userRows.map((r) => r.id as string);

  for (const brand of brands) {
    const brandId = brand.id;
    const name = brandId.charAt(0).toUpperCase() + brandId.slice(1);
    const slug = slugify(brandId);

    // Upsert workspace
    const workspaceRows = await db`
      INSERT INTO workspaces (id, brand_id, name, slug)
      VALUES (${generateId()}, ${brandId}, ${name}, ${slug})
      ON CONFLICT (brand_id) DO UPDATE
        SET name = EXCLUDED.name, slug = EXCLUDED.slug
      RETURNING id
    `;

    const workspaceId = workspaceRows[0].id as string;

    // Seed default channels
    for (const ch of DEFAULT_CHANNELS) {
      await db`
        INSERT INTO channels (id, workspace_id, name, description, is_dm)
        VALUES (${generateId()}, ${workspaceId}, ${ch.name}, ${ch.description}, FALSE)
        ON CONFLICT (workspace_id, name) DO NOTHING
      `;
    }

    // Add all existing users as workspace members
    if (userIds.length > 0) {
      for (const userId of userIds) {
        await db`
          INSERT INTO workspace_members (workspace_id, user_id, role)
          VALUES (${workspaceId}, ${userId}, 'member')
          ON CONFLICT (workspace_id, user_id) DO NOTHING
        `;
      }
    }
  }
}
