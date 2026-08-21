"use server";

import { db } from "@/lib/db";
import {
  requireStudioAccess,
  requireAdminAccess,
} from "@/lib/studio-auth";

// ---------------------------------------------------------------------------
// DTOs
// ---------------------------------------------------------------------------

export interface UserListItem {
  id: string;
  name: string | null;
  email: string | null;
  image: string | null;
  role: string;
  emailVerified: boolean;
  provider: string | null;
  // Stats
  totalAttempts: number;
  correctAttempts: number;
  accuracy: number | null;
  reviewsCount: number;
  lastActiveAt: string | null;
  createdAt: string;
}

export interface UsersOverview {
  totalUsers: number;
  byRole: { role: string; count: number }[];
  activeToday: number;
  activeThisWeek: number;
  totalAttempts: number;
  overallAccuracy: number | null;
}

// ---------------------------------------------------------------------------
// List all users with stats
// ---------------------------------------------------------------------------

export async function getUsers(): Promise<UserListItem[]> {
  await requireStudioAccess();

  const users = await db.user.findMany({
    orderBy: { name: "asc" },
    select: {
      id: true,
      name: true,
      email: true,
      image: true,
      role: true,
      emailVerified: true,
      accounts: {
        select: { provider: true },
      },
      reviews: {
        select: { id: true },
      },
      userProfile: {
        select: {
          lastActiveDate: true,
          updatedAt: true,
          createdAt: true,
        },
      },
      sessions: {
        select: { expires: true },
        take: 1,
        orderBy: { expires: "desc" },
      },
    },
  });

  // Get attempt stats by userBucket
  const attemptGroups = await db.attempt.groupBy({
    by: ["userBucket"],
    _count: { id: true },
  }).catch(() => []);

  // Get correct counts
  const correctCounts = await db.attempt.groupBy({
    by: ["userBucket"],
    where: { isCorrect: true },
    _count: { id: true },
  }).catch(() => []);

  const attemptCountMap = new Map<string, number>();
  for (const g of attemptGroups) {
    attemptCountMap.set(g.userBucket, g._count.id);
  }

  const correctCountMap = new Map<string, number>();
  for (const g of correctCounts) {
    correctCountMap.set(g.userBucket, g._count.id);
  }

  // Get last active per user (latest attempt date)
  let lastActiveMap = new Map<string, string>();
  try {
    const lastActiveResults = await db.$queryRaw<{ userbucket: string; maxdate: Date }[]>`
       SELECT "userBucket" as userbucket, MAX("createdAt") as maxdate
       FROM attempts
       GROUP BY "userBucket"
    `;
    lastActiveMap = new Map(
      lastActiveResults.map((r) => [r.userbucket, r.maxdate.toISOString()])
    );
  } catch (err) {
    console.warn("[StudioUsers] Raw query for attempts lastActive failed:", err);
  }

  return users.map((u) => {
    const totalAttempts = attemptCountMap.get(u.id) ?? 0;
    const correctAttempts = correctCountMap.get(u.id) ?? 0;

    // Calculate best last active timestamp
    let lastActiveAt: string | null = lastActiveMap.get(u.id) ?? null;
    if (!lastActiveAt && u.userProfile?.updatedAt) {
      lastActiveAt = u.userProfile.updatedAt.toISOString();
    } else if (!lastActiveAt && u.userProfile?.lastActiveDate) {
      lastActiveAt = new Date(u.userProfile.lastActiveDate).toISOString();
    }

    const createdAt =
      u.userProfile?.createdAt?.toISOString() ??
      lastActiveAt ??
      new Date().toISOString();

    return {
      id: u.id,
      name: u.name,
      email: u.email,
      image: u.image,
      role: u.role,
      emailVerified: u.emailVerified !== null,
      provider: u.accounts[0]?.provider ?? null,
      totalAttempts,
      correctAttempts,
      accuracy:
        totalAttempts > 0
          ? Math.round((correctAttempts / totalAttempts) * 100)
          : null,
      reviewsCount: u.reviews.length,
      lastActiveAt,
      createdAt,
    };
  });
}

// ---------------------------------------------------------------------------
// Overview stats
// ---------------------------------------------------------------------------

export async function getUsersOverview(): Promise<UsersOverview> {
  await requireStudioAccess();

  try {
    const [totalUsers, roleGroups, totalAttempts, correctAttempts] =
      await Promise.all([
        db.user.count().catch(() => 0),
        db.user.groupBy({ by: ["role"], _count: { id: true } }).catch(() => []),
        db.attempt.count().catch(() => 0),
        db.attempt.count({ where: { isCorrect: true } }).catch(() => 0),
      ]);

    let activeToday = 0;
    let activeThisWeek = 0;

    try {
      const todayActiveStr = await db.$queryRaw<{ count: bigint }[]>`
         SELECT COUNT(DISTINCT "userBucket") as count
         FROM attempts
         WHERE "createdAt" >= NOW() - INTERVAL '24 hours'
      `;
      activeToday = Number(todayActiveStr[0]?.count ?? 0);
    } catch {}

    try {
      const weekActiveStr = await db.$queryRaw<{ count: bigint }[]>`
         SELECT COUNT(DISTINCT "userBucket") as count
         FROM attempts
         WHERE "createdAt" >= NOW() - INTERVAL '7 days'
      `;
      activeThisWeek = Number(weekActiveStr[0]?.count ?? 0);
    } catch {}

    return {
      totalUsers,
      byRole: roleGroups.map((g) => ({ role: g.role, count: g._count.id })),
      activeToday,
      activeThisWeek,
      totalAttempts,
      overallAccuracy:
        totalAttempts > 0
          ? Math.round((correctAttempts / totalAttempts) * 100)
          : null,
    };
  } catch (err) {
    console.warn("[StudioUsers] getUsersOverview error:", err);
    return {
      totalUsers: 0,
      byRole: [],
      activeToday: 0,
      activeThisWeek: 0,
      totalAttempts: 0,
      overallAccuracy: null,
    };
  }
}

// ---------------------------------------------------------------------------
// Update user role
// ---------------------------------------------------------------------------

export async function updateUserRole(
  userId: string,
  newRole: string
): Promise<{ ok: boolean }> {
  await requireAdminAccess("ليس لديك صلاحية لإدارة المستخدمين");

  const validRoles = ["student", "admin", "editor", "reviewer"];
  if (!validRoles.includes(newRole)) {
    throw new Error("الدور غير صالح");
  }

  await db.user.update({
    where: { id: userId },
    data: { role: newRole },
  });

  return { ok: true };
}

// ---------------------------------------------------------------------------
// Delete user + all related data
// ---------------------------------------------------------------------------

export async function deleteUser(
  userId: string
): Promise<{ deleted: boolean }> {
  await requireAdminAccess("ليس لديك صلاحية لإدارة المستخدمين");

  // Delete all user-related data
  await db.attempt.deleteMany({ where: { userBucket: userId } });
  await db.favorite.deleteMany({ where: { userBucket: userId } });
  await db.reviewSchedule.deleteMany({ where: { userBucket: userId } });
  await db.contentReview.deleteMany({ where: { reviewerId: userId } });
  await db.session.deleteMany({ where: { userId } });
  await db.account.deleteMany({ where: { userId } });

  // Delete UserProfile if it exists
  await db.userProfile.deleteMany({ where: { userBucket: userId } });

  await db.user.delete({ where: { id: userId } });

  return { deleted: true };
}
