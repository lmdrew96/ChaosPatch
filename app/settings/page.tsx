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
    <div className="min-h-screen bg-zinc-950 text-zinc-50">
      <header className="border-b border-zinc-800 px-6 py-4 flex items-center gap-3">
        <Link
          href="/"
          className="text-zinc-500 hover:text-zinc-300 text-sm transition-colors"
        >
          ← Projects
        </Link>
        <span className="text-zinc-700">/</span>
        <span className="text-sm text-zinc-400">Settings</span>
      </header>

      <main className="px-6 py-10 max-w-md mx-auto space-y-8">
        {/* Profile */}
        <section className="rounded-lg border border-zinc-800 bg-zinc-900 p-6 space-y-4">
          <h2 className="text-sm font-semibold text-zinc-300">Profile</h2>
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
              <p className="text-sm font-medium text-zinc-100">
                {user?.fullName ?? "—"}
              </p>
              <p className="text-xs text-zinc-500">
                {user?.primaryEmailAddress?.emailAddress}
              </p>
            </div>
          </div>
          <div className="pt-2 border-t border-zinc-800">
            <SignOutButton>
              <button className="text-sm text-red-400 hover:text-red-300 transition-colors">
                Sign out
              </button>
            </SignOutButton>
          </div>
        </section>

        {/* MCP Token */}
        <section className="rounded-lg border border-zinc-800 bg-zinc-900 p-6 space-y-3">
          <h2 className="text-sm font-semibold text-zinc-300">MCP Token</h2>
          <p className="text-xs text-zinc-500">
            Add this as{" "}
            <code className="font-mono bg-zinc-950 px-1 rounded text-zinc-400">
              CHAOSPATCH_TOKEN
            </code>{" "}
            in your Claude Code or Claude Desktop MCP config to authenticate.
          </p>
          <McpTokenDisplay token={mcpToken} />
          <p className="text-xs text-zinc-600 pt-1">
            MCP endpoint:{" "}
            <code className="font-mono text-zinc-500">
              https://chaospatch.adhdesigns.dev/mcp
            </code>
          </p>
        </section>
      </main>
    </div>
  );
}
