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
// Create a new empty chat session
// ---------------------------------------------------------------------------

export async function createBuddySession(): Promise<{ id: string }> {
  const userId = await requireUserId();
  const session = await db.chatSession.create({
    data: { userId },
  });
  return { id: session.id };
}

// ---------------------------------------------------------------------------
// Load a session with all its messages
// ---------------------------------------------------------------------------

export async function getBuddySession(
  id: string
): Promise<{
  id: string;
  title: string;
  messages: BuddyMessage[];
} | null> {
  const userId = await requireUserId();

  const session = await db.chatSession.findUnique({
    where: { id },
    include: {
      messages: { orderBy: { createdAt: "asc" } },
    },
  });

  if (!session || session.userId !== userId) return null;

  return {
    id: session.id,
    title: session.title,
    messages: session.messages.map((m) => ({
      role: m.role as "user" | "assistant",
      content: m.content,
    })),
  };
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
// Save a single message to a session (user must own the session)
// ---------------------------------------------------------------------------

export async function saveBuddyMessage(
  sessionId: string,
  role: "user" | "assistant",
  content: string
): Promise<void> {
  const userId = await requireUserId();

  const session = await db.chatSession.findUnique({
    where: { id: sessionId },
    select: { userId: true },
  });
  if (!session || session.userId !== userId) throw new Error("غير مصرح به");

  await db.chatMessage.create({
    data: { sessionId, role, content },
  });

  // Touch updatedAt so session appears at top of the list
  await db.chatSession.update({
    where: { id: sessionId },
    data: { updatedAt: new Date() },
  });
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

// ---------------------------------------------------------------------------
// Auto-generate a short title from the first user message
// (truncates to ~40 chars for sidebar display)
// ---------------------------------------------------------------------------

export async function updateBuddySessionTitle(
  sessionId: string,
  firstMessage: string
): Promise<void> {
  const userId = await requireUserId();

  const session = await db.chatSession.findUnique({
    where: { id: sessionId },
    select: { userId: true },
  });
  if (!session || session.userId !== userId) throw new Error("غير مصرح به");

  const cleaned = firstMessage.replace(/[\n\r]+/g, " ").slice(0, 50);
  const title =
    cleaned.length > 40 ? cleaned.slice(0, 40) + "…" : cleaned || "محادثة جديدة";

  await db.chatSession.update({
    where: { id: sessionId },
    data: { title },
  });
}
