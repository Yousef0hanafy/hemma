// =====================================================================
// Sentry Client Configuration — browser-side error tracking
// =====================================================================
// This file configures Sentry for the browser runtime.
// It is loaded automatically by @sentry/nextjs when the SDK is installed.
// =====================================================================

import * as Sentry from "@sentry/nextjs";

// Only NEXT_PUBLIC_* env vars are available in the browser.
// Sentry's SDK resolves the DSN from the build-time config, so
// we use the public var only — or let Sentry use its own config.
const dsn = process.env.NEXT_PUBLIC_SENTRY_DSN;

if (dsn) {
  Sentry.init({
    dsn,
    // Only send errors in production to avoid noise during development
    enabled: process.env.NODE_ENV === "production",
    // Performance tracing — sample rate for browser transactions
    tracesSampleRate: 0.1,
    // Session replays — sample rate for recording user sessions
    replaysSessionSampleRate: 0.05,
    replaysOnErrorSampleRate: 1.0,
    // Attach user feedback dialog for unhandled errors
    beforeSend(event) {
      // Sanitize: never send full URL query params that might contain tokens
      if (event.request?.url) {
        try {
          const url = new URL(event.request.url);
          url.search = "";
          event.request.url = url.toString();
        } catch {
          // Ignore malformed URLs
        }
      }
      return event;
    },
    integrations: [
      // Browser tracing for performance monitoring
      Sentry.browserTracingIntegration(),
      // Session replay to see what the user was doing before the error
      Sentry.replayIntegration({
        // Mask all text content for privacy — we're an educational platform
        maskAllText: true,
        blockAllMedia: true,
      }),
    ],
  });
}
