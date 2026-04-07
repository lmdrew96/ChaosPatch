import { auth, currentUser } from "@clerk/nextjs/server";
import { redirect } from "next/navigation";
import Link from "next/link";
import { SignOutButton } from "@clerk/nextjs";
import { getOrCreateMcpToken } from "@/lib/queries";
import { McpTokenDisplay } from "./mcp-token";

export default async function SettingsPage() {
  const { userId } = await auth();
  if (!userId) redirect("/sign-in");

  const [user, mcpToken] = await Promise.all([
    currentUser(),
    getOrCreateMcpToken(userId),
  ]);

  return (
    <div className="min-h-screen bg-background text-foreground">
      <header className="border-b border-border px-6 py-4 flex items-center gap-3">
        <Link
          href="/"
          className="text-muted-foreground hover:text-foreground text-sm transition-colors"
        >
          ← Projects
        </Link>
        <span className="text-border">/</span>
        <span className="text-sm text-muted-foreground">Settings</span>
      </header>

      <main className="px-6 py-10 max-w-md mx-auto space-y-8">
        {/* Profile */}
        <section className="rounded-lg border border-border bg-card p-6 space-y-4">
          <h2 className="text-sm font-semibold text-foreground/70">Profile</h2>
          <div className="flex items-center gap-4">
            {user?.imageUrl && (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={user.imageUrl}
                alt={user.fullName ?? "Avatar"}
                className="w-10 h-10 rounded-full"
              />
            )}
            <div>
              <p className="text-sm font-medium text-foreground">
                {user?.fullName ?? "—"}
              </p>
              <p className="text-xs text-muted-foreground/70">
                {user?.primaryEmailAddress?.emailAddress}
              </p>
            </div>
          </div>
          <div className="pt-2 border-t border-border">
            <SignOutButton>
              <button className="text-sm text-red-400 hover:text-red-300 transition-colors">
                Sign out
              </button>
            </SignOutButton>
          </div>
        </section>

        {/* MCP Token */}
        <section className="rounded-lg border border-border bg-card p-6 space-y-3">
          <h2 className="text-sm font-semibold text-foreground/70">MCP Token</h2>
          <p className="text-xs text-muted-foreground/70">
            Add this as{" "}
            <code className="font-mono bg-input px-1 rounded text-muted-foreground">
              CHAOSPATCH_TOKEN
            </code>{" "}
            in your Claude Code or Claude Desktop MCP config to authenticate.
          </p>
          <McpTokenDisplay token={mcpToken} />
          <p className="text-xs text-muted-foreground/40 pt-1">
            MCP endpoint:{" "}
            <code className="font-mono text-muted-foreground/60">
              https://chaospatch.adhdesigns.dev/mcp
            </code>
          </p>
        </section>
      </main>
    </div>
  );
}
