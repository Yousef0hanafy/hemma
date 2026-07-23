// =====================================================================
// Next.js Instrumentation — registers Sentry at app startup
// =====================================================================
// This file is automatically called by Next.js on the server side.
// It registers the appropriate Sentry config for each runtime.
// =====================================================================

import * as Sentry from "@sentry/nextjs";

export async function register() {
  if (process.env.NEXT_RUNTIME === "nodejs") {
    // Only import server config if we have a DSN configured
    if (process.env.SENTRY_DSN) {
      await import("../sentry.server.config");
    }
  }
  if (process.env.NEXT_RUNTIME === "edge") {
    if (process.env.SENTRY_DSN) {
      await import("../sentry.edge.config");
    }
  }
}

/**
 * Captures unhandled request errors (Next.js 15+).
 * Automatically called by the framework on unhandled server errors.
 */
export const onRequestError = Sentry.captureRequestError;
