"use client";

import Link from "next/link";
import { UserButton, useAuth } from "@clerk/nextjs";

export function AppHeader() {
  const { isSignedIn } = useAuth();
  if (!isSignedIn) return null;

  return (
    <>
      <div className="fixed top-4 left-1/2 -translate-x-1/2 z-50">
        <div className="flex items-center gap-3 rounded-full border border-zinc-700 bg-zinc-900/90 backdrop-blur px-4 py-2 shadow-lg">
          <Link
            href="/dashboard"
            className="text-sm font-semibold text-zinc-100 hover:text-white transition-colors"
          >
            ChaosPatch
          </Link>
          <div className="w-px h-3.5 bg-zinc-700" />
          <div className="flex items-center gap-2.5">
            <Link
              href="/settings"
              className="text-zinc-500 hover:text-zinc-300 transition-colors"
              title="Settings"
            >
              <svg
                xmlns="http://www.w3.org/2000/svg"
                width="14"
                height="14"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <path d="M12.22 2h-.44a2 2 0 0 0-2 2v.18a2 2 0 0 1-1 1.73l-.43.25a2 2 0 0 1-2 0l-.15-.08a2 2 0 0 0-2.73.73l-.22.38a2 2 0 0 0 .73 2.73l.15.1a2 2 0 0 1 1 1.72v.51a2 2 0 0 1-1 1.74l-.15.09a2 2 0 0 0-.73 2.73l.22.38a2 2 0 0 0 2.73.73l.15-.08a2 2 0 0 1 2 0l.43.25a2 2 0 0 1 1 1.73V20a2 2 0 0 0 2 2h.44a2 2 0 0 0 2-2v-.18a2 2 0 0 1 1-1.73l.43-.25a2 2 0 0 1 2 0l.15.08a2 2 0 0 0 2.73-.73l.22-.39a2 2 0 0 0-.73-2.73l-.15-.08a2 2 0 0 1-1-1.74v-.5a2 2 0 0 1 1-1.74l.15-.09a2 2 0 0 0 .73-2.73l-.22-.38a2 2 0 0 0-2.73-.73l-.15.08a2 2 0 0 1-2 0l-.43-.25a2 2 0 0 1-1-1.73V4a2 2 0 0 0-2-2z" />
                <circle cx="12" cy="12" r="3" />
              </svg>
            </Link>
            <UserButton />
          </div>
        </div>
      </div>
    </>
  );
}
