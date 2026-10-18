// Integration test against a real Postgres with migrations applied.
// Runs only when TEST_DATABASE_URL is set (and is used as DATABASE_URL):
//   TEST_DATABASE_URL=postgres://... DATABASE_URL=$TEST_DATABASE_URL pnpm test
import { describe, it, expect, afterAll } from "vitest";
import { consumeRateLimit, type RateLimitResult } from "./rate-limiter";
import { db } from "./db";

describe.skipIf(!process.env.TEST_DATABASE_URL)("consumeRateLimit (Postgres)", () => {
  const rule = { name: `test-${Date.now()}`, max: 3, windowMs: 1_000 };

  afterAll(async () => {
    await db.rateLimitBucket.deleteMany({ where: { key: { startsWith: rule.name } } });
    await db.$disconnect();
  });

  it("allows up to max requests, then blocks", async () => {
    const results: RateLimitResult[] = [];
    for (let i = 0; i < 5; i++) results.push(await consumeRateLimit(rule, "a"));
    expect(results.map((r) => r.success)).toEqual([true, true, true, false, false]);
    expect(results[0].remaining).toBe(2);
  });

  it("counts concurrent requests atomically", async () => {
    const results = await Promise.all(
      Array.from({ length: 10 }, () => consumeRateLimit(rule, "b"))
    );
    expect(results.filter((r) => r.success)).toHaveLength(3);
  });

  it("keeps identifiers separate", async () => {
    expect((await consumeRateLimit(rule, "c")).success).toBe(true);
  });

  it("resets after the window", async () => {
    await new Promise((r) => setTimeout(r, 1_100));
    expect((await consumeRateLimit(rule, "a")).success).toBe(true);
  });
});
