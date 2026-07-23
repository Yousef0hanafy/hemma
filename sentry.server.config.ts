// =====================================================================
// Sentry Server Configuration — Node.js server error tracking
// =====================================================================
// This file configures Sentry for the Node.js server runtime.
// It is loaded by instrumentation.ts.
// =====================================================================

import * as Sentry from "@sentry/nextjs";

const dsn = process.env.SENTRY_DSN;

if (dsn) {
  Sentry.init({
    dsn,
    enabled: process.env.NODE_ENV === "production",
    // Performance tracing for server-side operations
    tracesSampleRate: 0.2,
    // Ignore 401/403 auth errors — they're not bugs
    ignoreErrors: [
      "Not authenticated",
      "Not authorized",
      "يجب تسجيل الدخول أولاً",
      "ليس لديك صلاحية",
    ],
    beforeSend(event) {
      // Never send environment variables or secrets
      if (event.extra) {
        delete event.extra.env;
        delete event.extra.secrets;
      }
      return event;
    },
  });
}
