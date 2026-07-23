"use client";

import { useTheme } from "next-themes";
import { useEffect, useState } from "react";
import { Sun, Moon, Monitor } from "lucide-react";
import { cn } from "@/lib/utils";

export function ThemeToggle() {
  const { theme, setTheme } = useTheme();
  const [mounted, setMounted] = useState(false);

  // Avoid hydration mismatch — icons only render client-side
  useEffect(() => setMounted(true), []);

  if (!mounted) {
    return (
      <div className="h-8 w-8 rounded-full border border-border bg-card" />
    );
  }

  const next =
    theme === "light" ? "dark" : theme === "dark" ? "system" : "light";

  return (
    <button
      onClick={() => setTheme(next)}
      className={cn(
        "flex items-center gap-1.5 rounded-full px-2.5 py-1.5 text-xs font-semibold border transition-colors",
        "bg-card border-border hover:bg-muted"
      )}
      aria-label={`الوضع الحالي: ${
        theme === "light" ? "فاتح" : theme === "dark" ? "داكن" : "تلقائي"
      }`}
    >
      {theme === "light" ? (
        <Sun className="h-3.5 w-3.5 text-amber-500" />
      ) : theme === "dark" ? (
        <Moon className="h-3.5 w-3.5 text-indigo-400" />
      ) : (
        <Monitor className="h-3.5 w-3.5 text-muted-foreground" />
      )}
      <span className="hidden sm:inline">
        {theme === "light"
          ? "فاتح"
          : theme === "dark"
          ? "داكن"
          : "تلقائي"}
      </span>
    </button>
  );
}
