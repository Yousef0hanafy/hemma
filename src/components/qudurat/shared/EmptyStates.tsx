"use client";

import { motion } from "framer-motion";
import { cn } from "@/lib/utils";
import { ArrowLeft } from "lucide-react";

// =====================================================================
// SVG Illustrations — inline, lightweight, themed
// =====================================================================

type IllustrationType =
  | "search"
  | "filter"
  | "exam"
  | "mistakes"
  | "favorites"
  | "flashcards"
  | "empty-box";

/** Inline SVG illustration picker. All are ~2-3KB, no external deps. */
function IllustrationSVG({ type, className }: { type: IllustrationType; className?: string }) {
  const svgClass = cn("w-32 h-32 sm:w-40 sm:h-40", className);
  const svgProps = { "aria-hidden": true as const, className: svgClass, viewBox: "0 0 160 160", fill: "none", xmlns: "http://www.w3.org/2000/svg" } as const;

  switch (type) {
    // ── Search / filter ─────────────────────────────────────────
    case "search":
    case "filter":
      return (
        <svg {...svgProps}>
          <circle cx="68" cy="68" r="32" stroke="var(--muted-foreground)" strokeWidth="3" opacity="0.3" />
          <circle cx="68" cy="68" r="22" stroke="var(--primary)" strokeWidth="2.5" opacity="0.5" />
          <circle cx="68" cy="68" r="12" stroke="var(--primary)" strokeWidth="2" opacity="0.4" />
          <line x1="90" y1="90" x2="112" y2="112" stroke="var(--muted-foreground)" strokeWidth="3" strokeLinecap="round" opacity="0.3" />
          <rect x="110" y="50" width="8" height="36" rx="3" fill="var(--primary)" opacity="0.2" />
          <rect x="120" y="58" width="8" height="28" rx="3" fill="var(--primary)" opacity="0.15" />
          <rect x="130" y="66" width="8" height="20" rx="3" fill="var(--primary)" opacity="0.1" />
          <circle cx="68" cy="68" r="46" stroke="var(--border)" strokeWidth="1.5" strokeDasharray="4 4" opacity="0.4" />
        </svg>
      );

    // ── Exam / no results ───────────────────────────────────────
    case "exam":
      return (
        <svg className={svgClass} viewBox="0 0 160 160" fill="none" xmlns="http://www.w3.org/2000/svg">
          <rect x="30" y="20" width="100" height="120" rx="10" stroke="var(--muted-foreground)" strokeWidth="2.5" opacity="0.2" />
          <rect x="38" y="32" width="84" height="96" rx="6" fill="var(--card)" stroke="var(--border)" strokeWidth="1.5" />
          <line x1="50" y1="60" x2="110" y2="60" stroke="var(--muted-foreground)" strokeWidth="2" strokeLinecap="round" opacity="0.3" />
          <line x1="50" y1="75" x2="95" y2="75" stroke="var(--muted-foreground)" strokeWidth="2" strokeLinecap="round" opacity="0.2" />
          <line x1="50" y1="90" x2="80" y2="90" stroke="var(--muted-foreground)" strokeWidth="2" strokeLinecap="round" opacity="0.15" />
          <circle cx="120" cy="40" r="14" fill="var(--primary)" opacity="0.15" />
          <circle cx="120" cy="40" r="8" stroke="var(--primary)" strokeWidth="2" opacity="0.3" />
          <path d="M117 40H123M120 37V43" stroke="var(--primary)" strokeWidth="2" strokeLinecap="round" opacity="0.5" />
          <motion.path
            d="M50 115 L65 100 L80 110 L95 90 L110 105"
            stroke="var(--primary)"
            strokeWidth="2.5"
            strokeLinecap="round"
            strokeLinejoin="round"
            opacity="0.4"
            initial={{ pathLength: 0 }}
            animate={{ pathLength: 1 }}
            transition={{ duration: 1.5, ease: "easeInOut" }}
          />
        </svg>
      );

    // ── Mistakes (sprout / empty garden) ────────────────────────
    case "mistakes":
      return (
        <svg className={svgClass} viewBox="0 0 160 160" fill="none" xmlns="http://www.w3.org/2000/svg">
          <rect x="60" y="100" width="40" height="45" rx="4" fill="var(--muted)" opacity="0.3" />
          <path d="M80 100 L80 65" stroke="var(--muted-foreground)" strokeWidth="3" strokeLinecap="round" opacity="0.25" />
          <motion.path
            d="M80 65 C65 58, 55 50, 55 40 C55 32, 62 28, 68 32 C72 35, 76 42, 80 50"
            stroke="#10b981"
            strokeWidth="3"
            strokeLinecap="round"
            strokeLinejoin="round"
            opacity="0.6"
            initial={{ pathLength: 0 }}
            animate={{ pathLength: 1 }}
            transition={{ duration: 1.2, ease: "easeOut" }}
          />
          <motion.path
            d="M80 65 C90 58, 100 50, 100 42 C100 35, 95 30, 90 33 C86 36, 82 44, 80 50"
            stroke="#10b981"
            strokeWidth="3"
            strokeLinecap="round"
            strokeLinejoin="round"
            opacity="0.45"
            initial={{ pathLength: 0 }}
            animate={{ pathLength: 1 }}
            transition={{ duration: 1.2, ease: "easeOut", delay: 0.3 }}
          />
          <circle cx="55" cy="38" r="3" fill="#10b981" opacity="0.4" />
          <circle cx="100" cy="40" r="2.5" fill="#10b981" opacity="0.3" />
          <circle cx="80" cy="58" r="2" fill="#f59e0b" opacity="0.5" />
        </svg>
      );

    // ── Favorites (empty bookmark) ──────────────────────────────
    case "favorites":
      return (
        <svg className={svgClass} viewBox="0 0 160 160" fill="none" xmlns="http://www.w3.org/2000/svg">
          <path
            d="M55 35H105V125L80 105L55 125V35Z"
            stroke="var(--muted-foreground)"
            strokeWidth="2.5"
            strokeLinejoin="round"
            opacity="0.2"
          />
          <path
            d="M60 42H100V118L80 100L60 118V42Z"
            fill="var(--card)"
            stroke="var(--border)"
            strokeWidth="2"
            strokeLinejoin="round"
          />
          <motion.path
            d="M80 58C80 58, 75 50, 68 54C63 57, 65 64, 70 68L80 76L90 68C95 64, 97 57, 92 54C85 50, 80 58, 80 58Z"
            stroke="var(--primary)"
            strokeWidth="2"
            strokeLinejoin="round"
            opacity="0.4"
            initial={{ scale: 0 }}
            animate={{ scale: 1 }}
            transition={{ duration: 0.5, ease: "easeOut", delay: 0.3 }}
          />
          <circle cx="80" cy="68" r="2" fill="var(--primary)" opacity="0.3" />
        </svg>
      );

    // ── Flashcards (cards stack) ────────────────────────────────
    case "flashcards":
      return (
        <svg className={svgClass} viewBox="0 0 160 160" fill="none" xmlns="http://www.w3.org/2000/svg">
          <rect x="28" y="50" width="104" height="72" rx="8" fill="var(--card)" stroke="var(--border)" strokeWidth="2" />
          <rect x="36" y="50" width="104" height="72" rx="8" fill="var(--card)" stroke="var(--border)" strokeWidth="2" />
          <rect x="44" y="50" width="104" height="72" rx="8" fill="var(--card)" stroke="var(--primary)" strokeWidth="2" opacity="0.6" />
          <line x1="64" y1="78" x2="120" y2="78" stroke="var(--muted-foreground)" strokeWidth="2.5" strokeLinecap="round" opacity="0.2" />
          <line x1="64" y1="92" x2="100" y2="92" stroke="var(--muted-foreground)" strokeWidth="2.5" strokeLinecap="round" opacity="0.15" />
          <line x1="64" y1="106" x2="85" y2="106" stroke="var(--muted-foreground)" strokeWidth="2.5" strokeLinecap="round" opacity="0.1" />
          <circle cx="136" cy="56" r="12" fill="#8b5cf6" opacity="0.12" />
          <path d="M132 56H140M136 52V60" stroke="#8b5cf6" strokeWidth="2" strokeLinecap="round" opacity="0.4" />
        </svg>
      );

    // ── Empty box (generic) ─────────────────────────────────────
    case "empty-box":
      return (
        <svg className={svgClass} viewBox="0 0 160 160" fill="none" xmlns="http://www.w3.org/2000/svg">
          <rect x="28" y="40" width="104" height="85" rx="8" stroke="var(--muted-foreground)" strokeWidth="2.5" opacity="0.2" />
          <rect x="34" y="46" width="92" height="73" rx="5" fill="var(--card)" stroke="var(--border)" strokeWidth="1.5" />
          <circle cx="80" cy="78" r="16" stroke="var(--muted-foreground)" strokeWidth="2" opacity="0.25" />
          <line x1="72" y1="78" x2="88" y2="78" stroke="var(--muted-foreground)" strokeWidth="2" strokeLinecap="round" opacity="0.2" />
          <line x1="80" y1="70" x2="80" y2="86" stroke="var(--muted-foreground)" strokeWidth="2" strokeLinecap="round" opacity="0.2" />
          <rect x="42" y="96" width="76" height="2" rx="1" fill="var(--muted-foreground)" opacity="0.08" />
        </svg>
      );
  }
}

// =====================================================================
// Suggestion chips
// =====================================================================

export interface SuggestionAction {
  label: string;
  onClick: () => void;
  variant?: "primary" | "secondary";
}

// =====================================================================
// Enhanced Empty State Card
// =====================================================================

interface EmptyStateCardProps {
  /** The type of illustration to show */
  illustration: IllustrationType;
  /** Arabic title */
  title: string;
  /** Arabic description */
  description: string;
  /** Optional list of suggestion chips shown below the description */
  suggestions?: SuggestionAction[];
  /** Optional: if true, shows smaller variant for in-section use */
  compact?: boolean;
}

/**
 * Enhanced empty state with inline SVG illustration, contextual description,
 * and actionable suggestion chips.
 */
export function EmptyStateCard({
  illustration,
  title,
  description,
  suggestions,
  compact,
}: EmptyStateCardProps) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      className={cn(
        "flex flex-col items-center justify-center text-center",
        compact ? "py-8" : "py-12 sm:py-16"
      )}
    >
      {/* Illustration */}
      <motion.div
        initial={{ scale: 0.8, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        transition={{ duration: 0.4, ease: "easeOut" }}
      >
        <IllustrationSVG type={illustration} />
      </motion.div>

      {/* Text */}
      <div className={cn("max-w-md", compact ? "mt-4" : "mt-6")}>
        <h3 className={cn(
          "font-display font-bold mb-2",
          compact ? "text-lg" : "text-xl sm:text-2xl"
        )}>
          {title}
        </h3>
        <p className="text-sm text-muted-foreground leading-relaxed">
          {description}
        </p>
      </div>

      {/* Suggestion chips */}
      {suggestions && suggestions.length > 0 && (
        <div className="flex flex-wrap justify-center gap-2 mt-5">
          {suggestions.map((s, i) => (
            <motion.button
              key={i}
              initial={{ opacity: 0, y: 4 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.3 + i * 0.08 }}
              onClick={s.onClick}
              className={cn(
                "inline-flex items-center gap-1.5 rounded-full px-4 py-2 text-xs font-semibold transition-all hover:scale-105 active:scale-95",
                s.variant === "primary" || !s.variant
                  ? "bg-primary text-primary-foreground hover:bg-primary/90 shadow-sm"
                  : "bg-card border border-border text-foreground hover:bg-muted"
              )}
            >
              <span>{s.label}</span>
              {(s.variant === "primary" || !s.variant) && (
                <ArrowLeft className="h-3 w-3" />
              )}
            </motion.button>
          ))}
        </div>
      )}
    </motion.div>
  );
}
