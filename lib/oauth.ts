import { sql } from "./db";

// ── Base URL ──────────────────────────────────────────────────────────────

export function getBaseUrl(): string {
  if (process.env.NEXT_PUBLIC_APP_URL) return process.env.NEXT_PUBLIC_APP_URL;
  if (process.env.VERCEL_URL) return `https://${process.env.VERCEL_URL}`;
  return "http://localhost:3000";
}

// ── Client Registration ───────────────────────────────────────────────────

export async function registerClient(
  redirectUris: string[],
  clientName?: string
): Promise<{ client_id: string; client_secret: string }> {
  const clientId = crypto.randomUUID();
  const clientSecret = crypto.randomUUID();
  await sql`
    INSERT INTO oauth_clients (client_id, client_secret, redirect_uris, client_name)
    VALUES (${clientId}, ${clientSecret}, ${redirectUris}, ${clientName ?? null})
  `;
  return { client_id: clientId, client_secret: clientSecret };
}

export async function getClient(
  clientId: string
): Promise<{ client_id: string; redirect_uris: string[]; client_name: string | null } | null> {
  const rows = await sql`
    SELECT client_id, redirect_uris, client_name FROM oauth_clients
    WHERE client_id = ${clientId} LIMIT 1
  `;
  return (rows[0] as { client_id: string; redirect_uris: string[]; client_name: string | null }) ?? null;
}

// ── Authorization Codes ───────────────────────────────────────────────────

export async function createAuthCode(
  clientId: string,
  userId: string,
  redirectUri: string,
  codeChallenge: string
): Promise<string> {
  const code = crypto.randomUUID();
  const expiresAt = new Date(Date.now() + 10 * 60 * 1000).toISOString(); // 10 min
  await sql`
    INSERT INTO oauth_codes (code, client_id, user_id, redirect_uri, code_challenge, expires_at)
    VALUES (${code}, ${clientId}, ${userId}, ${redirectUri}, ${codeChallenge}, ${expiresAt})
  `;
  return code;
}

export async function consumeAuthCode(
  code: string
): Promise<{
  client_id: string;
  user_id: string;
  redirect_uri: string;
  code_challenge: string;
} | null> {
  const rows = await sql`
    DELETE FROM oauth_codes
    WHERE code = ${code} AND expires_at > now()
    RETURNING client_id, user_id, redirect_uri, code_challenge
  `;
  return (rows[0] as {
    client_id: string;
    user_id: string;
    redirect_uri: string;
    code_challenge: string;
  }) ?? null;
}

// ── PKCE ──────────────────────────────────────────────────────────────────

export async function verifyPkce(
  codeVerifier: string,
  codeChallenge: string
): Promise<boolean> {
  const data = new TextEncoder().encode(codeVerifier);
  const hash = await crypto.subtle.digest("SHA-256", data);
  const computed = btoa(String.fromCharCode(...new Uint8Array(hash)))
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/, "");
  return computed === codeChallenge;
}

// ── Access Tokens ─────────────────────────────────────────────────────────

export async function createAccessToken(userId: string): Promise<string> {
  // Reuse the existing mcp_tokens table
  const existing = await sql`
    SELECT token FROM mcp_tokens WHERE user_id = ${userId} LIMIT 1
  `;
  if (existing[0]?.token) return existing[0].token as string;

  const token =
    crypto.randomUUID().replace(/-/g, "") +
    crypto.randomUUID().replace(/-/g, "");
  await sql`
    INSERT INTO mcp_tokens (token, user_id) VALUES (${token}, ${userId})
  `;
  return token;
}
