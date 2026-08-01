import {
  DeleteObjectCommand,
  GetObjectCommand,
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

export async function deleteObject(key: string): Promise<void> {
  await client.send(new DeleteObjectCommand({ Bucket: BUCKET, Key: key }));
}
