// Integration test against a real Postgres with migrations applied.
// Runs only when TEST_DATABASE_URL is set (and is used as DATABASE_URL).
import { describe, it, expect, beforeAll, afterAll, vi } from "vitest";

const me = vi.hoisted(() => ({ id: "" }));
vi.mock("@/lib/auth-utils", () => ({ getUserBucket: async () => me.id }));
vi.mock("@/lib/auth", () => ({ requirePermission: async () => me.id }));

import { db } from "@/lib/db";
import { evaluateAchievements } from "./achievements";
import { fetchLeaderboard } from "./actions/leaderboard";
import { fetchQuestions } from "./actions/questions";
import { weekStartKey } from "@/lib/engine/gamification";

const run = `t${Date.now()}`;
const userIds = [`${run}-a`, `${run}-b`, `${run}-c`];

describe.skipIf(!process.env.TEST_DATABASE_URL)("batch 6 queries (Postgres)", () => {
  beforeAll(async () => {
    const source = await db.source.create({ data: { slug: `${run}-src`, title: "src" } });
    const category = await db.category.create({ data: { slug: `${run}-cat`, nameAr: `فئة ${run}` } });
    // an untouched category, so "mastered every category" stays locked
    await db.category.create({ data: { slug: `${run}-cat2`, nameAr: `فئة٢ ${run}` } });
    for (let i = 1; i <= 12; i++) {
      await db.question.create({
        data: {
          id: `${run}-q${i}`,
          sourceId: source.id,
          categoryId: category.id,
          sourceLocalId: i,
          type: "t",
          stem: `stem ${i}`,
          options: "[]",
          correctKey: "أ",
          status: i === 12 ? "review" : "published",
        },
      });
    }
    for (const [i, id] of userIds.entries()) {
      await db.user.create({ data: { id, email: `${id}@x.test` } });
      // a: high total XP, little this week; b: low total, big week; c: in between
      await db.userProfile.create({
        data: { userBucket: id, totalXp: [5000, 100, 300][i], currentStreak: [1, 4, 2][i] },
      });
      await db.dailyActivity.create({
        data: { userBucket: id, date: weekStartKey(), xpEarned: [10, 900, 50][i] },
      });
    }
    // user a: 10 correct + 1 fast answer in one category → first_correct, questions_? no, master_category yes
    for (let i = 1; i <= 11; i++) {
      await db.attempt.create({
        data: {
          userBucket: userIds[0],
          questionId: `${run}-q${i}`,
          selectedKey: "أ",
          isCorrect: true,
          mode: "study",
          timeMs: i === 1 ? 1500 : 20000,
        },
      });
    }
  });

  afterAll(async () => {
    await db.attempt.deleteMany({ where: { userBucket: { in: userIds } } });
    await db.dailyActivity.deleteMany({ where: { userBucket: { in: userIds } } });
    await db.userProfile.deleteMany({ where: { userBucket: { in: userIds } } });
    await db.user.deleteMany({ where: { id: { in: userIds } } });
    await db.question.deleteMany({ where: { id: { startsWith: run } } });
    await db.category.deleteMany({ where: { slug: { in: [`${run}-cat`, `${run}-cat2`] } } });
    await db.source.deleteMany({ where: { slug: `${run}-src` } });
    await db.$disconnect();
  });

  it("unlocks achievements once and pays their XP once", async () => {
    const first = await evaluateAchievements(userIds[0], { attempt: { isCorrect: true, timeMs: 1500 } });
    const slugs = first.map((a) => a.slug).sort();
    expect(slugs).toEqual(["first_correct", "lightning", "master_category", "speed_3s"]);

    const again = await evaluateAchievements(userIds[0], { attempt: { isCorrect: true, timeMs: 1500 } });
    expect(again).toEqual([]);

    const profile = await db.userProfile.findUnique({ where: { userBucket: userIds[0] } });
    expect(profile!.totalXp).toBe(5000 + 20 + 50 + 250 + 30);
  });

  it("ranks the weekly board by this week's XP, not the all-time top", async () => {
    me.id = userIds[2];
    const weekly = await fetchLeaderboard("weekly", 2);
    // b (900 this week, lowest total XP) leads; a (10 this week) is cut
    expect(weekly.entries.map((e) => e.weeklyXp)).toEqual([900, 50]);
    expect(weekly.entries[1].isMe).toBe(true);
  });

  it("reports the current user's rank when outside the top list", async () => {
    me.id = userIds[1]; // lowest total XP of the three
    const board = await fetchLeaderboard("xp", 1);
    expect(board.entries).toHaveLength(1);
    expect(board.currentUser?.isMe).toBe(true);
    // at least users a and c are ahead of b
    expect(board.currentUser!.rank).toBeGreaterThanOrEqual(3);
  });

  it("serves only published questions, unseen ones first", async () => {
    me.id = userIds[0]; // attempted q1..q11
    const qs = await fetchQuestions({ categorySlug: `${run}-cat` });
    expect(qs.map((q) => q.id)).not.toContain(`${run}-q12`); // in review
    expect(qs).toHaveLength(11);
  });
});
