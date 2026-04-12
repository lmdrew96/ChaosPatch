import { consumeAuthCode, verifyPkce, createAccessToken } from "@/lib/oauth";

export async function POST(req: Request) {
  const body = await req.text();
  const params = new URLSearchParams(body);

  const grantType = params.get("grant_type");
  const code = params.get("code");
  const redirectUri = params.get("redirect_uri");
  const clientId = params.get("client_id");
  const codeVerifier = params.get("code_verifier");

  if (grantType !== "authorization_code") {
    return Response.json(
      { error: "unsupported_grant_type" },
      { status: 400 }
    );
  }
  if (!code || !redirectUri || !clientId || !codeVerifier) {
    return Response.json(
      { error: "invalid_request", error_description: "Missing required parameters" },
      { status: 400 }
    );
  }

  // Consume the one-time auth code
  const record = await consumeAuthCode(code);
  if (!record) {
    return Response.json(
      { error: "invalid_grant", error_description: "Code expired or already used" },
      { status: 400 }
    );
  }

  // Validate client_id and redirect_uri match
  if (record.client_id !== clientId || record.redirect_uri !== redirectUri) {
    return Response.json(
      { error: "invalid_grant", error_description: "Client or redirect mismatch" },
      { status: 400 }
    );
  }

  // Verify PKCE
  const pkceValid = await verifyPkce(codeVerifier, record.code_challenge);
  if (!pkceValid) {
    return Response.json(
      { error: "invalid_grant", error_description: "PKCE verification failed" },
      { status: 400 }
    );
  }

  // Issue access token
  const accessToken = await createAccessToken(record.user_id);

  return Response.json({
    access_token: accessToken,
    token_type: "Bearer",
  });
}
