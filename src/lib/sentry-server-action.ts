// =====================================================================
// Sentry Server Action Instrumentation
// =====================================================================
// Utility functions for wrapping server actions with Sentry error tracking.
// Provides structured error reporting with context about which action failed.
// =====================================================================

import * as Sentry from "@sentry/nextjs";

/**
 * Wraps a server action with Sentry error instrumentation.
 *
 * Usage:
 * ```ts
 * export const fetchData = withSentryAction("fetchData", async () => {
 *   // your action logic
 * });
 * ```
 *
 * The wrapper:
 * - Captures any thrown error to Sentry with action name as a tag
 * - Re-throws so the client can still handle the error
 * - Returns the result on success
 */
export function withSentryAction<TArgs extends unknown[], TResult>(
  actionName: string,
  fn: (...args: TArgs) => Promise<TResult>
): (...args: TArgs) => Promise<TResult> {
  return async (...args: TArgs): Promise<TResult> => {
    try {
      return await fn(...args);
    } catch (error) {
      // Report to Sentry with structured context
      Sentry.captureException(error, {
        tags: {
          action: actionName,
          type: "server-action",
        },
        extra: {
          actionName,
          args: sanitizeArgs(args),
        },
      });
      // Re-throw so the caller can still handle it
      throw error;
    }
  };
}

/**
 * Reports a handled error to Sentry without re-throwing.
 * Use this for expected/non-fatal errors that you've handled gracefully.
 */
export function reportError(
  error: unknown,
  context?: Record<string, unknown>
): void {
  Sentry.captureException(error, {
    extra: context,
  });
}

/**
 * Sets the current user context for Sentry.
 * Call this from authenticated server actions to associate errors with users.
 */
export function setSentryUser(userId: string, email?: string): void {
  Sentry.setUser({
    id: userId,
    email,
  });
}

/**
 * Creates a new Sentry transaction for performance tracing.
 * Use this for long-running operations like import processing.
 */
export function startSentryTransaction(
  name: string,
  op: string
): { finish: () => void } | null {
  if (!process.env.SENTRY_DSN) return null;

  const transaction = Sentry.startTransaction({ name, op });
  Sentry.getCurrentScope().setSpan(transaction);

  return {
    finish: () => {
      transaction.end();
    },
  };
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Sanitize args for logging — strip large objects and sensitive data. */
function sanitizeArgs(args: unknown[]): unknown[] {
  return args.map((arg) => {
    if (typeof arg === "string" && arg.length > 200) {
      return arg.slice(0, 200) + "...";
    }
    if (arg instanceof File) {
      return `[File: ${arg.name}, ${arg.size} bytes]`;
    }
    if (typeof arg === "object" && arg !== null) {
      try {
        const str = JSON.stringify(arg);
        if (str.length > 500) {
          return JSON.parse(str.slice(0, 500) + '"}');
        }
      } catch {
        return "[Unserializable]";
      }
    }
    return arg;
  });
}
