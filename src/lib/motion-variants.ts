// =====================================================================
// Shared Animation Variants — Framer Motion spring physics
//
// Use these variants throughout the app for consistent, natural-feeling
// animations. Framer Motion's spring physics (stiffness × damping × mass)
// produce far more organic motion than CSS cubic-bezier easings.
//
// Spring physics mental model:
//   stiffness  = how "tight" the spring is (higher = snappier)
//   damping    = how quickly oscillations settle (higher = less bounce)
//   mass       = how heavy the element feels (higher = slower)
//
// Sane defaults for UI animations:
//   entrances: stiffness: 120, damping: 20  — gentle settle without overshoot
//   hover:     stiffness: 300, damping: 15  — fast micro-interaction
//   press:     stiffness: 400, damping: 10  — instant tactile feedback
// =====================================================================

import type { Transition, Variants } from "framer-motion";

// ── Transition configs ───────────────────────────────────────────

/** Standard spring for section entrances — gentle, professional */
export const springEntrance: Transition = {
  type: "spring",
  stiffness: 120,
  damping: 20,
};

/** Faster spring for staggered children — subtle stagger */
export const springStagger: Transition = {
  type: "spring",
  stiffness: 100,
  damping: 22,
};

/** Snappy spring for hover micro-interactions */
export const springHover: Transition = {
  type: "spring",
  stiffness: 300,
  damping: 15,
  mass: 0.8,
};

/** Instant spring for tap/press feedback */
export const springTap: Transition = {
  type: "spring",
  stiffness: 400,
  damping: 10,
};

/** Bouncy spring for celebratory reveals (checkmarks, badges) */
export const springBounce: Transition = {
  type: "spring",
  stiffness: 200,
  damping: 12,
};

/** Progress bar fill — smooth but not bouncy */
export const springProgress: Transition = {
  type: "spring",
  stiffness: 80,
  damping: 25,
};

// ── Style-only variants (no transition — apply separately) ────────

/** Fade + slide up entrance */
export const fadeUp = {
  initial: { opacity: 0, y: 12 },
  animate: { opacity: 1, y: 0 },
};

/** Fade + slide up from larger offset */
export const fadeUpLarge = {
  initial: { opacity: 0, y: 24 },
  animate: { opacity: 1, y: 0 },
};

/** Scale + fade entrance (cards, modals) */
export const scaleIn = {
  initial: { opacity: 0, scale: 0.9 },
  animate: { opacity: 1, scale: 1 },
};

/** Slide in from the right */
export const slideRight = {
  initial: { opacity: 0, x: 12 },
  animate: { opacity: 1, x: 0 },
};

/** Slide in from the left */
export const slideLeft = {
  initial: { opacity: 0, x: -12 },
  animate: { opacity: 1, x: 0 },
};

// ── Hover / tap style-only variants ───────────────────────────────

/** Lift card on hover */
export const hoverLift = {
  whileHover: { y: -2 },
};

/** Stronger lift for featured cards */
export const hoverLiftStrong = {
  whileHover: { y: -4 },
};

/** Scale up on hover */
export const hoverScale = {
  whileHover: { scale: 1.02 },
};

/** Press feedback — subtle scale down */
export const tapScale = {
  whileTap: { scale: 0.98 },
};

// ── Staggered children variants ──────────────────────────────────

/** Container for staggered children — pass staggerChildren to transition */
export const staggerContainer: Variants = {
  initial: {},
  animate: {
    transition: {
      staggerChildren: 0.04,
    },
  },
};

/** Individual stagger item — pairs with staggerContainer */
export const staggerItem: Variants = {
  initial: { opacity: 0, y: 8 },
  animate: {
    opacity: 1,
    y: 0,
    transition: { type: "spring", stiffness: 100, damping: 22 },
  },
};

/** Faster stagger (for shorter lists) */
export const staggerFast: Variants = {
  initial: {},
  animate: {
    transition: {
      staggerChildren: 0.02,
    },
  },
};

/** Slower stagger (for longer, dramatic reveals) */
export const staggerSlow: Variants = {
  initial: {},
  animate: {
    transition: {
      staggerChildren: 0.08,
    },
  },
};
