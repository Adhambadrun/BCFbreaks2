"use client";

import { useEffect, useState } from "react";

/**
 * Accessibility hook (Master Build Prompt Part 6.12): reports whether the user
 * has requested reduced transparency. GlassPanel (and any surface that renders
 * raw glass) reads this to swap in the solid dark fallback — components never
 * need their own reduced-transparency branch.
 *
 * Pairs with Framer Motion's `useReducedMotion()` for the motion half of the
 * accessibility contract.
 */
export function useReducedTransparency(): boolean {
  const [reduced, setReduced] = useState(false);

  useEffect(() => {
    const mq = window.matchMedia("(prefers-reduced-transparency: reduce)");
    setReduced(mq.matches);
    const listener = (e: MediaQueryListEvent) => setReduced(e.matches);
    mq.addEventListener("change", listener);
    return () => mq.removeEventListener("change", listener);
  }, []);

  return reduced;
}
