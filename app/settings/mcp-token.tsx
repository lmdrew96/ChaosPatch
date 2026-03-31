"use client";

import { useState } from "react";

export function McpTokenDisplay({ token }: { token: string }) {
  const [copied, setCopied] = useState(false);

  async function copy() {
    await navigator.clipboard.writeText(token);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  return (
    <div className="flex items-start gap-2">
      <code className="flex-1 font-mono text-xs bg-zinc-950 border border-zinc-800 rounded px-3 py-2 text-indigo-300 break-all select-all">
        {token}
      </code>
      <button
        onClick={copy}
        className="shrink-0 text-xs px-3 py-2 rounded border border-zinc-700 bg-zinc-800 hover:bg-zinc-700 text-zinc-300 transition-colors"
      >
        {copied ? "Copied!" : "Copy"}
      </button>
    </div>
  );
}
