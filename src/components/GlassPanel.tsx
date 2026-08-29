import type { ReactNode } from "react";

/**
 * Liquid Glass surface — the core material of the uploaded design system
 * (root index.css). Wraps the glass tiers so surfaces stay consistent with
 * the prototype's GlassPanel (material = blur/opacity tier, specular
 * highlight border, ambient shadow).
 */
const MATERIALS = {
  ultrathin: "liquid-glass--ultrathin",
  thin: "liquid-glass--thin",
  regular: "liquid-glass",
  thick: "liquid-glass--thick",
  ultrathick: "liquid-glass--ultrathick",
} as const;

export default function GlassPanel({
  material = "regular",
  className = "",
  children,
}: {
  material?: keyof typeof MATERIALS;
  className?: string;
  children?: ReactNode;
}) {
  return <div className={`${MATERIALS[material]} ${className}`}>{children}</div>;
}
