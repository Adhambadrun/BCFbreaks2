/**
 * BCFbreaks motion system — the single source of truth for animation presets
 * (Master Build Prompt Part 6.7 & Part 23).
 *
 * Two spring presets for discrete state changes (something has a start and a
 * settled end), one eased loop for anything continuous, and one documented
 * exception (the pod coin-flip). Springs settle; loops don't — never force a
 * spring onto a breathing dot or drifting ember.
 *
 * Rule: no linear easing anywhere, no default ease-in-out picked out of habit.
 * Every transition is SNAP, GLIDE, AMBIENT_LOOP, or the documented flip
 * exception. When `prefers-reduced-motion` is set, Framer Motion's
 * `useReducedMotion()` should swap every preset for REDUCED (a plain 150ms
 * fade) — see Part 6.12.
 *
 * These objects are plain data and are consumed by Framer Motion's `transition`
 * / `animate` props.
 */

/** ~150–220ms — tap feedback, toggles, badge pops, hover states. */
export const SNAP = {
  type: "spring" as const,
  stiffness: 500,
  damping: 30,
  mass: 0.9,
};

/** ~350–450ms — modals, side panels, dropdowns, pod-flip settle. */
export const GLIDE = {
  type: "spring" as const,
  stiffness: 300,
  damping: 28,
  mass: 1,
};

/** Status-dot breathing, ember drift, capacity-bar liquid shimmer — never a spring. */
export const AMBIENT_LOOP = {
  repeat: Infinity,
  repeatType: "mirror" as const,
  ease: "easeInOut",
  duration: 2,
};

/**
 * Documented exception (Part 6.7 / 11): the pod's 3D coin-flip keeps a
 * controlled, no-overshoot cubic-bezier settle at 800ms rather than a spring —
 * a bounce reads worse for a flip than a crisp settle. (A touch of SNAP
 * overshoot is fine for the bonus-break flip specifically, which is meant to
 * feel celebratory.)
 */
export const COIN_FLIP_TRANSITION = {
  duration: 0.8,
  ease: [0.19, 1, 0.22, 1] as const,
};

/** prefers-reduced-motion fallback: every spring collapses to a 150ms fade. */
export const REDUCED = {
  duration: 0.15,
} as const;

export type MotionPreset = typeof SNAP | typeof GLIDE | typeof AMBIENT_LOOP | typeof REDUCED;
