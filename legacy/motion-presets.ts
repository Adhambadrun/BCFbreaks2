/**
 * Reusable motion presets for Neo-Apple Liquid Glass material system
 * Part 6.7 & Part 23 of prompt.md
 */

// SNAP (~150-220ms): tactile tap feedback, toggles, badge pops, hover states
export const SNAP = {
  type: "spring" as const,
  stiffness: 500,
  damping: 30,
  mass: 0.9,
};

// GLIDE (~350-450ms): modals, side panels, dropdowns, pod-flip settle
export const GLIDE = {
  type: "spring" as const,
  stiffness: 300,
  damping: 28,
  mass: 1,
};

// AMBIENT_LOOP: status-dot breathing, ember drift, capacity-bar liquid shimmer
export const AMBIENT_LOOP = {
  repeat: Infinity,
  repeatType: "mirror" as const,
  ease: "easeInOut",
  duration: 2,
};

// Documented exception for pod 3D coin flip (800ms controlled settle)
export const COIN_FLIP_TRANSITION = {
  duration: 0.8,
  ease: [0.19, 1, 0.22, 1],
};
