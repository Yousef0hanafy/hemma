// =====================================================================
// Rate limiting backed by Postgres (rate_limit_buckets).
// Vercel runs many short-lived instances, so counters must live in shared
// storage — an in-memory Map is per-instance and effectively no limit.
// Fixed window: one atomic upsert per check.
// =====================================================================

import { db } from "@/lib/db";

export interface RateLimitRule {
  /** Key prefix, also used in logs */
  name: string;
  /** Max requests per window */
  max: number;
  windowMs: number;
}

export const RATE_LIMITS = {
  /** Password attempts per email address */
  loginPerEmail: { name: "login-email", max: 10, windowMs: 15 * 60_000 },
  /** Password attempts per client IP (many emails from one IP) */
  loginPerIp: { name: "login-ip", max: 30, windowMs: 15 * 60_000 },
  /** New accounts per client IP */
  signupPerIp: { name: "signup-ip", max: 5, windowMs: 60 * 60_000 },
  /** AI chat messages per user */
  aiPerUser: { name: "ai-user", max: 20, windowMs: 60_000 },
} satisfies Record<string, RateLimitRule>;

export interface RateLimitResult {
  success: boolean;
  limit: number;
  remaining: number;
  resetTime: number;
}

/**
 * Count one request against `rule` for `identifier`.
 * Fails open (allows the request) if the database is unreachable, so a DB
 * hiccup degrades to "no limit" instead of locking everyone out.
 */
export async function consumeRateLimit(
  rule: RateLimitRule,
  identifier: string
): Promise<RateLimitResult> {
  const key = `${rule.name}:${identifier}`.slice(0, 256);
  try {
    // resetAt is stored as UTC (timestamp without time zone), like Prisma does.
    const rows = await db.$queryRaw<{ count: number; resetAt: Date }[]>`
      INSERT INTO "rate_limit_buckets" ("key", "count", "resetAt")
      VALUES (${key}, 1, (NOW() AT TIME ZONE 'UTC') + ${rule.windowMs} * INTERVAL '1 millisecond')
      ON CONFLICT ("key") DO UPDATE SET
        "count" = CASE WHEN "rate_limit_buckets"."resetAt" <= (NOW() AT TIME ZONE 'UTC')
                       THEN 1 ELSE "rate_limit_buckets"."count" + 1 END,
        "resetAt" = CASE WHEN "rate_limit_buckets"."resetAt" <= (NOW() AT TIME ZONE 'UTC')
                         THEN EXCLUDED."resetAt" ELSE "rate_limit_buckets"."resetAt" END
      RETURNING "count", "resetAt"`;
    const { count, resetAt } = rows[0];

    // Occasionally purge expired buckets so the table stays small
    if (Math.random() < 0.01) {
      db.rateLimitBucket
        .deleteMany({ where: { resetAt: { lt: new Date() } } })
        .catch(() => {});
    }

    if (count > rule.max) {
      console.warn(`[RateLimiter] ${rule.name} limit exceeded for ${identifier}`);
    }
    return {
      success: count <= rule.max,
      limit: rule.max,
      remaining: Math.max(0, rule.max - count),
      resetTime: resetAt.getTime(),
    };
  } catch (error) {
    console.error("[RateLimiter] check failed, allowing request:", error);
    return { success: true, limit: rule.max, remaining: rule.max, resetTime: Date.now() + rule.windowMs };
  }
}

/**
 * Validates an IP address format
 */
function isValidIP(ip: string): boolean {
  // IPv4 validation
  const ipv4Regex = /^(\d{1,3}\.){3}\d{1,3}$/;
  if (ipv4Regex.test(ip)) {
    const parts = ip.split('.');
    return parts.every(part => parseInt(part, 10) <= 255);
  }
  
  // IPv6 validation (simplified)
  const ipv6Regex = /^([0-9a-fA-F]{0,4}:){2,7}[0-9a-fA-F]{0,4}$/;
  if (ipv6Regex.test(ip)) {
    return true;
  }
  
  return false;
}

/** Client IP from a plain header map (e.g. NextAuth's authorize `req.headers`). */
export function clientIpFromHeaders(
  headers: Record<string, string | string[] | undefined> | undefined
): string {
  const get = (name: string) => {
    const v = headers?.[name];
    return Array.isArray(v) ? v[0] : v;
  };
  const raw =
    get("x-vercel-forwarded-for")?.split(",")[0]?.trim() ||
    get("x-real-ip")?.trim() ||
    get("x-forwarded-for")?.split(",")[0]?.trim() ||
    "unknown";
  return isValidIP(raw) ? raw : "unknown";
}

// Rate limit response helper
export function rateLimitResponse(result: RateLimitResult) {
  if (!result.success) {
    return new Response(
      JSON.stringify({
        error: "تم تجاوز الحد الأقصى للطلبات. يرجى المحاولة مرة أخرى لاحقاً.",
      }),
      {
        status: 429,
        headers: {
          "Content-Type": "application/json",
          "X-RateLimit-Limit": String(result.limit),
          "X-RateLimit-Remaining": "0",
          "X-RateLimit-Reset": new Date(result.resetTime).toUTCString(),
          "Retry-After": Math.max(1, Math.ceil((result.resetTime - Date.now()) / 1000)).toString(),
        },
      }
    );
  }

  return null;
}
