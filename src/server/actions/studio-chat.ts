"use server";

import { db } from "@/lib/db";
import { requireStudioAccess } from "@/lib/studio-auth";

// ---------------------------------------------------------------------------
// Chat history type
// ---------------------------------------------------------------------------

export interface ChatMessage {
  role: "user" | "assistant";
  content: string;
}

// ---------------------------------------------------------------------------
// Session persistence — save & load chat sessions
// ---------------------------------------------------------------------------

/// Get all sessions for the current user (title + timestamp only, no messages)
export async function getChatSessions(): Promise<
  Array<{ id: string; title: string; updatedAt: Date; messageCount: number }>
> {
  const userId = await requireStudioAccess();

  const sessions = await db.chatSession.findMany({
    where: { userId },
    orderBy: { updatedAt: "desc" },
    include: { _count: { select: { messages: true } } },
  });

  return sessions.map((s) => ({
    id: s.id,
    title: s.title,
    updatedAt: s.updatedAt,
    messageCount: s._count.messages,
  }));
}

/// Create a new chat session
export async function createChatSession(): Promise<{ id: string }> {
  const userId = await requireStudioAccess();

  const session = await db.chatSession.create({
    data: { userId },
  });

  return { id: session.id };
}

/// Load a session with all its messages (ordered by creation time)
export async function getChatSession(id: string): Promise<{
  id: string;
  title: string;
  messages: ChatMessage[];
} | null> {
  const userId = await requireStudioAccess();

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

/// Delete a session and all its messages
export async function deleteChatSession(id: string): Promise<void> {
  const userId = await requireStudioAccess();

  const session = await db.chatSession.findUnique({ where: { id } });
  if (!session || session.userId !== userId) throw new Error("غير مصرح به");

  await db.chatSession.delete({ where: { id } });
}

/// Save a message to a session (user must own the session)
export async function saveChatMessage(
  sessionId: string,
  role: "user" | "assistant",
  content: string
): Promise<void> {
  const userId = await requireStudioAccess();

  // Verify ownership
  const session = await db.chatSession.findUnique({
    where: { id: sessionId },
    select: { userId: true },
  });
  if (!session || session.userId !== userId) throw new Error("غير مصرح به");

  await db.chatMessage.create({
    data: { sessionId, role, content },
  });

  // Touch updatedAt so session appears at top of list
  await db.chatSession.update({
    where: { id: sessionId },
    data: { updatedAt: new Date() },
  });
}

/// Auto-generate title from first user message
async function autoTitle(text: string): Promise<string> {
  const cleaned = text.replace(/[\n\r]+/g, " ").slice(0, 50);
  if (cleaned.length <= 3) return "محادثة جديدة";
  return cleaned.length > 40 ? cleaned.slice(0, 40) + "…" : cleaned;
}

export async function updateChatSessionTitle(
  sessionId: string,
  firstMessage: string
): Promise<void> {
  const userId = await requireStudioAccess();

  const session = await db.chatSession.findUnique({
    where: { id: sessionId },
    select: { userId: true },
  });
  if (!session || session.userId !== userId) throw new Error("غير مصرح به");

  const title = await autoTitle(firstMessage);
  await db.chatSession.update({
    where: { id: sessionId },
    data: { title },
  });
}
