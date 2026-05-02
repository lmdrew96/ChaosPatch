"use client";

import { useId, useState, useEffect } from "react";
import { PRESET_COLORS } from "@/lib/colors";

const HEX_RE = /^#[0-9a-fA-F]{6}$/;

function normalize(hex: string): string {
  return hex.startsWith("#") ? hex : `#${hex}`;
}

export function ColorPicker({
  value,
  onChange,
}: {
  value: string;
  onChange: (color: string) => void;
}) {
  const pickerId = useId();
  const [hexInput, setHexInput] = useState(value);

  useEffect(() => {
    setHexInput(value);
  }, [value]);

  function commitHex(raw: string) {
    const next = normalize(raw.trim()).toLowerCase();
    if (HEX_RE.test(next)) {
      onChange(next);
    } else {
      setHexInput(value);
    }
  }

  return (
    <div className="space-y-2.5">
      <div className="flex flex-wrap gap-2">
        {PRESET_COLORS.map((c) => (
          <button
            key={c}
            type="button"
            onClick={() => onChange(c)}
            className="w-6 h-6 rounded-full transition-transform hover:scale-110 focus:outline-none"
            style={{
              backgroundColor: c,
              boxShadow:
                value.toLowerCase() === c.toLowerCase()
                  ? `0 0 0 2px var(--card), 0 0 0 4px ${c}`
                  : undefined,
            }}
            title={c}
          />
        ))}
        <label
          htmlFor={pickerId}
          className="relative w-6 h-6 rounded-full cursor-pointer flex items-center justify-center border border-border bg-card hover:border-muted-foreground/40 transition-colors overflow-hidden"
          title="Custom color"
          style={{
            background:
              "conic-gradient(from 0deg, #ef4444, #eab308, #22c55e, #06b6d4, #3b82f6, #8b5cf6, #ec4899, #ef4444)",
          }}
        >
          <span className="absolute inset-1 rounded-full bg-card flex items-center justify-center text-[10px] font-bold text-foreground">
            +
          </span>
          <input
            id={pickerId}
            type="color"
            value={value}
            onChange={(e) => onChange(e.target.value)}
            className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
          />
        </label>
      </div>
      <div className="flex items-center gap-2">
        <span
          className="w-4 h-4 rounded border border-border shrink-0"
          style={{ backgroundColor: value }}
        />
        <input
          type="text"
          value={hexInput}
          onChange={(e) => setHexInput(e.target.value)}
          onBlur={(e) => commitHex(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              commitHex(e.currentTarget.value);
            }
          }}
          placeholder="#1e1830"
          className="w-28 rounded-md border border-border bg-input px-2 py-1 text-xs font-mono text-foreground placeholder:text-muted-foreground/40 focus:outline-none focus:ring-1 focus:ring-ring uppercase"
          maxLength={7}
        />
      </div>
    </div>
  );
}
