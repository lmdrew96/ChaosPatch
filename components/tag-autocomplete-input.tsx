"use client";

import { useRef, useState } from "react";

/**
 * Comma-separated tag input with a dynamic autocomplete dropdown. Suggests
 * existing tags that match the in-progress token (the text after the last
 * comma) and aren't already entered. Pick one or keep typing a new tag.
 *
 * Controlled via `value` / `onChange` so it drops into any form.
 */
export function TagAutocompleteInput({
  value,
  onChange,
  existingTags,
  placeholder,
  className,
  autoComplete = "off",
}: {
  value: string;
  onChange: (value: string) => void;
  existingTags: string[];
  placeholder?: string;
  className?: string;
  autoComplete?: string;
}) {
  const [focused, setFocused] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const parsedTags = value
    .split(",")
    .map((t) => t.trim())
    .filter((t) => t.length > 0);

  // The in-progress token is the text after the last comma.
  const lastComma = value.lastIndexOf(",");
  const currentToken = value.slice(lastComma + 1).trim().toLowerCase();
  const suggestions = existingTags.filter(
    (t) =>
      !parsedTags.some((p) => p.toLowerCase() === t.toLowerCase()) &&
      (currentToken === "" || t.toLowerCase().includes(currentToken))
  );
  const show = focused && suggestions.length > 0;

  function selectTag(tag: string) {
    // Drop the in-progress token, then append the chosen tag + a trailing
    // ", " so the user can keep typing or picking the next one.
    const base = lastComma >= 0 ? value.slice(0, lastComma + 1) : "";
    const committed = base
      .split(",")
      .map((t) => t.trim())
      .filter((t) => t.length > 0);
    if (!committed.some((t) => t.toLowerCase() === tag.toLowerCase())) {
      committed.push(tag);
    }
    onChange(committed.join(", ") + ", ");
    inputRef.current?.focus();
  }

  return (
    <div className="relative">
      <input
        ref={inputRef}
        type="text"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        onFocus={() => setFocused(true)}
        onBlur={() => setFocused(false)}
        placeholder={placeholder}
        autoComplete={autoComplete}
        className={className}
      />
      {show && (
        <ul className="absolute z-10 mt-1 max-h-44 w-full overflow-y-auto rounded-md border border-border bg-card py-1 shadow-lg">
          {suggestions.map((t) => (
            <li key={t}>
              <button
                type="button"
                // Prevent input blur so focus + dropdown persist while picking.
                onMouseDown={(e) => {
                  e.preventDefault();
                  selectTag(t);
                }}
                className="flex w-full items-center gap-2 px-3 py-1.5 text-left text-sm text-muted-foreground transition-colors hover:bg-muted/50 hover:text-foreground"
              >
                <span className="text-[10px] font-medium uppercase tracking-wider text-primary">
                  #
                </span>
                {t}
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
