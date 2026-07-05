"use client";

import { motion } from "framer-motion";

const COLOR_HEX: Record<string, { stroke: string; track: string; text: string }> = {
  emerald: { stroke: "#059669", track: "#d1fae5", text: "#047857" },
  amber:   { stroke: "#d97706", track: "#fef3c7", text: "#b45309" },
  rose:    { stroke: "#e11d48", track: "#ffe4e6", text: "#be123c" },
  violet:  { stroke: "#7c3aed", track: "#ede9fe", text: "#6d28d9" },
  cyan:    { stroke: "#0891b2", track: "#cffafe", text: "#0e7490" },
  slate:   { stroke: "#475569", track: "#e2e8f0", text: "#334155" },
};

export function MasteryRing({
  value,
  color = "emerald",
  size = 80,
  stroke = 8,
}: {
  value: number; // 0..100
  color?: string;
  size?: number;
  stroke?: number;
}) {
  const clamped = Math.max(0, Math.min(100, value));
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  const offset = c - (clamped / 100) * c;
  const colors = COLOR_HEX[color] ?? COLOR_HEX.emerald;

  return (
    <div
      className="relative inline-flex items-center justify-center"
      style={{ width: size, height: size }}
    >
      <svg
        width={size}
        height={size}
        viewBox={`0 0 ${size} ${size}`}
        className="-rotate-90"
        style={{ transform: "rotate(-90deg)" }}
      >
        {/* Track */}
        <circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          fill="none"
          stroke={colors.track}
          strokeWidth={stroke}
        />
        {/* Progress */}
        <motion.circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          fill="none"
          stroke={colors.stroke}
          strokeWidth={stroke}
          strokeLinecap="round"
          strokeDasharray={c}
          initial={{ strokeDashoffset: c }}
          animate={{ strokeDashoffset: offset }}
          transition={{ duration: 1, ease: "easeOut" }}
        />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <span
          className="font-bold tabular-nums leading-none"
          style={{ fontSize: size * 0.22, color: colors.text }}
        >
          {Math.round(clamped)}٪
        </span>
      </div>
    </div>
  );
}
