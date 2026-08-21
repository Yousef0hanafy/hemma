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
    },
  });

  // Get attempt stats by userBucket
  const attemptGroups = await db.attempt.groupBy({
    by: ["userBucket"],
    _count: { _all: true },
  });

  // Get correct counts
  const correctCounts = await db.attempt.groupBy({
    by: ["userBucket"],
    where: { isCorrect: true },
    _count: true,
  });

  const attemptCountMap = new Map(
    attemptGroups.map((g) => [g.userBucket, g._count._all ?? 0])
  );
  const correctCountMap = new Map(
    correctCounts.map((g) => [g.userBucket, typeof g._count === "number" ? g._count : 0])
  );

  // Get last active per user (latest attempt date)
  // Use unquoted identifiers to avoid PostgreSQL case-sensitivity with node-postgres
  const lastActiveResults = await db.$queryRawUnsafe<{ userbucket: string; maxdate: Date }[]>(
    `SELECT "userBucket", MAX("createdAt") as maxdate
     FROM attempts
     GROUP BY "userBucket"`
  );
  const lastActiveMap = new Map(
    lastActiveResults.map((r) => [r.userbucket, r.maxdate.toISOString()])
  );

  return users.map((u) => {
    const totalAttempts = attemptCountMap.get(u.id) ?? 0;
    const correctAttempts = correctCountMap.get(u.id) ?? 0;

    return {
      id: u.id,
      name: u.name,
      email: u.email,
      image: u.image,
      role: u.role,
      emailVerified: u.emailVerified !== null,
      provider: null,
      totalAttempts: Number(totalAttempts),
      correctAttempts: Number(correctAttempts),
      accuracy:
        Number(totalAttempts) > 0
          ? Math.round((Number(correctAttempts) / Number(totalAttempts)) * 100)
          : null,
      reviewsCount: 0,
      lastActiveAt: lastActiveMap.get(u.id) ?? null,
      createdAt: new Date().toISOString(),
    };
  });
}

// ---------------------------------------------------------------------------
// Overview stats
// ---------------------------------------------------------------------------

export async function getUsersOverview(): Promise<UsersOverview> {
  await requireStudioAccess();

  const [totalUsers, roleGroups, totalAttempts, correctAttempts, todayActiveStr, weekActiveStr] =
    await Promise.all([
      db.user.count(),
      db.user.groupBy({ by: ["role"], _count: true }),
      db.attempt.count(),
      db.attempt.count({ where: { isCorrect: true } }),
      db.$queryRawUnsafe<{ count: bigint }[]>(
        `SELECT COUNT(DISTINCT "userBucket") as count
         FROM attempts
         WHERE "createdAt" >= NOW() - INTERVAL '24 hours'`
      ),
      db.$queryRawUnsafe<{ count: bigint }[]>(
        `SELECT COUNT(DISTINCT "userBucket") as count
         FROM attempts
         WHERE "createdAt" >= NOW() - INTERVAL '7 days'`
      ),
    ]);

  const activeToday = Number(todayActiveStr[0]?.count ?? 0n);
  const activeThisWeek = Number(weekActiveStr[0]?.count ?? 0n);

  return {
    totalUsers,
    byRole: roleGroups.map((g) => ({ role: g.role, count: g._count })),
    activeToday,
    activeThisWeek,
    totalAttempts,
    overallAccuracy:
      totalAttempts > 0
        ? Math.round((correctAttempts / totalAttempts) * 100)
        : null,
  };
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
