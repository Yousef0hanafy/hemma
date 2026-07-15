"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import ReactMarkdown from "react-markdown";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Skeleton } from "@/components/ui/skeleton";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import {
  getSuggestions,
  getChatSessions,
  createChatSession,
  getChatSession as fetchChatSession,
  deleteChatSession,
  saveChatMessage,
  updateChatSessionTitle,
} from "@/server/actions/studio-chat";
import type { ChatMessage, Suggestion } from "@/server/actions/studio-chat";
import {
  BrainCircuit,
  Send,
  Sparkles,
  Loader2,
  Trash2,
  User as UserIcon,
  Bot,
  Lightbulb,
  Plus,
  MessageSquare,
  Clock,
  ChevronLeft,
  PanelLeftOpen,
  PanelLeftClose,
} from "lucide-react";

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const SUGGESTIONS = getSuggestions();

// ---------------------------------------------------------------------------
// Helper — format markdown content for better display
// ---------------------------------------------------------------------------

function ChatMessageBubble({
  message,
  isStreaming,
}: {
  message: ChatMessage;
  isStreaming?: boolean;
}) {
  const isUser = message.role === "user";

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.25, ease: "easeOut" }}
      className={cn("flex gap-3 w-full", isUser ? "flex-row-reverse" : "")}
    >
      {/* Avatar */}
      <div
        className={cn(
          "shrink-0 w-8 h-8 rounded-full flex items-center justify-center mt-0.5",
          isUser
            ? "bg-violet-100 text-violet-600 dark:bg-violet-900 dark:text-violet-300"
            : "bg-emerald-100 text-emerald-600 dark:bg-emerald-900 dark:text-emerald-300"
        )}
      >
        {isUser ? <UserIcon className="h-4 w-4" /> : <Bot className="h-4 w-4" />}
      </div>

      {/* Bubble */}
      <div
        className={cn(
          "max-w-[80%] rounded-2xl px-4 py-2.5 text-sm leading-relaxed",
          isUser
            ? "bg-violet-500 text-white rounded-tr-md"
            : "bg-muted/70 text-foreground rounded-tr-md"
        )}
      >
        {isUser ? (
          <p className="whitespace-pre-wrap">{message.content}</p>
        ) : (
          <div className="prose prose-sm dark:prose-invert max-w-none rtl">
            <ReactMarkdown
              components={{
                a: ({ href, children }) => (
                  <a
                    href={href}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-emerald-600 dark:text-emerald-400 underline"
                  >
                    {children}
                  </a>
                ),
                code: ({ className, children, ...props }) => {
                  const isInline = !className;
                  if (isInline) {
                    return (
                      <code
                        className="bg-muted-foreground/10 rounded px-1 py-0.5 text-xs font-mono"
                        {...props}
                      >
                        {children}
                      </code>
                    );
                  }
                  return (
                    <pre className="bg-muted rounded-lg p-3 overflow-x-auto text-xs">
                      <code className={className} {...props}>
                        {children}
                      </code>
                    </pre>
                  );
                },
              }}
            >
              {message.content}
            </ReactMarkdown>
            {isStreaming && (
              <span className="inline-flex gap-0.5 mt-1">
                <span
                  className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-bounce"
                  style={{ animationDelay: "0ms" }}
                />
                <span
                  className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-bounce"
                  style={{ animationDelay: "150ms" }}
                />
                <span
                  className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-bounce"
                  style={{ animationDelay: "300ms" }}
                />
              </span>
            )}
          </div>
        )}
      </div>
    </motion.div>
  );
}

// ---------------------------------------------------------------------------
// Suggestion chip
// ---------------------------------------------------------------------------

function SuggestionChip({
  suggestion,
  onClick,
}: {
  suggestion: Suggestion;
  onClick: (prompt: string) => void;
}) {
  return (
    <motion.button
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      whileHover={{ scale: 1.02 }}
      whileTap={{ scale: 0.98 }}
      onClick={() => onClick(suggestion.prompt)}
      className="flex items-center gap-2 px-3 py-2 rounded-xl border border-border/60 bg-muted/30 hover:bg-muted/60 hover:border-border transition-all text-right text-xs group"
    >
      <Lightbulb className="h-3.5 w-3.5 text-amber-500 shrink-0" />
      <span className="font-medium">{suggestion.label}</span>
    </motion.button>
  );
}

// ---------------------------------------------------------------------------
// Session sidebar item
// ---------------------------------------------------------------------------

function SessionItem({
  session,
  active,
  onSelect,
  onDelete,
}: {
  session: { id: string; title: string; updatedAt: Date; messageCount: number };
  active: boolean;
  onSelect: (id: string) => void;
  onDelete: (id: string) => void;
}) {
  return (
    <motion.button
      initial={{ opacity: 0, x: -8 }}
      animate={{ opacity: 1, x: 0 }}
      whileTap={{ scale: 0.98 }}
      onClick={() => onSelect(session.id)}
      className={cn(
        "w-full text-right px-3 py-2.5 rounded-lg text-sm transition-all group relative",
        active
          ? "bg-primary/10 text-primary font-medium"
          : "hover:bg-muted/60 text-muted-foreground hover:text-foreground"
      )}
    >
      <div className="flex items-center gap-2">
        <MessageSquare className="h-3.5 w-3.5 shrink-0 opacity-60" />
        <span className="truncate flex-1">{session.title}</span>
        {active && (
          <span className="shrink-0">
            <ChevronLeft className="h-3.5 w-3.5" />
          </span>
        )}
      </div>
      <div className="flex items-center gap-2 mt-1 mr-5">
        <Clock className="h-3 w-3 opacity-40" />
        <span className="text-[10px] opacity-40">
          {timeAgo(session.updatedAt)}
        </span>
        <span className="text-[10px] opacity-30">·</span>
        <span className="text-[10px] opacity-40">
          {session.messageCount} رسالة
        </span>
      </div>

      {/* Delete button on hover */}
      <button
        onClick={(e) => {
          e.stopPropagation();
          onDelete(session.id);
        }}
        className="absolute left-2 top-1/2 -translate-y-1/2 opacity-0 group-hover:opacity-100 hover:text-rose-500 transition-opacity"
      >
        <Trash2 className="h-3.5 w-3.5" />
      </button>
    </motion.button>
  );
}

// ---------------------------------------------------------------------------
// Time helper
// ---------------------------------------------------------------------------

function timeAgo(date: Date): string {
  const diff = Date.now() - new Date(date).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "الآن";
  if (mins < 60) return `منذ ${mins} د`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `منذ ${hours} س`;
  const days = Math.floor(hours / 24);
  if (days < 7) return `منذ ${days} ي`;
  return date.toLocaleDateString("ar-SA");
}

// ---------------------------------------------------------------------------
// Main Chat Component
// ---------------------------------------------------------------------------

export function StudioChatClient() {
  // ── State ─────────────────────────────────────────────────────
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState("");
  const [sending, setSending] = useState(false);
  const [streamingMessage, setStreamingMessage] = useState(false);

  // Session state
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [sessions, setSessions] = useState<
    Array<{ id: string; title: string; updatedAt: Date; messageCount: number }>
  >([]);
  const [loadingSessions, setLoadingSessions] = useState(true);
  const [loadingMessages, setLoadingMessages] = useState(false);
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [initialLoadDone, setInitialLoadDone] = useState(false);

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // Track whether we've auto-titled the session
  const hasAutoTitled = useRef(false);

  // ── Load sessions on mount ────────────────────────────────────

  useEffect(() => {
    (async () => {
      try {
        const list = await getChatSessions();
        setSessions(list);

        if (list.length > 0) {
          // Load the most recent session
          await loadSession(list[0].id);
        }
      } catch {
        // Not authenticated or error — show empty state
      } finally {
        setLoadingSessions(false);
        setInitialLoadDone(true);
      }
    })();
  }, []);

  // ── Auto-scroll ───────────────────────────────────────────────

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, streamingMessage]);

  // ── Focus on mount ────────────────────────────────────────────

  useEffect(() => {
    if (!loadingMessages) {
      inputRef.current?.focus();
    }
  }, [loadingMessages]);

  // ── Load a session ────────────────────────────────────────────

  const loadSession = useCallback(async (id: string) => {
    setLoadingMessages(true);
    setStreamingMessage(false);
    setSending(false);

    try {
      const session = await fetchChatSession(id);
      if (session) {
        setSessionId(session.id);
        setMessages(session.messages);
        hasAutoTitled.current = session.messages.length > 0;
      }
    } catch {
      toast.error("فشل تحميل المحادثة");
    } finally {
      setLoadingMessages(false);
    }
  }, []);

  // ── Refresh session list ──────────────────────────────────────

  const refreshSessions = useCallback(async () => {
    try {
      const list = await getChatSessions();
      setSessions(list);
    } catch {
      // silent
    }
  }, []);

  // ── New chat ──────────────────────────────────────────────────

  const handleNewChat = useCallback(async () => {
    try {
      const { id } = await createChatSession();
      setSessionId(id);
      setMessages([]);
      setInput("");
      hasAutoTitled.current = false;
      await refreshSessions();
      inputRef.current?.focus();
    } catch {
      toast.error("فشل إنشاء محادثة جديدة");
    }
  }, [refreshSessions]);

  // ── Select a session ──────────────────────────────────────────

  const handleSelectSession = useCallback(
    async (id: string) => {
      if (id === sessionId) return;
      await loadSession(id);
    },
    [sessionId, loadSession]
  );

  // ── Delete a session ──────────────────────────────────────────

  const handleDeleteSession = useCallback(
    async (id: string) => {
      try {
        await deleteChatSession(id);
        setSessions((prev) => prev.filter((s) => s.id !== id));

        if (id === sessionId) {
          // If we deleted the active session, switch to another or create new
          const remaining = sessions.filter((s) => s.id !== id);
          if (remaining.length > 0) {
            await loadSession(remaining[0].id);
          } else {
            setSessionId(null);
            setMessages([]);
            hasAutoTitled.current = false;
          }
        }

        toast.success("تم حذف المحادثة");
      } catch {
        toast.error("فشل حذف المحادثة");
      }
    },
    [sessionId, sessions, loadSession]
  );

  // ── Core send function — streams tokens via SSE ───────────────

  const send = useCallback(
    async (text: string) => {
      if (!text.trim() || sending) return;

      // Ensure we have an active session
      let activeSessionId = sessionId;
      if (!activeSessionId) {
        try {
          const { id } = await createChatSession();
          activeSessionId = id;
          setSessionId(id);
          await refreshSessions();
        } catch {
          toast.error("فشل إنشاء المحادثة");
          return;
        }
      }

      // Save user message
      try {
        await saveChatMessage(activeSessionId, "user", text);
      } catch {
        // silent — UI still shows the message
      }

      // Auto-title from first user message
      if (!hasAutoTitled.current && text.trim().length > 3) {
        hasAutoTitled.current = true;
        updateChatSessionTitle(activeSessionId, text).then(() => refreshSessions());
      }

      const userMessage: ChatMessage = { role: "user", content: text };
      setMessages((prev) => [...prev, userMessage]);
      setInput("");
      setSending(true);
      setStreamingMessage(true);

      // Add a placeholder assistant message that tokens will stream into
      setMessages((prev) => [...prev, { role: "assistant", content: "" }]);

      let assistantContent = "";

      try {
        const response = await fetch("/api/studio/chat/stream", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ history: messages, message: text }),
        });

        if (!response.ok) {
          throw new Error(`HTTP ${response.status}`);
        }

        const reader = response.body!.getReader();
        const decoder = new TextDecoder();
        let buffer = "";

        while (true) {
          const { done, value } = await reader.read();
          if (done) break;

          buffer += decoder.decode(value, { stream: true });
          const lines = buffer.split("\n");
          buffer = lines.pop() || "";

          for (const line of lines) {
            if (!line.trim()) continue;
            try {
              const parsed = JSON.parse(line);
              if (parsed.type === "chunk" && parsed.text) {
                assistantContent += parsed.text;
                setMessages((prev) => {
                  const updated = [...prev];
                  const lastIdx = updated.length - 1;
                  if (updated[lastIdx]?.role === "assistant") {
                    updated[lastIdx] = {
                      ...updated[lastIdx],
                      content: updated[lastIdx].content + parsed.text,
                    };
                  }
                  return updated;
                });
              } else if (parsed.type === "error") {
                assistantContent = `⚠️ **خطأ:** ${parsed.error}\n\nتأكد من ضبط مفتاح Gemini في المتغيرات البيئية.`;
                setMessages((prev) => {
                  const updated = [...prev];
                  const lastIdx = updated.length - 1;
                  if (updated[lastIdx]?.role === "assistant") {
                    updated[lastIdx] = {
                      ...updated[lastIdx],
                      content: assistantContent,
                    };
                  }
                  return updated;
                });
              }
            } catch {
              // Skip malformed JSON lines
            }
          }
        }

        // Save assistant message after streaming completes
        if (assistantContent && activeSessionId) {
          try {
            await saveChatMessage(activeSessionId, "assistant", assistantContent);
            await refreshSessions();
          } catch {
            // silent
          }
        }
      } catch (e) {
        const errorText = "⚠️ **خطأ في الاتصال.** يرجى المحاولة مرة أخرى.";
        assistantContent = errorText;
        setMessages((prev) => {
          const updated = [...prev];
          const lastIdx = updated.length - 1;
          if (updated[lastIdx]?.role === "assistant") {
            updated[lastIdx] = {
              ...updated[lastIdx],
              content: errorText,
            };
          }
          return updated;
        });
        toast.error("فشل إرسال الرسالة. تحقق من الاتصال");
      } finally {
        setSending(false);
        setStreamingMessage(false);
      }
    },
    [messages, sending, sessionId, refreshSessions]
  );

  const handleSend = useCallback(() => send(input), [input, send]);

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === "Enter" && !e.shiftKey) {
        e.preventDefault();
        handleSend();
      }
    },
    [handleSend]
  );

  const handleClear = useCallback(async () => {
    await handleNewChat();
  }, [handleNewChat]);

  const handleSuggestion = useCallback(
    (prompt: string) => {
      setInput(prompt);
      send(prompt);
    },
    [send]
  );

  // ── Loading state (initial) ───────────────────────────────────

  if (loadingSessions || !initialLoadDone) {
    return (
      <div className="flex items-center justify-center h-[60vh]">
        <div className="flex flex-col items-center gap-3">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
          <p className="text-sm text-muted-foreground">جاري تحميل المحادثات...</p>
        </div>
      </div>
    );
  }

  // ── Render ────────────────────────────────────────────────────

  return (
    <div className="flex gap-4 h-[calc(100vh-6rem)]">
      {/* ── Session sidebar ──────────────────────────────────────── */}
      <motion.aside
        initial={false}
        animate={{
          width: sidebarOpen ? 260 : 0,
          opacity: sidebarOpen ? 1 : 0,
          marginLeft: sidebarOpen ? 0 : -8,
        }}
        transition={{ duration: 0.2, ease: "easeInOut" }}
        className="shrink-0 overflow-hidden"
      >
        <div className="w-[260px] h-full flex flex-col bg-muted/20 rounded-xl border border-border/50">
          {/* Sidebar header */}
          <div className="flex items-center justify-between px-3 pt-3 pb-2">
            <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
              المحادثات
            </h3>
            <Button
              variant="ghost"
              size="icon"
              onClick={() => setSidebarOpen(false)}
              className="h-6 w-6"
            >
              <PanelLeftClose className="h-3.5 w-3.5" />
            </Button>
          </div>

          {/* New chat button */}
          <div className="px-3 pb-2">
            <Button
              variant="outline"
              size="sm"
              onClick={handleNewChat}
              className="w-full gap-1.5 text-xs h-8"
            >
              <Plus className="h-3.5 w-3.5" />
              محادثة جديدة
            </Button>
          </div>

          {/* Session list */}
          <ScrollArea className="flex-1 px-1">
            <div className="space-y-0.5">
              {sessions.length === 0 ? (
                <p className="text-xs text-muted-foreground text-center py-8 px-3">
                  لا توجد محادثات سابقة
                </p>
              ) : (
                sessions.map((s) => (
                  <SessionItem
                    key={s.id}
                    session={s}
                    active={s.id === sessionId}
                    onSelect={handleSelectSession}
                    onDelete={handleDeleteSession}
                  />
                ))
              )}
            </div>
          </ScrollArea>
        </div>
      </motion.aside>

      {/* ── Main chat area ───────────────────────────────────────── */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* Chat header */}
        <div className="flex items-center justify-between mb-3 shrink-0">
          <div className="flex items-center gap-2">
            {/* Open sidebar button (when closed) */}
            {!sidebarOpen && (
              <Button
                variant="ghost"
                size="icon"
                onClick={() => setSidebarOpen(true)}
                className="h-7 w-7"
              >
                <PanelLeftOpen className="h-3.5 w-3.5" />
              </Button>
            )}
            <BrainCircuit className="h-5 w-5 text-emerald-500" />
            <h1 className="text-lg font-bold">المساعد الذكي</h1>
            <Sparkles className="h-3.5 w-3.5 text-amber-400" />
          </div>
          <div className="flex items-center gap-2">
            {sessionId && (
              <span className="text-[10px] text-muted-foreground bg-muted/50 px-2 py-0.5 rounded-full">
                {sessions.find((s) => s.id === sessionId)?.title?.slice(0, 20) ?? "..."}
              </span>
            )}
            <Button
              variant="ghost"
              size="sm"
              onClick={handleClear}
              className="text-xs text-muted-foreground"
            >
              <Plus className="h-3.5 w-3.5 ml-1" />
              جديد
            </Button>
          </div>
        </div>

        {/* Loading messages state */}
        {loadingMessages ? (
          <div className="flex-1 flex items-center justify-center">
            <div className="flex flex-col items-center gap-3">
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
              <p className="text-sm text-muted-foreground">جاري تحميل المحادثة...</p>
            </div>
          </div>
        ) : messages.length === 0 ? (
          /* ── Empty state ─────────────────────────────────── */
          <div className="flex-1 flex flex-col items-center justify-center space-y-6 max-w-xl mx-auto w-full px-4">
            <Card className="border-emerald-200 dark:border-emerald-800 bg-emerald-50/50 dark:bg-emerald-950/20 w-full">
              <CardContent className="p-6 text-center">
                <div className="w-16 h-16 rounded-2xl bg-emerald-100 dark:bg-emerald-900 flex items-center justify-center mx-auto mb-4">
                  <BrainCircuit className="h-8 w-8 text-emerald-500" />
                </div>
                <h2 className="text-lg font-semibold mb-2">
                  مرحباً بك في المساعد الذكي
                </h2>
                <p className="text-sm text-muted-foreground max-w-md mx-auto mb-6">
                  يمكنك سؤال المساعد عن تحليل الأسئلة، اقتراح تحسينات،
                  معايير الجودة، أو أي استفسار متعلق بالمحتوى التعليمي
                </p>
                <div className="flex flex-wrap justify-center gap-2 max-w-lg mx-auto">
                  {SUGGESTIONS.map((s) => (
                    <SuggestionChip
                      key={s.label}
                      suggestion={s}
                      onClick={handleSuggestion}
                    />
                  ))}
                </div>
              </CardContent>
            </Card>
          </div>
        ) : (
          /* ── Messages view ──────────────────────────────── */
          <div className="flex-1 overflow-y-auto space-y-4 pb-4 scroll-smooth">
            <AnimatePresence initial={false}>
              {messages.map((msg, i) => (
                <ChatMessageBubble
                  key={i}
                  message={msg}
                  isStreaming={
                    msg.role === "assistant" &&
                    i === messages.length - 1 &&
                    streamingMessage
                  }
                />
              ))}
            </AnimatePresence>

            {streamingMessage && (
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                className="flex items-center gap-2 text-xs text-muted-foreground pr-11"
              >
                <Loader2 className="h-3 w-3 animate-spin" />
                جاري الكتابة...
              </motion.div>
            )}

            <div ref={messagesEndRef} />
          </div>
        )}

        {/* ── Input area ──────────────────────────────────── */}
        {!loadingMessages && (
          <div className="flex items-center gap-2 pt-3 border-t border-border/50 shrink-0">
            <Input
              ref={inputRef}
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="اكتب رسالتك هنا..."
              className="h-12 text-sm px-4 rounded-xl"
              dir="rtl"
              disabled={sending}
            />
            <Button
              onClick={handleSend}
              disabled={sending || !input.trim() || loadingMessages}
              size="icon"
              className="h-12 w-12 rounded-xl shrink-0"
            >
              {sending ? (
                <Loader2 className="h-5 w-5 animate-spin" />
              ) : (
                <Send className="h-5 w-5" />
              )}
            </Button>
          </div>
        )}
      </div>
    </div>
  );
}
