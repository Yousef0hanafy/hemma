"use server";

import { db } from "@/lib/db";
import { getUserBucket } from "@/lib/auth-utils";
import { weekStartKey } from "@/lib/engine/gamification";

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
// Fetch leaderboard
// ---------------------------------------------------------------------------

export async function fetchLeaderboard(
  mode: LeaderboardMode = "xp",
  limit = 50
): Promise<LeaderboardData> {
  const currentUserId = await getUserBucket();
  limit = Math.min(100, Math.max(1, Math.floor(Number(limit) || 50)));
  const weekStart = weekStartKey();

  // Weekly XP per user (this week, Riyadh time)
  const weeklyXpFor = async (userIds?: string[]) => {
    const rows = await db.dailyActivity.groupBy({
      by: ["userBucket"],
      where: { date: { gte: weekStart }, ...(userIds ? { userBucket: { in: userIds } } : {}) },
      _sum: { xpEarned: true },
      orderBy: { _sum: { xpEarned: "desc" } },
      ...(userIds ? {} : { take: limit }),
    });
    return new Map(rows.map((r) => [r.userBucket, r._sum.xpEarned ?? 0]));
  };

  // 1. Pick the top `limit` users for THIS mode (weekly used to re-sort the
  //    all-time top 50, missing anyone with a great week but low total XP)
  let topIds: string[];
  let weeklyXpMap: Map<string, number>;
  if (mode === "weekly") {
    weeklyXpMap = await weeklyXpFor();
    topIds = [...weeklyXpMap.keys()];
  } else {
    const top = await db.userProfile.findMany({
      orderBy: mode === "streak" ? [{ currentStreak: "desc" }, { totalXp: "desc" }] : { totalXp: "desc" },
      take: limit,
      select: { userBucket: true },
    });
    topIds = top.map((p) => p.userBucket);
    weeklyXpMap = await weeklyXpFor(topIds);
  }

  const idsToLoad = topIds.includes(currentUserId) ? topIds : [...topIds, currentUserId];
  const [profiles, users, totalUsers] = await Promise.all([
    db.userProfile.findMany({ where: { userBucket: { in: idsToLoad } } }),
    db.user.findMany({
      where: { id: { in: idsToLoad } },
      select: { id: true, name: true, image: true },
    }),
    db.userProfile.count(),
  ]);
  if (!weeklyXpMap.has(currentUserId)) {
    const mine = await weeklyXpFor([currentUserId]);
    weeklyXpMap.set(currentUserId, mine.get(currentUserId) ?? 0);
  }
  const profileMap = new Map(profiles.map((p) => [p.userBucket, p]));
  const userMap = new Map(users.map((u) => [u.id, u]));

  const scoreOf = (e: LeaderboardEntry) =>
    mode === "weekly" ? e.weeklyXp : mode === "streak" ? e.currentStreak : e.totalXp;

  const toEntry = (id: string): LeaderboardEntry | null => {
    const p = profileMap.get(id);
    const weeklyXp = weeklyXpMap.get(id) ?? 0;
    if (!p && weeklyXp === 0) return null;
    const user = userMap.get(id);
    const isMe = id === currentUserId;
    return {
      rank: 0,
      userId: isMe ? id : `user-${id.slice(0, 8)}`,
      name: user?.name ?? null,
      image: user?.image ?? null,
      totalXp: p?.totalXp ?? 0,
      level: p?.level ?? 1,
      currentStreak: p?.currentStreak ?? 0,
      longestStreak: p?.longestStreak ?? 0,
      weeklyXp,
      isMe,
    };
  };

  const sorted = topIds
    .map(toEntry)
    .filter((e): e is LeaderboardEntry => e !== null)
    .sort((a, b) => scoreOf(b) - scoreOf(a));

  // Ranks with ties — same score, same rank
  sorted.forEach((entry, i) => {
    entry.rank = i > 0 && scoreOf(entry) === scoreOf(sorted[i - 1]) ? sorted[i - 1].rank : i + 1;
  });

  // 2. The current user's own rank, even when outside the top list
  let currentUser = sorted.find((e) => e.isMe) ?? null;
  if (!currentUser) {
    const me = toEntry(currentUserId);
    if (me) {
      const myScore = scoreOf(me);
      let ahead: number;
      if (mode === "weekly") {
        const rows = await db.$queryRaw<{ count: number }[]>`
          SELECT COUNT(*)::int AS count FROM (
            SELECT "userBucket" FROM daily_activities
            WHERE date >= ${weekStart}
            GROUP BY "userBucket"
            HAVING SUM("xpEarned") > ${myScore}
          ) t`;
        ahead = rows[0]?.count ?? 0;
      } else {
        ahead = await db.userProfile.count({
          where: mode === "streak" ? { currentStreak: { gt: myScore } } : { totalXp: { gt: myScore } },
        });
      }
      currentUser = { ...me, rank: ahead + 1 };
    }
  }

  return {
    mode,
    entries: sorted,
    currentUser,
    totalUsers,
  };
}
