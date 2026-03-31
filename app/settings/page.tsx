import { auth, currentUser } from "@clerk/nextjs/server";
import { redirect } from "next/navigation";
import Link from "next/link";
import { SignOutButton } from "@clerk/nextjs";

export default async function SettingsPage() {
  const { userId } = await auth();
  if (!userId) redirect("/sign-in");

  const user = await currentUser();

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

        {/* MCP Info */}
        <section className="rounded-lg border border-zinc-800 bg-zinc-900 p-6 space-y-3">
          <h2 className="text-sm font-semibold text-zinc-300">
            Claude Code MCP
          </h2>
          <p className="text-xs text-zinc-500">
            Your user ID — pass this as{" "}
            <code className="font-mono bg-zinc-950 px-1 rounded text-zinc-400">
              user_id
            </code>{" "}
            in MCP tool calls.
          </p>
          <code className="block font-mono text-xs bg-zinc-950 border border-zinc-800 rounded px-3 py-2 text-indigo-300 break-all select-all">
            {userId}
          </code>
        </section>
      </main>
    </div>
  );
}
