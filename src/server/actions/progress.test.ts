import { describe, it, expect, vi, beforeEach } from "vitest";

const db = vi.hoisted(() => ({
  question: { findUnique: vi.fn(), findMany: vi.fn() },
  attempt: { findFirst: vi.fn(), create: vi.fn() },
  dailyActivity: { upsert: vi.fn() },
  userProfile: { findUnique: vi.fn(), upsert: vi.fn(), update: vi.fn() },
  examSessionData: { findUnique: vi.fn(), count: vi.fn(), create: vi.fn() },
}));
vi.mock("@/lib/db", () => ({ db }));
vi.mock("@/lib/auth", () => ({ requirePermission: vi.fn(async () => "user-1") }));

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
    db.question.findMany.mockResolvedValue(ids.map((id) => ({ id, correctKey: "أ" })));
  });

  it("grades from stored keys and awards the exam bonus", async () => {
    db.examSessionData.count.mockResolvedValue(0);
    const sel = Object.fromEntries(ids.map((id) => [id, "أ"]));
    const res = await finalizeExamSession("s1", ids, sel, 300);
    expect(res.xpEarned).toBe(200); // 100%
  });

  it("stops awarding the bonus after the daily cap", async () => {
    db.examSessionData.count.mockResolvedValue(3);
    const sel = Object.fromEntries(ids.map((id) => [id, "أ"]));
    const res = await finalizeExamSession("s1", ids, sel, 300);
    expect(res.xpEarned).toBe(0);
  });

  it("is idempotent for a retried submit", async () => {
    db.examSessionData.findUnique.mockResolvedValue({ userBucket: "user-1" });
    const res = await finalizeExamSession("s1", ids, {}, 300);
    expect(res).toEqual({ success: true, xpEarned: 0 });
    expect(db.examSessionData.create).not.toHaveBeenCalled();
  });
});
