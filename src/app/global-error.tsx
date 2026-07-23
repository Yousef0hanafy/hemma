"use client";

import * as Sentry from "@sentry/nextjs";
import { useEffect } from "react";
import { AlertTriangle, RefreshCw, Home } from "lucide-react";

// ---------------------------------------------------------------------------
// Global Error Boundary — last-resort fallback for root layout errors
// ---------------------------------------------------------------------------
// Next.js automatically uses this file when an error propagates past the
// root layout. It replaces the entire layout with this fallback UI.
// We manually report the error to Sentry because error boundaries swallow them.
// ---------------------------------------------------------------------------

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    // Report to Sentry — this is the only chance to capture it
    Sentry.captureException(error, {
      tags: {
        source: "global-error",
        digest: error.digest,
      },
    });
  }, [error]);

  // --- Inlined UI (avoids importing components that might also error) ---
  return (
    <html lang="ar" dir="rtl">
      <body className="bg-background text-foreground font-sans antialiased">
        <div
          className="flex flex-col items-center justify-center min-h-dvh gap-6 px-6 py-12 text-center"
          role="alert"
        >
          {/* Icon */}
          <div className="h-16 w-16 rounded-2xl bg-destructive/10 flex items-center justify-center">
            <AlertTriangle className="h-8 w-8 text-destructive" />
          </div>

          {/* Message */}
          <div className="space-y-2 max-w-md">
            <h1 className="text-2xl font-bold font-display">
              حدث خطأ غير متوقع
            </h1>
            <p className="text-muted-foreground text-sm leading-relaxed">
              عذراً، حدث خطأ أثناء تحميل التطبيق. 
              حاول إعادة التحميل أو ارجع لاحقًا.
            </p>
            {error.digest && (
              <p className="text-[10px] text-muted-foreground/60 font-mono">
                رمز الخطأ: {error.digest}
              </p>
            )}
          </div>

          {/* Actions */}
          <div className="flex items-center gap-3">
            <button
              onClick={() => reset()}
              className="inline-flex items-center gap-1.5 rounded-lg bg-primary text-primary-foreground px-5 py-2.5 text-sm font-semibold hover:bg-primary/90 active:scale-95 transition-all"
            >
              <RefreshCw className="h-4 w-4" />
              <span>إعادة المحاولة</span>
            </button>
            <button
              onClick={() => {
                if (typeof window !== "undefined") {
                  window.location.href = "/";
                }
              }}
              className="inline-flex items-center gap-1.5 rounded-lg border border-border bg-card px-5 py-2.5 text-sm font-semibold hover:bg-muted active:scale-95 transition-all"
            >
              <Home className="h-4 w-4" />
              <span>الصفحة الرئيسية</span>
            </button>
          </div>
        </div>
      </body>
    </html>
  );
}
