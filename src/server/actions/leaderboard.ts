"use server";

import { db } from "@/lib/db";
import { getUserBucket } from "@/lib/auth-utils";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type LeaderboardMode = "xp" | "weekly" | "streak";

export interface LeaderboardEntry {
  rank: number;
  userId: string;
  name: string | null;
  image: string | null;
  totalXp: number;
  level: number;
  currentStreak: number;
  longestStreak: number;
  weeklyXp: number;
  /** Whether this entry is the current user */
  isMe: boolean;
}

export interface LeaderboardData {
  mode: LeaderboardMode;
  entries: LeaderboardEntry[];
  currentUser: LeaderboardEntry | null;
  totalUsers: number;
}

// ---------------------------------------------------------------------------
// Week helpers
// ---------------------------------------------------------------------------

function weekStartKey(d = new Date()): string {
  const day = d.getDay();
  const diff = d.getDate() - day + (day === 0 ? -6 : 1);
  const monday = new Date(d);
  monday.setDate(diff);
  const y = monday.getFullYear();
  const m = String(monday.getMonth() + 1).padStart(2, "0");
  const dd = String(monday.getDate()).padStart(2, "0");
  return `${y}-${m}-${dd}`;
}

// ---------------------------------------------------------------------------
// Fetch leaderboard
// ---------------------------------------------------------------------------

export async function fetchLeaderboard(
  mode: LeaderboardMode = "xp",
  limit = 50
): Promise<LeaderboardData> {
  const currentUserId = await getUserBucket();

  // Get all user profiles with XP, level, streaks
  const profiles = await db.userProfile.findMany({
    orderBy:
      mode === "streak"
        ? { currentStreak: "desc" }
        : { totalXp: "desc" },
    take: limit,
  });

  // Get matching user info (name, image)
  const userIds = profiles.map((p) => p.userBucket);
  const users = await db.user.findMany({
    where: { id: { in: userIds } },
    select: { id: true, name: true, image: true },
  });
  const userMap = new Map(users.map((u) => [u.id, u]));

  // Compute weekly XP from daily activity
  const weekStart = weekStartKey();
  const weeklyActivities = await db.dailyActivity.findMany({
    where: {
      userBucket: { in: userIds },
      date: { gte: weekStart },
    },
  });
  const weeklyXpMap = new Map<string, number>();
  for (const a of weeklyActivities) {
    weeklyXpMap.set(a.userBucket, (weeklyXpMap.get(a.userBucket) ?? 0) + a.xpEarned);
  }

  // Build entries
  // For weekly mode, we need to re-sort by weekly XP
  let sorted = profiles.map((p, i) => {
    const user = userMap.get(p.userBucket);
    return {
      rank: 0, // will compute after sorting
      userId: p.userBucket,
      name: user?.name ?? null,
      image: user?.image ?? null,
      totalXp: p.totalXp,
      level: p.level,
      currentStreak: p.currentStreak,
      longestStreak: p.longestStreak,
      weeklyXp: weeklyXpMap.get(p.userBucket) ?? 0,
      isMe: p.userBucket === currentUserId,
    };
  });

  // Sort by the selected mode
  if (mode === "weekly") {
    sorted.sort((a, b) => b.weeklyXp - a.weeklyXp);
  } else if (mode === "streak") {
    // Already sorted by currentStreak desc from query
  }
  // XP mode is already sorted by totalXp desc from query

  // Trim to limit after re-sort
  sorted = sorted.slice(0, limit);

  // Assign ranks (with ties — same score gets same rank)
  let rank = 1;
  let prevScore = -1;
  sorted = sorted.map((entry) => {
    const score = mode === "weekly" ? entry.weeklyXp
      : mode === "streak" ? entry.currentStreak
      : entry.totalXp;
    if (score !== prevScore) {
      rank = sorted.indexOf(entry) + 1;
      prevScore = score;
    }
    return { ...entry, rank };
  });

  // If current user is not in the top entries, include them at the bottom
  let currentUser: LeaderboardEntry | null = sorted.find((e) => e.isMe) ?? null;

  return {
    mode,
    entries: sorted,
    currentUser,
    totalUsers: profiles.length,
  };
}
