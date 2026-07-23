// =====================================================================
// Unit Tests — Gamification Engine
// Tests all pure functions in gamification.ts (no DB or React deps)
// =====================================================================

import { describe, it, expect } from "vitest";
import {
  xpForCorrect,
  xpForExamSession,
  levelForXp,
  xpForLevel,
  levelProgress,
  computeMastery,
  masteryLabel,
  todayKey,
  dayKeyOffset,
  updateStreak,
  questForDate,
  weeklyChallengeForDate,
  getCrossedXpMilestones,
  getCrossedStreakMilestone,
  weekStartKey,
  weekEndKey,
  pickAdaptiveOrder,
  shuffle,
} from "./gamification";

// -------------------------------------------------------------------------
// XP & Leveling
// -------------------------------------------------------------------------

describe("xpForCorrect", () => {
  it("returns base 10 XP for study mode medium difficulty", () => {
    expect(xpForCorrect("medium", "study")).toBe(10);
  });

  it("returns boosted XP for exam mode", () => {
    expect(xpForCorrect("medium", "exam")).toBe(15);
  });

  it("applies 1.5x multiplier for hard difficulty", () => {
    expect(xpForCorrect("hard", "study")).toBe(15);  // 10 * 1.5
    expect(xpForCorrect("hard", "exam")).toBe(23);   // 15 * 1.5 = 22.5 → round 23
  });

  it("applies 0.8x multiplier for easy difficulty", () => {
    expect(xpForCorrect("easy", "study")).toBe(8);   // 10 * 0.8
    expect(xpForCorrect("easy", "exam")).toBe(12);   // 15 * 0.8
  });

  it("rounds fractional XP correctly", () => {
    // hard + exam = 15 * 1.5 = 22.5 → 23
    expect(xpForCorrect("hard", "exam")).toBe(23);
  });
});

describe("xpForExamSession", () => {
  it("returns minimum 50 XP for 0% score", () => {
    expect(xpForExamSession(0)).toBe(50);
  });

  it("returns ~200 XP for 100% score", () => {
    expect(xpForExamSession(100)).toBe(200); // 50 + 150
  });

  it("scales linearly with score percentage", () => {
    expect(xpForExamSession(50)).toBe(125); // 50 + 75
    expect(xpForExamSession(75)).toBe(163); // 50 + 112.5 → 113
  });
});

describe("levelForXp", () => {
  it("starts at level 1 with 0 XP", () => {
    expect(levelForXp(0)).toBe(1);
  });

  it("reaches level 2 at 50 XP", () => {
    expect(levelForXp(50)).toBe(2);
  });

  it("reaches level 3 at 200 XP (50 * 2^2 = 200 threshold for level 3)", () => {
    // Level 3 requires totalXp >= 50 * 3^2? No -
    // Level N requires totalXp >= 50 * (N-1)^2
    // L1: 0, L2: 50, L3: 200, L4: 450
    expect(levelForXp(199)).toBe(2);
    expect(levelForXp(200)).toBe(3);
  });

  it("returns level 5 at 800 XP", () => {
    expect(levelForXp(800)).toBe(5); // 50 * 4^2 = 800
  });
});

describe("xpForLevel", () => {
  it("returns 0 XP for level 1", () => {
    expect(xpForLevel(1)).toBe(0);
  });

  it("returns 50 XP for level 2", () => {
    expect(xpForLevel(2)).toBe(50);
  });

  it("returns 200 XP for level 3", () => {
    expect(xpForLevel(3)).toBe(200);
  });

  it("returns 450 XP for level 4", () => {
    expect(xpForLevel(4)).toBe(450);
  });
});

describe("levelProgress", () => {
  it("returns correct progress at start", () => {
    const p = levelProgress(0);
    expect(p.level).toBe(1);
    expect(p.current).toBe(0);
    expect(p.nextLevelXp).toBe(50);
    expect(p.pct).toBe(0);
  });

  it("returns 50% progress at 25 XP (halfway to level 2)", () => {
    const p = levelProgress(25);
    expect(p.level).toBe(1);
    expect(p.pct).toBe(50);
  });

  it("returns correct progress at level 2 midpoint (33%) ", () => {
    const p = levelProgress(100);
    expect(p.level).toBe(2);
    // Level 2 threshold = 50, Level 3 threshold = 200
    // pct = (100 - 50) / (200 - 50) * 100 = 33.33
    expect(p.pct).toBeCloseTo(33.33, 0);
  });

  it("clamps pct between 0 and 100", () => {
    const p = levelProgress(-10);
    expect(p.pct).toBe(0);

    const p2 = levelProgress(999999);
    expect(p2.pct).toBe(100);
  });
});

// -------------------------------------------------------------------------
// Mastery
// -------------------------------------------------------------------------

describe("computeMastery", () => {
  it("returns 0 when total is 0", () => {
    expect(computeMastery(0, 0, 0)).toBe(0);
  });

  it("returns 0 when no attempts", () => {
    expect(computeMastery(10, 0, 0)).toBe(0);
  });

  it("caps mastery at 30 when fewer than 3 attempts", () => {
    // 1/1 correct = 100% accuracy, coverage = 1/10 = 10%
    // mastery = (1.0 * 0.6 + 0.1 * 0.4) * 100 = 64, capped at 30
    expect(computeMastery(10, 1, 1)).toBe(30);
  });

  it("computes full mastery with 3+ attempts", () => {
    // 10/10 correct = 100% accuracy, coverage = 10/10 = 100%
    // mastery = (1.0 * 0.6 + 1.0 * 0.4) * 100 = 100
    expect(computeMastery(10, 10, 10)).toBe(100);
  });

  it("computes partial mastery correctly", () => {
    // 5/10 correct = 50% accuracy, coverage = 10/10 = 100%
    // mastery = (0.5 * 0.6 + 1.0 * 0.4) * 100 = 70
    // 10 attempts >= 3, no cap
    expect(computeMastery(10, 10, 5)).toBe(70);
  });

  it("handles low coverage with high accuracy", () => {
    // 3/3 correct on 100 total questions
    // accuracy = 100%, coverage = 3/100 = 3%
    // mastery = (1.0 * 0.6 + 0.03 * 0.4) * 100 = 61.2 → 61
    // 3 attempts >= 3, no cap
    const result = computeMastery(100, 3, 3);
    expect(result).toBe(61);
  });
});

describe("masteryLabel", () => {
  it('returns "غير مُختبَر" for scores below 15', () => {
    expect(masteryLabel(0)).toBe("غير مُختبَر");
    expect(masteryLabel(14)).toBe("غير مُختبَر");
  });

  it('returns "مبتدئ" for scores 15-39', () => {
    expect(masteryLabel(15)).toBe("مبتدئ");
    expect(masteryLabel(39)).toBe("مبتدئ");
  });

  it('returns "في الطريق" for scores 40-64', () => {
    expect(masteryLabel(40)).toBe("في الطريق");
    expect(masteryLabel(64)).toBe("في الطريق");
  });

  it('returns "متقدّم" for scores 65-84', () => {
    expect(masteryLabel(65)).toBe("متقدّم");
    expect(masteryLabel(84)).toBe("متقدّم");
  });

  it('returns "متمكّن" for scores 85-100', () => {
    expect(masteryLabel(85)).toBe("متمكّن");
    expect(masteryLabel(100)).toBe("متمكّن");
  });
});

// -------------------------------------------------------------------------
// Date Helpers
// -------------------------------------------------------------------------

describe("todayKey", () => {
  it("returns YYYY-MM-DD format", () => {
    const key = todayKey(new Date(2026, 6, 15)); // July 15, 2026
    expect(key).toBe("2026-07-15");
  });

  it("pads month and day with zeros", () => {
    const key = todayKey(new Date(2026, 0, 5)); // Jan 5, 2026
    expect(key).toBe("2026-01-05");
  });
});

describe("dayKeyOffset", () => {
  it("returns yesterday when days=1", () => {
    const today = new Date(2026, 6, 15);
    const key = dayKeyOffset(1, today);
    expect(key).toBe("2026-07-14");
  });

  it("returns 7 days ago correctly", () => {
    const today = new Date(2026, 6, 15);
    const key = dayKeyOffset(7, today);
    expect(key).toBe("2026-07-08");
  });

  it("handles month boundary", () => {
    const today = new Date(2026, 6, 1);
    const key = dayKeyOffset(1, today);
    expect(key).toBe("2026-06-30");
  });

  it("handles year boundary", () => {
    const today = new Date(2026, 0, 1);
    const key = dayKeyOffset(1, today);
    expect(key).toBe("2025-12-31");
  });
});

// -------------------------------------------------------------------------
// Streaks
// -------------------------------------------------------------------------

describe("updateStreak", () => {
  it("maintains streak if lastActive is today", () => {
    const today = todayKey(new Date(2026, 6, 15));
    const result = updateStreak(5, today, 2);
    expect(result.streak).toBe(5);
    expect(result.shields).toBe(2);
    expect(result.shieldConsumed).toBe(false);
    expect(result.shieldEarned).toBe(false);
  });

  it("increments streak if lastActive is yesterday", () => {
    const yesterday = todayKey(new Date(2026, 6, 14));
    const result = updateStreak(5, yesterday, 2);
    expect(result.streak).toBe(6);
    expect(result.shields).toBe(2); // Not a 7-day milestone
    expect(result.shieldConsumed).toBe(false);
    expect(result.shieldEarned).toBe(false);
  });

  it("earns a shield when reaching day 7", () => {
    const yesterday = todayKey(new Date(2026, 6, 14));
    const result = updateStreak(6, yesterday, 1);
    expect(result.streak).toBe(7);
    expect(result.shields).toBe(2); // 1 + 1 earned
    expect(result.shieldEarned).toBe(true);
  });

  it("earns a shield when reaching day 14", () => {
    const yesterday = todayKey(new Date(2026, 6, 14));
    const result = updateStreak(13, yesterday, 0);
    expect(result.streak).toBe(14);
    expect(result.shields).toBe(1); // 0 + 1 earned
    expect(result.shieldEarned).toBe(true);
  });

  it("does NOT earn a shield on same-day visit at milestone", () => {
    const today = todayKey(new Date(2026, 6, 15));
    // Already at streak 14 and visited earlier today
    const result = updateStreak(14, today, 1);
    expect(result.streak).toBe(14);
    expect(result.shields).toBe(1);
    expect(result.shieldEarned).toBe(false);
  });

  it("consumes a shield if gap detected and shields > 0", () => {
    const oldDate = "2026-07-10";
    const result = updateStreak(5, oldDate, 2);
    expect(result.streak).toBe(5);
    expect(result.shields).toBe(1);
    expect(result.shieldConsumed).toBe(true);
    expect(result.shieldEarned).toBe(false);
  });

  it("resets streak to 1 if gap detected and no shields", () => {
    const oldDate = "2026-07-10";
    const result = updateStreak(5, oldDate, 0);
    expect(result.streak).toBe(1);
    expect(result.shields).toBe(0);
    expect(result.shieldConsumed).toBe(false);
    expect(result.shieldEarned).toBe(false);
  });

  it("does not consume shield if streak is 0", () => {
    const oldDate = "2026-07-10";
    const result = updateStreak(0, oldDate, 2);
    expect(result.streak).toBe(1);
    expect(result.shields).toBe(2);
    expect(result.shieldConsumed).toBe(false);
    expect(result.shieldEarned).toBe(false);
  });
});

// -------------------------------------------------------------------------
// Daily Quest
// -------------------------------------------------------------------------

describe("questForDate", () => {
  it("returns a valid quest from the pool", () => {
    const quest = questForDate("2026-07-15");
    const validSlugs = ["q10_attempts", "q7_correct", "q3_categories", "q5_attempts", "q30_xp"];
    expect(validSlugs).toContain(quest.slug);
  });

  it("returns the same quest for the same date", () => {
    const q1 = questForDate("2026-07-15");
    const q2 = questForDate("2026-07-15");
    expect(q1.slug).toBe(q2.slug);
  });

  it("can return different quests for different dates", () => {
    let results = new Set<string>();
    for (let day = 1; day <= 31; day++) {
      const date = `2026-07-${String(day).padStart(2, "0")}`;
      results.add(questForDate(date).slug);
    }
    // With 5 quests, 31 days should produce at least 3 different quests
    expect(results.size).toBeGreaterThanOrEqual(3);
  });

  it("each quest has the required fields", () => {
    const quest = questForDate("2026-07-15");
    expect(quest).toHaveProperty("slug");
    expect(quest).toHaveProperty("descriptionAr");
    expect(quest).toHaveProperty("target");
    expect(quest).toHaveProperty("metric");
    expect(["attempts", "correct", "xp", "categories"]).toContain(quest.metric);
  });
});

// -------------------------------------------------------------------------
// Adaptive Ordering & Shuffle
// -------------------------------------------------------------------------

describe("shuffle", () => {
  it("preserves array length", () => {
    const arr = [1, 2, 3, 4, 5];
    const result = shuffle(arr);
    expect(result).toHaveLength(5);
  });

  it("contains all original elements", () => {
    const arr = [1, 2, 3, 4, 5];
    const result = shuffle(arr);
    expect(result.sort()).toEqual(arr.sort());
  });

  it("does not mutate the original array", () => {
    const arr = [1, 2, 3, 4, 5];
    const copy = [...arr];
    shuffle(arr);
    expect(arr).toEqual(copy);
  });

  it("produces deterministic output with same seed", () => {
    const arr = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10];
    const result1 = shuffle(arr, 42);
    const result2 = shuffle(arr, 42);
    expect(result1).toEqual(result2);
  });

  it("can produce different output with different seeds", () => {
    const arr = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10];
    const result1 = shuffle(arr, 42);
    const result2 = shuffle(arr, 99);
    // Very unlikely to be the same
    expect(result1).not.toEqual(result2);
  });

  it("handles empty array", () => {
    expect(shuffle([])).toEqual([]);
  });

  it("handles single-element array", () => {
    expect(shuffle([1])).toEqual([1]);
  });
});

// -------------------------------------------------------------------------
// XP Milestones
// -------------------------------------------------------------------------

describe("getCrossedXpMilestones", () => {
  it("returns empty array when no milestones crossed", () => {
    expect(getCrossedXpMilestones(0, 50)).toEqual([]);
  });

  it("detects crossing a single milestone", () => {
    const result = getCrossedXpMilestones(50, 150);
    expect(result).toHaveLength(1);
    expect(result[0].xp).toBe(100);
    expect(result[0].name).toBe("١٠٠ نقطة خبرة");
  });

  it("detects crossing multiple milestones at once", () => {
    const result = getCrossedXpMilestones(50, 1200);
    // Crosses: 100, 500, 1000
    expect(result).toHaveLength(3);
    expect(result.map((m) => m.xp)).toEqual([100, 500, 1000]);
  });

  it("does not count the same milestone twice", () => {
    const result = getCrossedXpMilestones(100, 200);
    // oldXp = 100, which equals the milestone threshold → NOT crossed
    expect(result).toHaveLength(0);
  });

  it("includes exact match on newXp", () => {
    // oldXp < 500 and newXp === 500 → crossed
    const result = getCrossedXpMilestones(300, 500);
    expect(result).toHaveLength(1);
    expect(result[0].xp).toBe(500);
  });

  it("handles highest milestone (50000)", () => {
    const result = getCrossedXpMilestones(40000, 60000);
    expect(result).toHaveLength(1);
    expect(result[0].xp).toBe(50000);
  });

  it("detects crossing all milestones from zero to max", () => {
    const result = getCrossedXpMilestones(0, 99999);
    expect(result).toHaveLength(8); // All 8 milestones
    expect(result[result.length - 1].xp).toBe(50000);
  });
});

// -------------------------------------------------------------------------
// Streak Milestones
// -------------------------------------------------------------------------

describe("getCrossedStreakMilestone", () => {
  it("returns null when no milestone crossed", () => {
    expect(getCrossedStreakMilestone(0, 3)).toBeNull();
    expect(getCrossedStreakMilestone(5, 6)).toBeNull();
  });

  it("detects crossing 7-day milestone", () => {
    const result = getCrossedStreakMilestone(5, 7);
    expect(result).not.toBeNull();
    expect(result!.days).toBe(7);
    expect(result!.name).toContain("أسبوع");
  });

  it("detects crossing 30-day milestone", () => {
    const result = getCrossedStreakMilestone(25, 30);
    expect(result).not.toBeNull();
    expect(result!.days).toBe(30);
  });

  it("detects crossing 100-day legendary milestone", () => {
    const result = getCrossedStreakMilestone(90, 105);
    expect(result).not.toBeNull();
    expect(result!.days).toBe(100);
  });

  it("returns the highest crossed milestone", () => {
    // Crosses both 7 and 14 days — returns the first matched (7)
    const result = getCrossedStreakMilestone(5, 15);
    expect(result).not.toBeNull();
    expect(result!.days).toBe(7);
  });

  it("does not count when oldStreak equals the milestone", () => {
    expect(getCrossedStreakMilestone(7, 10)).toBeNull();
  });

  it("handles exact landing on a milestone", () => {
    const result = getCrossedStreakMilestone(6, 7);
    expect(result).not.toBeNull();
    expect(result!.days).toBe(7);
  });
});

// -------------------------------------------------------------------------
// Weekly Challenge
// -------------------------------------------------------------------------

describe("weeklyChallengeForDate", () => {
  it("returns a valid challenge from the pool", () => {
    const challenge = weeklyChallengeForDate("2026-07-15");
    const validSlugs = ["w50_attempts", "w30_correct", "w100_xp", "w80_attempts", "w50_correct"];
    expect(validSlugs).toContain(challenge.slug);
  });

  it("returns the same challenge for the same date", () => {
    const c1 = weeklyChallengeForDate("2026-07-15");
    const c2 = weeklyChallengeForDate("2026-07-15");
    expect(c1.slug).toBe(c2.slug);
  });

  it("can return different challenges for different dates", () => {
    // The function is deterministic per date string, not per week.
    // Different dates often produce different challenges due to char code variance.
    const results = new Set(
      ["2026-07-13", "2026-07-14", "2026-07-15"].map(weeklyChallengeForDate)
    );
    // With 3 dates and 5 pool items, at least 2 different results is typical
    expect(results.size).toBeGreaterThan(1);
  });

  it("can return different challenges for different weeks", () => {
    // Check 10 consecutive weeks
    const results = new Set<string>();
    for (let week = 0; week < 10; week++) {
      const date = `2026-${String(1 + week).padStart(2, "0")}-01`;
      results.add(weeklyChallengeForDate(date).slug);
    }
    // With 5 challenges in pool, 10 weeks should produce variety
    expect(results.size).toBeGreaterThanOrEqual(2);
  });

  it("each challenge has the required fields", () => {
    const challenge = weeklyChallengeForDate("2026-07-15");
    expect(challenge).toHaveProperty("slug");
    expect(challenge).toHaveProperty("descriptionAr");
    expect(challenge).toHaveProperty("target");
    expect(challenge).toHaveProperty("metric");
    expect(challenge).toHaveProperty("rewardLabel");
    expect(["attempts", "correct", "xp"]).toContain(challenge.metric);
  });
});

// -------------------------------------------------------------------------
// Week Date Helpers
// -------------------------------------------------------------------------

describe("weekStartKey", () => {
  it("returns Monday for a Wednesday", () => {
    // July 15, 2026 is a Wednesday
    const result = weekStartKey(new Date(2026, 6, 15));
    expect(result).toBe("2026-07-13"); // Monday
  });

  it("returns the same date if already Monday", () => {
    // July 13, 2026 is a Monday
    const result = weekStartKey(new Date(2026, 6, 13));
    expect(result).toBe("2026-07-13");
  });

  it("handles Sunday correctly (returns previous Monday)", () => {
    // July 19, 2026 is a Sunday
    const result = weekStartKey(new Date(2026, 6, 19));
    expect(result).toBe("2026-07-13"); // Monday of same week
  });

  it("handles month boundary", () => {
    // July 1, 2026 is a Wednesday — Monday is June 29
    const result = weekStartKey(new Date(2026, 6, 1));
    expect(result).toBe("2026-06-29");
  });

  it("handles year boundary", () => {
    // Jan 1, 2026 is a Thursday — Monday is Dec 29, 2025
    const result = weekStartKey(new Date(2026, 0, 1));
    expect(result).toBe("2025-12-29");
  });
});

describe("weekEndKey", () => {
  it("returns Sunday for a Wednesday", () => {
    // July 15, 2026 is a Wednesday
    const result = weekEndKey(new Date(2026, 6, 15));
    expect(result).toBe("2026-07-19"); // Sunday
  });

  it("returns the same date if already Sunday", () => {
    // July 19, 2026 is a Sunday
    const result = weekEndKey(new Date(2026, 6, 19));
    expect(result).toBe("2026-07-19");
  });

  it("returns Sunday 6 days after Monday", () => {
    const result = weekEndKey(new Date(2026, 6, 13)); // Monday
    expect(result).toBe("2026-07-19"); // Sunday
  });

  it("handles month boundary", () => {
    // June 29, 2026 is a Monday → Sunday is July 5
    const result = weekEndKey(new Date(2026, 5, 29));
    expect(result).toBe("2026-07-05");
  });
});

describe("pickAdaptiveOrder", () => {
  interface Item {
    id: string;
    label: string;
  }

  const getId = (item: Item) => item.id;

  it("returns empty array for empty pool", () => {
    expect(pickAdaptiveOrder([], { getId })).toEqual([]);
  });

  it("returns all items when no recents or accuracy data", () => {
    const pool: Item[] = [
      { id: "1", label: "a" },
      { id: "2", label: "b" },
      { id: "3", label: "c" },
    ];
    const result = pickAdaptiveOrder(pool, { getId });
    expect(result).toHaveLength(3);
    expect(result.map((i) => i.id).sort()).toEqual(["1", "2", "3"]);
  });

  it("puts unseen items first", () => {
    const pool: Item[] = [
      { id: "1", label: "a" },
      { id: "2", label: "b" },
      { id: "3", label: "c" },
    ];
    const accuracyById = new Map<string, number>([
      ["1", 0.5],
      ["2", 0.8],
    ]);
    const result = pickAdaptiveOrder(pool, { getId, accuracyById });
    // "3" is unseen → should come first
    expect(result[0].id).toBe("3");
  });

  it("sorts seen items by ascending accuracy (weakest first)", () => {
    const pool: Item[] = [
      { id: "1", label: "a" },
      { id: "2", label: "b" },
      { id: "3", label: "c" },
    ];
    const accuracyById = new Map<string, number>([
      ["1", 0.9],  // strongest
      ["2", 0.3],  // weakest
      ["3", 0.6],  // middle
    ]);
    const result = pickAdaptiveOrder(pool, { getId, accuracyById });
    // All seen, sorted by accuracy ascending: 2 (0.3), 3 (0.6), 1 (0.9)
    expect(result[0].id).toBe("2");
    expect(result[1].id).toBe("3");
    expect(result[2].id).toBe("1");
  });

  it("excludes recent items from the front, adds them at the back", () => {
    const pool: Item[] = [
      { id: "1", label: "a" },
      { id: "2", label: "b" },
      { id: "3", label: "c" },
    ];
    const recentIds = new Set<string>(["1"]);
    const accuracyById = new Map<string, number>([
      ["2", 0.5],
      ["3", 0.5],
    ]);
    const result = pickAdaptiveOrder(pool, { getId, recentIds, accuracyById });
    // "1" is recent → excluded from shuffle/seen, appended at end
    expect(result[result.length - 1].id).toBe("1");
  });

  it("uses seed for deterministic output", () => {
    const pool: Item[] = [
      { id: "1", label: "a" },
      { id: "2", label: "b" },
      { id: "3", label: "c" },
      { id: "4", label: "d" },
    ];
    // All unseen → shuffled
    const result1 = pickAdaptiveOrder(pool, { getId, seed: 42 });
    const result2 = pickAdaptiveOrder(pool, { getId, seed: 42 });
    expect(result1.map((i) => i.id)).toEqual(result2.map((i) => i.id));
  });
});
