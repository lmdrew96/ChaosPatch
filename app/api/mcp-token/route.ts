import { auth } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";
import { getOrCreateMcpToken } from "@/lib/queries";

export async function GET() {
  const { userId } = await auth();
  if (!userId) return new Response("Unauthorized", { status: 401 });
  const token = await getOrCreateMcpToken(userId);
  return NextResponse.json({ token });
}
