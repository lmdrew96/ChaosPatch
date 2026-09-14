import ReactMarkdown, { type Components } from "react-markdown";
import remarkGfm from "remark-gfm";
import remarkBreaks from "remark-breaks";

// Raw HTML in the source is NOT rendered (no rehype-raw), so notes/specs
// written by users or agents can't inject markup — react-markdown escapes it.
const COMPONENTS: Components = {
  h1: ({ children }) => (
    <h1 className="mt-3 mb-1.5 text-sm font-semibold text-foreground first:mt-0">{children}</h1>
  ),
  h2: ({ children }) => (
    <h2 className="mt-3 mb-1.5 text-[13px] font-semibold text-foreground first:mt-0">{children}</h2>
  ),
  h3: ({ children }) => (
    <h3 className="mt-2.5 mb-1 text-xs font-semibold text-foreground/90 first:mt-0">{children}</h3>
  ),
  h4: ({ children }) => (
    <h4 className="mt-2 mb-1 text-xs font-semibold text-foreground/80 first:mt-0">{children}</h4>
  ),
  p: ({ children }) => <p className="my-1.5 first:mt-0 last:mb-0">{children}</p>,
  a: ({ href, children }) => (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      className="text-primary underline underline-offset-2 hover:text-primary/80"
    >
      {children}
    </a>
  ),
  strong: ({ children }) => <strong className="font-semibold text-foreground/90">{children}</strong>,
  ul: ({ children }) => <ul className="my-1.5 list-disc space-y-0.5 pl-4">{children}</ul>,
  ol: ({ children }) => <ol className="my-1.5 list-decimal space-y-0.5 pl-4">{children}</ol>,
  li: ({ children }) => <li className="[&>ul]:my-0.5 [&>ol]:my-0.5">{children}</li>,
  blockquote: ({ children }) => (
    <blockquote className="my-1.5 border-l-2 border-border pl-3 text-muted-foreground/80">
      {children}
    </blockquote>
  ),
  hr: () => <hr className="my-2 border-border" />,
  pre: ({ children }) => (
    <pre className="my-1.5 overflow-x-auto rounded bg-background/60 p-2 font-mono text-[11px] [&>code]:bg-transparent [&>code]:p-0">
      {children}
    </pre>
  ),
  code: ({ children }) => (
    <code className="rounded bg-background/60 px-1 py-0.5 font-mono text-[11px]">{children}</code>
  ),
  table: ({ children }) => (
    <div className="my-1.5 overflow-x-auto">
      <table className="w-full border-collapse text-left">{children}</table>
    </div>
  ),
  th: ({ children }) => (
    <th className="border border-border px-2 py-1 font-semibold text-foreground/80">{children}</th>
  ),
  td: ({ children }) => <td className="border border-border px-2 py-1">{children}</td>,
  input: ({ checked, type }) =>
    type === "checkbox" ? (
      <input type="checkbox" checked={checked} disabled className="mr-1 align-middle accent-primary" />
    ) : null,
};

export function Markdown({
  children,
  className = "",
}: {
  children: string;
  className?: string;
}): React.JSX.Element {
  return (
    <div className={`break-words ${className}`}>
      {/* remark-breaks keeps single newlines as line breaks — appended notes rely on them */}
      <ReactMarkdown remarkPlugins={[remarkGfm, remarkBreaks]} components={COMPONENTS}>
        {children}
      </ReactMarkdown>
    </div>
  );
}
