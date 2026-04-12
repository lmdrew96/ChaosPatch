import { registerClient } from "@/lib/oauth";

export async function POST(req: Request) {
  const body = await req.json();
  const redirectUris: string[] = body.redirect_uris;
  if (!Array.isArray(redirectUris) || redirectUris.length === 0) {
    return Response.json(
      { error: "invalid_request", error_description: "redirect_uris required" },
      { status: 400 }
    );
  }

  const { client_id, client_secret } = await registerClient(
    redirectUris,
    body.client_name
  );

  return Response.json(
    {
      client_id,
      client_secret,
      redirect_uris: redirectUris,
      client_name: body.client_name ?? null,
      token_endpoint_auth_method: "none",
    },
    { status: 201 }
  );
}
