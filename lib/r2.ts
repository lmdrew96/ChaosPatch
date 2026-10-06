import {
  DeleteObjectCommand,
  GetObjectCommand,
  HeadObjectCommand,
  PutObjectCommand,
  S3Client,
} from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";

/**
 * R2 speaks the S3 API, so the AWS SDK talks to it via an account-scoped
 * endpoint instead of a real AWS region. Cloudflare's own docs specify
 * region "auto" for this.
 */
const client = new S3Client({
  region: "auto",
  endpoint: `https://${process.env.R2_ACCOUNT_ID}.r2.cloudflarestorage.com`,
  credentials: {
    accessKeyId: process.env.R2_ACCESS_KEY_ID ?? "",
    secretAccessKey: process.env.R2_SECRET_ACCESS_KEY ?? "",
  },
});

const BUCKET = process.env.R2_BUCKET_NAME ?? "";

/** Max image attachment size, shared by the in-app and MCP upload flows. */
export const MAX_UPLOAD_BYTES = 10 * 1024 * 1024;

/**
 * Canonical (non-signed) object URL, stored alongside the pathname key for
 * record-keeping. The bucket has no public access, so this url alone is
 * never directly fetchable — every read goes through presignGetUrl.
 */
export function objectUrl(key: string): string {
  return `https://${process.env.R2_ACCOUNT_ID}.r2.cloudflarestorage.com/${BUCKET}/${key}`;
}

/**
 * Presign a short-lived PUT URL so the browser can upload straight to R2.
 * ContentType and ContentLength are signed into the URL, so the upload must
 * match the size/type validated server-side when this was minted.
 */
export async function presignPutUrl(
  key: string,
  contentType: string,
  contentLength: number,
  validForMs = 5 * 60 * 1000
): Promise<string> {
  const command = new PutObjectCommand({
    Bucket: BUCKET,
    Key: key,
    ContentType: contentType,
    ContentLength: contentLength,
  });
  return getSignedUrl(client, command, {
    expiresIn: Math.round(validForMs / 1000),
  });
}

/**
 * Presign a short-lived GET URL for a private object so it can be fetched or
 * displayed. Every read goes through this since the bucket isn't public.
 */
export async function presignGetUrl(
  key: string,
  validForMs = 60 * 60 * 1000
): Promise<string> {
  const command = new GetObjectCommand({ Bucket: BUCKET, Key: key });
  return getSignedUrl(client, command, {
    expiresIn: Math.round(validForMs / 1000),
  });
}

/**
 * Look up an uploaded object's type and size, or null if it doesn't exist
 * (never uploaded, or the presigned PUT expired before the client used it).
 */
export async function headObject(
  key: string
): Promise<{ contentType: string | null; size: number | null } | null> {
  try {
    const res = await client.send(
      new HeadObjectCommand({ Bucket: BUCKET, Key: key })
    );
    return {
      contentType: res.ContentType ?? null,
      size: res.ContentLength ?? null,
    };
  } catch (err) {
    if (
      err instanceof Error &&
      (err.name === "NotFound" || err.name === "NoSuchKey")
    ) {
      return null;
    }
    throw err;
  }
}

export async function deleteObject(key: string): Promise<void> {
  await client.send(new DeleteObjectCommand({ Bucket: BUCKET, Key: key }));
}

/**
 * Best-effort removal of several objects, e.g. a deleted patch's or project's
 * attachments. Failures are logged, not thrown: the DB rows are already gone,
 * so a stray object shouldn't fail the user's delete.
 */
export async function deleteObjects(keys: string[]): Promise<void> {
  const results = await Promise.allSettled(keys.map((key) => deleteObject(key)));
  results.forEach((result, i) => {
    if (result.status === "rejected") {
      console.error("Failed to delete R2 object", keys[i], result.reason);
    }
  });
}
