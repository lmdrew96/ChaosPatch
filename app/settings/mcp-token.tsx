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
      <code className="flex-1 font-mono text-xs bg-input border border-border rounded px-3 py-2 text-primary break-all select-all">
        {token}
      </code>
      <button
        onClick={copy}
        className="shrink-0 text-xs px-3 py-2 rounded border border-border bg-muted hover:bg-muted/70 text-foreground/70 transition-colors"
      >
        {copied ? "Copied!" : "Copy"}
      </button>
    </div>
  );
}
