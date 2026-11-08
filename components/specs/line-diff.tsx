// Line-level diff for spec revisions: longest common subsequence over lines.
// Sections are short, so O(n·m) is fine; past MAX_CELLS it falls back to
// "everything removed, everything added" rather than hanging the tab.

type Op = { kind: "same" | "add" | "del"; text: string };

const MAX_CELLS = 250_000;

export function diffLines(before: string, after: string): Op[] {
  const a = before.split("\n");
  const b = after.split("\n");
  if (a.length * b.length > MAX_CELLS) {
    return [
      ...a.map((text) => ({ kind: "del" as const, text })),
      ...b.map((text) => ({ kind: "add" as const, text })),
    ];
  }
  // lcs[i][j] = LCS length of a[i:] and b[j:]
  const lcs = Array.from({ length: a.length + 1 }, () => new Array<number>(b.length + 1).fill(0));
  for (let i = a.length - 1; i >= 0; i--) {
    for (let j = b.length - 1; j >= 0; j--) {
      lcs[i][j] = a[i] === b[j] ? lcs[i + 1][j + 1] + 1 : Math.max(lcs[i + 1][j], lcs[i][j + 1]);
    }
  }
  const ops: Op[] = [];
  let i = 0;
  let j = 0;
  while (i < a.length && j < b.length) {
    if (a[i] === b[j]) {
      ops.push({ kind: "same", text: a[i] });
      i++;
      j++;
    } else if (lcs[i + 1][j] >= lcs[i][j + 1]) {
      ops.push({ kind: "del", text: a[i++] });
    } else {
      ops.push({ kind: "add", text: b[j++] });
    }
  }
  while (i < a.length) ops.push({ kind: "del", text: a[i++] });
  while (j < b.length) ops.push({ kind: "add", text: b[j++] });
  return ops;
}

/** Raw-markdown line diff: removed lines in red with −, added in green with +. */
export function LineDiff({ before, after }: { before: string; after: string }) {
  const ops = diffLines(before, after);
  if (ops.every((o) => o.kind === "same")) {
    return <p className="text-[11px] text-muted-foreground/60">No change to the text.</p>;
  }
  return (
    <pre className="overflow-x-auto rounded bg-background/60 p-2 font-mono text-[11px] leading-relaxed">
      {ops.map((o, i) => (
        <div
          key={i}
          className={
            o.kind === "add"
              ? "bg-success/10 text-success"
              : o.kind === "del"
                ? "bg-destructive/10 text-destructive line-through decoration-destructive/40"
                : "text-muted-foreground/70"
          }
        >
          <span aria-hidden className="select-none pr-2 opacity-60">
            {o.kind === "add" ? "+" : o.kind === "del" ? "−" : " "}
          </span>
          <span className="sr-only">{o.kind === "add" ? "Added: " : o.kind === "del" ? "Removed: " : ""}</span>
          {o.text || " "}
        </div>
      ))}
    </pre>
  );
}
