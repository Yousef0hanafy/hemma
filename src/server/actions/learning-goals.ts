"use server";

import { db } from "@/lib/db";
import { getUserBucket } from "@/lib/auth-utils";
import { todayKey } from "@/lib/engine/gamification";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export const GOAL_TYPES = ["attempts", "correct", "xp"] as const;
export type GoalType = (typeof GOAL_TYPES)[number];

export interface LearningGoalDTO {
  id: string;
  type: GoalType;
  target: number;
  label: string | null;
  enabled: boolean;
}

export interface GoalProgress {
  goal: LearningGoalDTO;
  current: number;
  target: number;
  complete: boolean;
  percent: number;
}

export interface GoalsWithProgress {
  goals: LearningGoalDTO[];
  progress: GoalProgress[];
  /** Total goals completed today */
  completedCount: number;
  /** Total goals set */
  totalCount: number;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const GOAL_LABELS: Record<GoalType, string> = {
  attempts: "أسئلة محلولة",
  correct: "إجابات صحيحة",
  xp: "نقاط خبرة",
};

export async function goalLabel(type: GoalType): string {
  return GOAL_LABELS[type];
}

const GOAL_ICONS: Record<GoalType, string> = {
  attempts: "📝",
  correct: "✅",
  xp: "⭐",
};

export async function goalIcon(type: GoalType): string {
  return GOAL_ICONS[type];
}

// ---------------------------------------------------------------------------
// Fetch goals
// ---------------------------------------------------------------------------

export async function fetchLearningGoals(): Promise<GoalsWithProgress | null> {
  try {
    const userBucket = await getUserBucket();
    const [goals, todayActivity] = await Promise.all([
      db.learningGoal.findMany({
        where: { userBucket, enabled: true },
        orderBy: { createdAt: "asc" },
      }),
      db.dailyActivity.findUnique({
        where: { userBucket_date: { userBucket, date: todayKey() } },
      }),
    ]);

    if (goals.length === 0) return null;

    const progress: GoalProgress[] = goals.map((g) => {
      let current = 0;
      if (todayActivity) {
        switch (g.type) {
          case "attempts": current = todayActivity.attempts; break;
          case "correct": current = todayActivity.correct; break;
          case "xp": current = todayActivity.xpEarned; break;
        }
      }
      const target = g.target;
      return {
        goal: {
          id: g.id,
          type: g.type as GoalType,
          target: g.target,
          label: g.label,
          enabled: g.enabled,
        },
        current,
        target,
        complete: current >= target,
        percent: Math.min(100, Math.round((current / target) * 100)),
      };
    });

    return {
      goals: goals.map((g) => ({
        id: g.id,
        type: g.type as GoalType,
        target: g.target,
        label: g.label,
        enabled: g.enabled,
      })),
      progress,
      completedCount: progress.filter((p) => p.complete).length,
      totalCount: progress.length,
    };
  } catch {
    return null;
  }
}

// ---------------------------------------------------------------------------
// Upsert a goal (create or update target)
// ---------------------------------------------------------------------------

export async function upsertLearningGoal(
  type: GoalType,
  target: number
): Promise<LearningGoalDTO> {
  const userBucket = await getUserBucket();
  const goal = await db.learningGoal.upsert({
    where: { userBucket_type: { userBucket, type } },
    create: { userBucket, type, target, enabled: true },
    update: { target, enabled: true },
  });
  return {
    id: goal.id,
    type: goal.type as GoalType,
    target: goal.target,
    label: goal.label,
    enabled: goal.enabled,
  };
}

// ---------------------------------------------------------------------------
// Delete a goal
// ---------------------------------------------------------------------------

export async function deleteLearningGoal(type: GoalType): Promise<void> {
  const userBucket = await getUserBucket();
  await db.learningGoal.deleteMany({
    where: { userBucket, type },
  });
}

// ---------------------------------------------------------------------------
// Toggle a goal on/off
// ---------------------------------------------------------------------------

export async function toggleLearningGoal(
  type: GoalType,
  enabled: boolean
): Promise<void> {
  const userBucket = await getUserBucket();
  await db.learningGoal.updateMany({
    where: { userBucket, type },
    data: { enabled },
  });
}
