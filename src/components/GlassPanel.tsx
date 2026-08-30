import type { CSSProperties, ReactNode } from "react";

/**
 * Liquid Glass surface — the core material of the Neo-Apple design system
 * (Master Build Prompt Part 6.2/6.3/6.11). Wraps the five glass tiers so every
 * surface stays consistent: blur + saturation, a specular highlight from above
 * and an ambient shadow below, plus an optional signal-color glow bloom.
 *
 * Every panel in the app composes GlassPanel — never hand-rolled backdrop-blur.
 */
const MATERIALS = {
  ultrathin: "liquid-glass--ultrathin",
  thin: "liquid-glass--thin",
  regular: "liquid-glass",
  thick: "liquid-glass--thick",
  ultrathick: "liquid-glass--ultrathick",
} as const;

export type GlassMaterial = keyof typeof MATERIALS;

/** Signal colors are light sources, not paint (Part 6.5) — glow, never fill. */
const GLOWS = {
  none: "",
  cyan: "glow-cyan",
  crimson: "glow-crimson",
  gold: "glow-gold",
  yellow: "glow-yellow", // warnL1
  orange: "glow-orange", // warnL2
  green: "glow-green",
} as const;

export type GlassGlow = keyof typeof GLOWS;

export default function GlassPanel({
  material = "regular",
  glow = "none",
  className = "",
  style,
  children,
}: {
  material?: GlassMaterial;
  /** Signal-color bloom (Part 6.3/6.5). `yellow` = warnL1, `orange` = warnL2. */
  glow?: GlassGlow;
  className?: string;
  style?: CSSProperties;
  children?: ReactNode;
}) {
  const classes = [MATERIALS[material], GLOWS[glow], className].filter(Boolean).join(" ");
  return (
    <div className={classes} style={style}>
      {children}
    </div>
  );
}
