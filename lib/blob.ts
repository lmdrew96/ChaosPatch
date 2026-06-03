import { issueSignedToken, presignUrl } from "@vercel/blob";

/**
 * Presign a short-lived GET URL for a private blob so it can be fetched or
 * displayed. Blobs live in a private store, so their plain url isn't directly
 * readable — every read goes through a signed URL. Uses BLOB_READ_WRITE_TOKEN
 * (or OIDC) from the environment for the control-plane signing call.
 */
export async function presignBlobGetUrl(
  pathname: string,
  validForMs = 60 * 60 * 1000
): Promise<string> {
  const signed = await issueSignedToken({
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
