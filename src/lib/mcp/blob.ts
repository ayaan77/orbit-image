import { put } from "@vercel/blob";
import { getEnv } from "@/lib/config/env";

export interface BlobUploadResult {
  readonly url: string;
  readonly pathname: string;
}

/**
 * Upload a base64-encoded image to Vercel Blob.
 * Returns a public URL with a 1-hour cache TTL.
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
    token: BLOB_READ_WRITE_TOKEN,
  });

  return {
    url: blob.url,
    pathname: blob.pathname,
  };
}
