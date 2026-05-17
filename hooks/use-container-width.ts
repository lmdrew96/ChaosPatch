"use client";

import { useRef, useState, useEffect } from "react";

export function useContainerWidth(fallback = 600) {
  const ref = useRef<HTMLDivElement>(null);
  const [width, setWidth] = useState(fallback);

  useEffect(() => {
    if (!ref.current) return;
    const el = ref.current;
    setWidth(el.getBoundingClientRect().width || fallback);
    const obs = new ResizeObserver(([entry]) => {
      setWidth(entry.contentRect.width);
    });
    obs.observe(el);
    return () => obs.disconnect();
  }, [fallback]);

  return { ref, width };
}
