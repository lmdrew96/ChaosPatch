import { getBaseUrl } from "@/lib/oauth";

export async function GET() {
  const base = getBaseUrl();
  return Response.json({
    resource: `${base}/mcp`,
    authorization_servers: [base],
    bearer_methods_supported: ["header"],
  });
}
