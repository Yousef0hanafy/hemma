"use server";

import { db } from "@/lib/db";
import { requireStudioAccess } from "@/lib/studio-auth";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface SidebarBadgeCounts {
  failedAiToday: number;
  reviewQueueCount: number;
  totalQuestions: number;
  nonAdminUsers: number;
  totalSources: number;
}

// ---------------------------------------------------------------------------
// Individual badge queries
// ---------------------------------------------------------------------------

/** Count questions with status "review" for the sidebar badge */
export async function getReviewQueueCount(): Promise<number> {
  await requireStudioAccess();
  return db.question.count({ where: { status: "review" } });
}

/** Count total questions in the database for the sidebar badge */
export async function getTotalQuestionCount(): Promise<number> {
  await requireStudioAccess();
  return db.question.count();
}

/** Count non-admin users for the sidebar badge */
export async function getNonAdminUserCount(): Promise<number> {
  await requireStudioAccess();
  return db.user.count({ where: { role: { not: "admin" } } });
}

/** Count total sources for the sidebar badge */
export async function getSourceCount(): Promise<number> {
  await requireStudioAccess();
  return db.source.count();
}

// ---------------------------------------------------------------------------
// Consolidated query
// ---------------------------------------------------------------------------

/** Single consolidated query for all sidebar badge counts — runs all 5 in parallel */
export async function getSidebarBadgeCounts(): Promise<SidebarBadgeCounts> {
  await requireStudioAccess();

  const now = new Date();
  const last24h = new Date(now.getTime() - 24 * 60 * 60 * 1000);

  const [
    failedAiToday,
    reviewQueueCount,
    totalQuestions,
    nonAdminUsers,
    totalSources,
  ] = await Promise.all([
    db.aIProcessingLog.count({
      where: { createdAt: { gte: last24h }, status: "failed" },
    }),
    db.question.count({ where: { status: "review" } }),
    db.question.count(),
    db.user.count({ where: { role: { not: "admin" } } }),
    db.source.count(),
  ]);

  return {
    failedAiToday,
    reviewQueueCount,
    totalQuestions,
    nonAdminUsers,
    totalSources,
  };
}
