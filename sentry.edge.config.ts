// =====================================================================
// Sentry Edge Configuration — Edge Runtime error tracking
// =====================================================================
// This file configures Sentry for the Edge Runtime (middleware, edge API routes).
// It is loaded by instrumentation.ts.
// =====================================================================

import * as Sentry from "@sentry/nextjs";

const dsn = process.env.SENTRY_DSN;

if (dsn) {
  Sentry.init({
    dsn,
    enabled: process.env.NODE_ENV === "production",
    // Edge runtime has limited tracing capabilities
    tracesSampleRate: 0.1,
  });
}
