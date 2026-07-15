"use server";

import { db } from "@/lib/db";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";

// ---------------------------------------------------------------------------
// Auth
// ---------------------------------------------------------------------------

async function requireReviewer(): Promise<string> {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    throw new Error("يجب تسجيل الدخول أولاً");
  }
  return session.user.id;
}

// ---------------------------------------------------------------------------
// DTOs
// ---------------------------------------------------------------------------

export interface ReviewQueueEntry {
  id: string;
  questionId: string;
  stem: string;
  categoryNameAr: string;
  difficulty: string;
  status: string;
  aiQualityScore: number | null;
  aiWarning: string | null;
  waitingDays: number;
  previousReviews: number;
  createdAt: Date;
}

export interface ReviewQuestionDetail {
  id: string;
  stem: string;
  options: { key: string; text: string }[];
  correctKey: string;
  explanation: string | null;
  studyTip: string | null;
  difficulty: string;
  categoryNameAr: string;
  sourceTitle: string;
  status: string;
  aiQualityScore: number | null;
  previousReviews: {
    action: string;
    notes: string | null;
    reviewerName: string | null;
    createdAt: Date;
  }[];
}

export interface ReviewStats {
  pending: number;
  approved: number;
  rejected: number;
  flagged: number;
}

// ---------------------------------------------------------------------------
// Fetch review queue
// ---------------------------------------------------------------------------

export async function getReviewQueue(
  tab: string = "all"
): Promise<ReviewQueueEntry[]> {
  await requireReviewer();

  const where: Record<string, unknown> = {};

  switch (tab) {
    case "pending":
      where.status = { in: ["draft", "review"] };
      break;
    case "approved":
      where.status = "approved";
      break;
    case "rejected":
      where.status = "draft";
      // This is approximate — rejected questions go to draft.
      // We can refine by checking if they have a "rejected" ContentReview
      break;
    case "flagged":
      where.status = { in: ["draft", "review"] };
      where.aiQualityScore = { lt: 0.6 };
      break;
    default:
      where.status = { in: ["draft", "review"] };
      break;
  }

  const questions = await db.question.findMany({
    where: where as any,
    include: {
      category: { select: { nameAr: true } },
      reviews: {
        orderBy: { createdAt: "desc" },
        take: 1,
        select: { action: true, createdAt: true },
      },
      _count: { select: { reviews: true } },
    },
    orderBy: [
      { aiQualityScore: "asc" },
      { createdAt: "asc" },
    ],
    take: 100,
  });

  return questions.map((q) => {
    const daysWaiting = Math.floor(
      (Date.now() - q.createdAt.getTime()) / (1000 * 60 * 60 * 24)
    );

    let aiWarning: string | null = null;
    if (q.aiQualityScore !== null && q.aiQualityScore < 0.5) {
      aiWarning = "جودة منخفضة — يُوصى بمراجعة دقيقة";
    } else if (q.aiQualityScore !== null && q.aiQualityScore < 0.7) {
      aiWarning = "جودة متوسطة — تحقق من المحتوى";
    }

    return {
      id: q.id,
      questionId: q.id,
      stem: q.stem.slice(0, 80),
      categoryNameAr: q.category.nameAr,
      difficulty: q.difficulty,
      status: q.status,
      aiQualityScore: q.aiQualityScore,
      aiWarning,
      waitingDays: daysWaiting,
      previousReviews: q._count.reviews,
      createdAt: q.createdAt,
    };
  });
}

// ---------------------------------------------------------------------------
// Fetch full question detail for review mode
// ---------------------------------------------------------------------------

export async function getReviewQuestion(
  questionId: string
): Promise<ReviewQuestionDetail | null> {
  await requireReviewer();

  const q = await db.question.findUnique({
    where: { id: questionId },
    include: {
      category: { select: { nameAr: true } },
      source: { select: { title: true } },
      reviews: {
        orderBy: { createdAt: "desc" },
        take: 5,
        include: {
          reviewer: { select: { name: true } },
        },
      },
    },
  });

  if (!q) return null;

  return {
    id: q.id,
    stem: q.stem,
    options: JSON.parse(q.options) as { key: string; text: string }[],
    correctKey: q.correctKey,
    explanation: q.explanation,
    studyTip: q.studyTip,
    difficulty: q.difficulty,
    categoryNameAr: q.category.nameAr,
    sourceTitle: q.source.title,
    status: q.status,
    aiQualityScore: q.aiQualityScore,
    previousReviews: q.reviews.map((r) => ({
      action: r.action,
      notes: r.notes,
      reviewerName: r.reviewer?.name ?? null,
      createdAt: r.createdAt,
    })),
  };
}

// ---------------------------------------------------------------------------
// Submit a review action
// ---------------------------------------------------------------------------

export async function submitReviewAction(
  questionId: string,
  action: "approved" | "rejected" | "approved_published",
  notes?: string
): Promise<{ success: boolean }> {
  const userId = await requireReviewer();

  // Determine new status based on action
  let newStatus: string;
  switch (action) {
    case "approved":
      newStatus = "approved";
      break;
    case "approved_published":
      newStatus = "published";
      break;
    case "rejected":
      newStatus = "draft";
      break;
    default:
      throw new Error("إجراء غير معروف");
  }

  // Create review record
  await db.contentReview.create({
    data: {
      questionId,
      reviewerId: userId,
      action,
      notes: notes ?? null,
    },
  });

  // Update question status
  await db.question.update({
    where: { id: questionId },
    data: { status: newStatus },
  });

  return { success: true };
}

// ---------------------------------------------------------------------------
// Review stats
// ---------------------------------------------------------------------------

export async function getReviewStats(): Promise<ReviewStats> {
  await requireReviewer();

  const [pending, approved, rejected, totalQuestions] = await Promise.all([
    db.question.count({ where: { status: { in: ["draft", "review"] } } }),
    db.question.count({ where: { status: "approved" } }),
    db.question.count({ where: { status: "draft" } }),
    db.question.count(),
  ]);

  const flagged = await db.question.count({
    where: {
      status: { in: ["draft", "review"] },
      aiQualityScore: { lt: 0.6 },
    },
  });

  return { pending, approved, rejected, flagged };
}
