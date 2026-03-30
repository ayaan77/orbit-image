import { put, del } from "@vercel/blob";
import { getEnv } from "@/lib/config/env";
import { getKv } from "@/lib/storage/kv";
import { createLogger } from "@/lib/logging/logger";

const BLOB_METADATA_PREFIX = "oimg:blobs:";
const DEFAULT_BLOB_TTL_SECONDS = 7 * 24 * 60 * 60; // 7 days

export interface BlobUploadResult {
  readonly url: string;
  readonly pathname: string;
}

interface BlobMetadata {
  readonly url: string;
  readonly pathname: string;
  readonly createdAt: string;
}

/**
 * Upload a base64-encoded image to Vercel Blob.
 * Tracks metadata in Redis with a TTL for future cleanup.
 *
 * Throws if BLOB_READ_WRITE_TOKEN is not configured.
 */
export async function uploadImageToBlob(
  base64: string,
  mimeType: string,
  filename: string
): Promise<BlobUploadResult> {
  const { BLOB_READ_WRITE_TOKEN } = getEnv();

  if (!BLOB_READ_WRITE_TOKEN) {
    throw new Error(
      "BLOB_READ_WRITE_TOKEN is required for URL output format. Set it in your environment or use output_format: 'base64'."
    );
  }

  const buffer = Buffer.from(base64, "base64");

  const blob = await put(filename, buffer, {
    access: "public",
    contentType: mimeType,
    addRandomSuffix: true,
    token: BLOB_READ_WRITE_TOKEN,
    cacheControlMaxAge: DEFAULT_BLOB_TTL_SECONDS,
  });

  // Track blob metadata in Redis for future cleanup
  try {
    const kv = getKv();
    if (kv) {
      const metadata: BlobMetadata = {
        url: blob.url,
        pathname: blob.pathname,
        createdAt: new Date().toISOString(),
      };
      await kv.set(
        `${BLOB_METADATA_PREFIX}${blob.pathname}`,
        metadata,
        { ex: DEFAULT_BLOB_TTL_SECONDS },
      );
    }
  } catch {
    // Non-critical — blob is uploaded, metadata tracking failed silently
  }

  return {
    url: blob.url,
    pathname: blob.pathname,
  };
}

/**
 * Delete expired blobs that have been tracked in Redis.
 * Call from a cron endpoint to clean up old images.
 */
export async function cleanupExpiredBlobs(): Promise<{
  deleted: number;
  errors: number;
}> {
  const logger = createLogger({ module: "blob-cleanup" });
  const { BLOB_READ_WRITE_TOKEN } = getEnv();

  if (!BLOB_READ_WRITE_TOKEN) {
    return { deleted: 0, errors: 0 };
  }

  const kv = getKv();
  if (!kv) {
    return { deleted: 0, errors: 0 };
  }

  let deleted = 0;
  let errors = 0;
  let cursor = 0;

  // Scan for expired blob metadata keys
  // (Keys that still exist have NOT expired; this is for manual cleanup of orphans)
  do {
    const result = await kv.scan(cursor, {
      match: `${BLOB_METADATA_PREFIX}*`,
      count: 50,
    });
    const [nextCursor, keys] = result;
    cursor = Number(nextCursor);

    for (const key of keys) {
      try {
        const metadata = await kv.get<BlobMetadata>(key);
        if (!metadata) continue;

        // Only delete blobs older than the TTL
        const age = Date.now() - new Date(metadata.createdAt).getTime();
        if (age < DEFAULT_BLOB_TTL_SECONDS * 1000) continue;

        // Delete the blob from Vercel
        await del(metadata.url, { token: BLOB_READ_WRITE_TOKEN });
        await kv.del(key);
        deleted++;
      } catch (err) {
        errors++;
        logger.warn("Failed to delete blob", {
          key,
          error: err instanceof Error ? err.message : String(err),
        });
      }
    }
  } while (cursor !== 0);

  logger.info("Blob cleanup completed", { deleted, errors });
  return { deleted, errors };
}
