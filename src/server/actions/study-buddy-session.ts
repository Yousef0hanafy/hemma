"use server";

import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { db } from "@/lib/db";

// ---------------------------------------------------------------------------
// Types (mirrors BuddyMessage from the client)
// ---------------------------------------------------------------------------

export interface BuddyMessage {
  role: "user" | "assistant";
  content: string;
  createdAt?: string | Date;
}

// ---------------------------------------------------------------------------
// Auth helper
// ---------------------------------------------------------------------------

async function requireUserId(): Promise<string> {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) throw new Error("غير مصرح به");
  return session.user.id;
}

// ---------------------------------------------------------------------------
// List all sessions for the current user
// ---------------------------------------------------------------------------

export async function getBuddySessions(): Promise<
  Array<{ id: string; title: string; updatedAt: Date; messageCount: number }>
> {
  const userId = await requireUserId();

  const sessions = await db.chatSession.findMany({
    where: { userId },
    orderBy: { updatedAt: "desc" },
    take: 50,
    include: { _count: { select: { messages: true } } },
  });

  return sessions.map((s) => ({
    id: s.id,
    title: s.title,
    updatedAt: s.updatedAt,
    messageCount: s._count.messages,
  }));
}

// ---------------------------------------------------------------------------
// Delete a session (user must own it)
// ---------------------------------------------------------------------------

export async function deleteBuddySession(id: string): Promise<void> {
  const userId = await requireUserId();
  const session = await db.chatSession.findUnique({ where: { id } });
  if (!session || session.userId !== userId) throw new Error("غير مصرح به");
  await db.chatSession.delete({ where: { id } });
}

// ---------------------------------------------------------------------------
// Rename a session explicitly (preserves full title, no truncation)
// ---------------------------------------------------------------------------

/// Rename a session — preserves the full title without truncation.
/// Use this when the user explicitly renames a session.
export async function renameBuddySession(
  sessionId: string,
  newTitle: string
): Promise<void> {
  const userId = await requireUserId();

  const session = await db.chatSession.findUnique({
    where: { id: sessionId },
    select: { userId: true },
  });
  if (!session || session.userId !== userId) throw new Error("غير مصرح به");

  const title = newTitle.trim().slice(0, 100) || "محادثة جديدة";

  await db.chatSession.update({
    where: { id: sessionId },
    data: { title },
  });
}
