import { describe, it, expect, vi, beforeEach } from "vitest";

const db = vi.hoisted(() => ({
  question: { findUnique: vi.fn(), findMany: vi.fn() },
  attempt: { findFirst: vi.fn(), findMany: vi.fn(), create: vi.fn(), createMany: vi.fn() },
  reviewSchedule: { createMany: vi.fn() },
  dailyActivity: { upsert: vi.fn() },
  userProfile: { findUnique: vi.fn(), upsert: vi.fn(), update: vi.fn() },
  examSessionData: { findUnique: vi.fn(), count: vi.fn(), create: vi.fn() },
}));
vi.mock("@/lib/db", () => ({ db }));
vi.mock("@/lib/auth", () => ({ requirePermission: vi.fn(async () => "user-1") }));
vi.mock("@/server/achievements", () => ({ evaluateAchievements: vi.fn(async () => []) }));

import { recordAttempt, finalizeExamSession } from "./progress";

beforeEach(() => {
  vi.clearAllMocks();
  db.attempt.create.mockResolvedValue({ id: "att-1" });
  db.userProfile.findUnique.mockResolvedValue(null);
  db.userProfile.upsert.mockImplementation(async ({ create }) => ({ ...create }));
});

describe("recordAttempt", () => {
  it("grades on the server and ignores a client-supplied isCorrect", async () => {
    db.question.findUnique.mockResolvedValue({ correctKey: "ب", difficulty: "medium" });
    db.attempt.findFirst.mockResolvedValue(null);

    const res = await recordAttempt({
      questionId: "q1",
      selectedKey: "أ",
      mode: "study",
      isCorrect: true, // forged by a client
    } as Parameters<typeof recordAttempt>[0]);

    expect(res.isCorrect).toBe(false);
    expect(res.xpEarned).toBe(2);
    expect(db.attempt.create.mock.calls[0][0].data.isCorrect).toBe(false);
  });

  it("awards difficulty-scaled XP for a correct first attempt", async () => {
    db.question.findUnique.mockResolvedValue({ correctKey: "أ", difficulty: "hard" });
    db.attempt.findFirst.mockResolvedValue(null);

    const res = await recordAttempt({ questionId: "q1", selectedKey: "أ", mode: "study" });
    expect(res.isCorrect).toBe(true);
    expect(res.xpEarned).toBe(15);
  });

  it("gives no XP for re-answering a question already answered today", async () => {
    db.question.findUnique.mockResolvedValue({ correctKey: "أ", difficulty: "medium" });
    db.attempt.findFirst.mockResolvedValue({ id: "earlier" });

    const res = await recordAttempt({ questionId: "q1", selectedKey: "أ", mode: "study" });
    expect(res.isCorrect).toBe(true);
    expect(res.xpEarned).toBe(0);
  });

  it("rejects an invalid answer key", async () => {
    await expect(
      recordAttempt({ questionId: "q1", selectedKey: "x", mode: "study" })
    ).rejects.toThrow();
  });
});

describe("finalizeExamSession", () => {
  const ids = ["q1", "q2", "q3", "q4", "q5"];

  beforeEach(() => {
    db.examSessionData.findUnique.mockResolvedValue(null);
    db.question.findMany.mockResolvedValue(
      ids.map((id) => ({ id, correctKey: "أ", difficulty: "medium" }))
    );
    db.attempt.findMany.mockResolvedValue([]);
  });

  it("grades from stored keys, records final answers, and awards the exam bonus", async () => {
    db.examSessionData.count.mockResolvedValue(0);
    const sel = Object.fromEntries(ids.map((id) => [id, "أ"]));
    sel.q5 = "ب"; // one wrong
    const res = await finalizeExamSession("s1", ids, sel, 300, { q1: 4000 });
    // 4 correct × 15 (medium, exam) + 1 wrong × 2 + bonus for 80% (50 + 120)
    expect(res.xpEarned).toBe(4 * 15 + 2 + 170);
    const rows = db.attempt.createMany.mock.calls[0][0].data;
    expect(rows).toHaveLength(5);
    expect(rows.find((r: { questionId: string }) => r.questionId === "q5")).toMatchObject({
      selectedKey: "ب",
      isCorrect: false,
      mode: "exam",
    });
    expect(rows.find((r: { questionId: string }) => r.questionId === "q1").timeMs).toBe(4000);
    // the wrong answer is queued for SRS review
    expect(db.reviewSchedule.createMany.mock.calls[0][0].data).toHaveLength(1);
  });

  it("stops awarding the bonus after the daily cap", async () => {
    db.examSessionData.count.mockResolvedValue(3);
    const sel = Object.fromEntries(ids.map((id) => [id, "أ"]));
    const res = await finalizeExamSession("s1", ids, sel, 300);
    expect(res.xpEarned).toBe(5 * 15); // per-answer XP only
  });

  it("gives no per-answer XP for questions already answered today", async () => {
    db.examSessionData.count.mockResolvedValue(3);
    db.attempt.findMany.mockResolvedValue(ids.map((questionId) => ({ questionId })));
    const sel = Object.fromEntries(ids.map((id) => [id, "أ"]));
    const res = await finalizeExamSession("s1", ids, sel, 300);
    expect(res.xpEarned).toBe(0);
  });

  it("is idempotent for a retried submit", async () => {
    db.examSessionData.findUnique.mockResolvedValue({ userBucket: "user-1" });
    const res = await finalizeExamSession("s1", ids, {}, 300);
    expect(res).toEqual({ success: true, xpEarned: 0, unlockedAchievements: [] });
    expect(db.examSessionData.create).not.toHaveBeenCalled();
  });
});
