import { issueSignedToken, presignUrl } from "@vercel/blob";

/**
 * The read-write token, passed explicitly to every blob op. Without it the SDK
 * prefers OIDC (VERCEL_OIDC_TOKEN + BLOB_STORE_ID) when those are present, which
 * fails for control-plane signing/delete (stale locally, not permitted in prod)
 * even though uploads — which use the read-write token directly — succeed.
 * Passing it forces the read-write path everywhere, consistent with upload.
 */
export const BLOB_TOKEN = process.env.BLOB_READ_WRITE_TOKEN;

/**
 * Presign a short-lived GET URL for a private blob so it can be fetched or
 * displayed. Blobs live in a private store, so their plain url isn't directly
 * readable — every read goes through a signed URL.
 */
export async function presignBlobGetUrl(
  pathname: string,
  validForMs = 60 * 60 * 1000
): Promise<string> {
  const signed = await issueSignedToken({
    token: BLOB_TOKEN,
    pathname,
    operations: ["get"],
    validUntil: Date.now() + validForMs,
  });
  const { presignedUrl } = await presignUrl(signed, {
    operation: "get",
    pathname,
    access: "private",
  });
  return presignedUrl;
}
