import { clerkMiddleware, createRouteMatcher } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";

const isPublicRoute = createRouteMatcher([
  "/",
  "/sign-in(.*)",
  "/sign-up(.*)",
  "/mcp(.*)",
  "/api/mcp-token(.*)",
  "/oauth(.*)",
  "/.well-known(.*)",
]);

export default clerkMiddleware(async (auth, req) => {
  // "/" is the marketing page — signed-in users (and PWA launches) skip it.
  if (req.nextUrl.pathname === "/") {
    const { userId } = await auth();
    if (userId) return NextResponse.redirect(new URL("/dashboard", req.url));
  }

  if (!isPublicRoute(req)) {
    await auth.protect();
  }
});

export const config = {
  matcher: [
    "/((?!_next|[^?]*\\.(?:html?|css|js(?!on)|jpe?g|webp|png|gif|svg|ttf|woff2?|ico|csv|docx?|xlsx?|zip|webmanifest|json)).*)",
    "/(api|trpc)(.*)",
  ],
};
