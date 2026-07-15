"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useViewStore } from "@/lib/store/view-store";
import type { BuddyMessage } from "@/server/actions/study-buddy-session";
import { getBuddySessions, deleteBuddySession, renameBuddySession } from "@/server/actions/study-buddy-session";
import { cn } from "@/lib/utils";
import { FullScreenLoader } from "./LoadingStates";
import {
  Bot,
  Send,
  ChevronLeft,
  Sparkles,
  BookOpen,
  Lightbulb,
  Loader2,
  MessageSquare,
  RefreshCw,
  History,
  Trash2,
  Plus,
  X,
  Check,
  Pencil,
} from "lucide-react";

// ---------------------------------------------------------------------------
// LocalStorage key for persisting the active session ID across page refreshes
// ---------------------------------------------------------------------------

const LS_SESSION_KEY = "hemma_study_buddy_session";

// ---------------------------------------------------------------------------
// Suggested starter questions
// ---------------------------------------------------------------------------

const SUGGESTIONS = [
  {
    icon: <Lightbulb className="h-3.5 w-3.5" />,
    text: "اشرح لي التناظر اللفظي مع أمثلة",
  },
  {
    icon: <BookOpen className="h-3.5 w-3.5" />,
    text: "كيف أفرّق بين إكمال الجمل والخطأ السياقي؟",
  },
  {
    icon: <Sparkles className="h-3.5 w-3.5" />,
    text: "أعطني نصائح للمذاكرة الفعالة",
  },
  {
    icon: <MessageSquare className="h-3.5 w-3.5" />,
    text: "وش معنى كلمة 'بَدِيهَة'؟",
  },
];

// ---------------------------------------------------------------------------
// Session storage helpers (sequential to avoid concurrent localStorage hits)
// ---------------------------------------------------------------------------

function loadSessionId(): string | null {
  try {
    return localStorage.getItem(LS_SESSION_KEY);
  } catch {
    return null;
  }
}

function saveSessionIdToStorage(id: string | null) {
  try {
    if (id) {
      localStorage.setItem(LS_SESSION_KEY, id);
    } else {
      localStorage.removeItem(LS_SESSION_KEY);
    }
  } catch {
    // localStorage may be unavailable (private browsing, etc.)
  }
}

// ---------------------------------------------------------------------------
// Relative time helper (Arabic)
// ---------------------------------------------------------------------------

function relativeTime(date: Date): string {
  const now = Date.now();
  const diff = now - date.getTime();
  const minutes = Math.floor(diff / 60000);
  const hours = Math.floor(diff / 3600000);
  const days = Math.floor(diff / 86400000);

  if (minutes < 1) return "الآن";
  if (minutes < 60) return `منذ ${minutes} دقيقة`;
  if (hours < 24) return `منذ ${hours} ساعة`;
  if (days < 7) return `منذ ${days} يوم`;
  return date.toLocaleDateString("ar-SA", {
    day: "numeric",
    month: "short",
  });
}

// ---------------------------------------------------------------------------
// Session list item type
// ---------------------------------------------------------------------------

interface SessionListItem {
  id: string;
  title: string;
  updatedAt: Date;
  messageCount: number;
}

// ---------------------------------------------------------------------------
// Main View
// ---------------------------------------------------------------------------

export function AiStudyBuddyView() {
  const { view, setView, back } = useViewStore();
  const [messages, setMessages] = useState<BuddyMessage[]>([]);
  const [input, setInput] = useState(view.initialQuestion ?? "");
  const [loading, setLoading] = useState(false);
  const [streamingText, setStreamingText] = useState("");
  const [initialLoading, setInitialLoading] = useState(
    !!view.initialQuestion
  );
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [restoring, setRestoring] = useState(true);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [sessions, setSessions] = useState<SessionListItem[]>([]);
  const [sessionsLoading, setSessionsLoading] = useState(false);
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);
  const [sessionSwitching, setSessionSwitching] = useState(false);
  const [renamingId, setRenamingId] = useState<string | null>(null);
  const [renameInput, setRenameInput] = useState("");
  const renameInputRef = useRef<HTMLInputElement>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const abortRef = useRef<AbortController | null>(null);
  const messagesRef = useRef<BuddyMessage[]>([]);
  const sessionIdRef = useRef<string | null>(null);
  const sidebarRef = useRef<HTMLDivElement>(null);

  // Keep refs in sync with state for the streaming closure
  messagesRef.current = messages;
  sessionIdRef.current = sessionId;

  // ── Fetch sessions list from DB ────────────────────────────────
  const refreshSessions = useCallback(async () => {
    setSessionsLoading(true);
    try {
      const list = await getBuddySessions();
      setSessions(list);
    } catch {
      // silently fail
    } finally {
      setSessionsLoading(false);
    }
  }, []);

  // ── Restore session on mount + fetch initial session list ──────
  useEffect(() => {
    const savedId = loadSessionId();

    // Always fetch session list in background
    refreshSessions();

    if (!savedId) {
      setRestoring(false);
      return;
    }

    (async () => {
      try {
        const res = await fetch(
          `/api/ai/study-buddy?sessionId=${encodeURIComponent(savedId)}`
        );
        if (!res.ok) {
          saveSessionIdToStorage(null);
          setRestoring(false);
          return;
        }
        const data = await res.json();
        if (data.messages?.length > 0) {
          setMessages(data.messages);
          setSessionId(data.session?.id ?? savedId);
        } else {
          setSessionId(savedId);
        }
      } catch {
        saveSessionIdToStorage(null);
      } finally {
        setRestoring(false);
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ── Auto-send initial question ──────────────────────────────
  useEffect(() => {
    if (view.initialQuestion && initialLoading) {
      setInitialLoading(false);
      const timer = setTimeout(() => {
        handleSendRef.current?.(view.initialQuestion!);
      }, 300);
      return () => clearTimeout(timer);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ── Auto-scroll on new messages or streaming text ───────────
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, streamingText]);

  // ── Focus input on mount ────────────────────────────────────
  useEffect(() => {
    if (!view.initialQuestion) {
      inputRef.current?.focus();
    }
  }, [view.initialQuestion]);

  // ── Abort in-flight request on unmount ──────────────────────
  useEffect(() => {
    return () => {
      abortRef.current?.abort();
    };
  }, []);

  // ── Close sidebar on Escape ──────────────────────────────────
  useEffect(() => {
    if (!sidebarOpen) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") setSidebarOpen(false);
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [sidebarOpen]);

  // ── Switch to a different session ─────────────────────────────
  const switchSession = useCallback(
    async (targetId: string) => {
      if (targetId === sessionId) {
        setSidebarOpen(false);
        return;
      }

      // Cancel any in-flight request
      abortRef.current?.abort();
      setSessionSwitching(true);

      try {
        const res = await fetch(
          `/api/ai/study-buddy?sessionId=${encodeURIComponent(targetId)}`
        );
        if (!res.ok) return;

        const data = await res.json();
        setMessages(data.messages ?? []);
        setSessionId(targetId);
        sessionIdRef.current = targetId;
        saveSessionIdToStorage(targetId);
        setInput("");
        setStreamingText("");
      } catch {
        // silently fail
      } finally {
        setSessionSwitching(false);
        setSidebarOpen(false);
        setDeleteConfirmId(null);
      }
    },
    [sessionId]
  );

  // ── Delete a session ──────────────────────────────────────────
  const handleDeleteSession = useCallback(
    async (id: string) => {
      try {
        await deleteBuddySession(id);
        setSessions((prev) => prev.filter((s) => s.id !== id));
        setDeleteConfirmId(null);

        // If the deleted session was active, reset to new chat
        if (id === sessionId) {
          setMessages([]);
          setSessionId(null);
          sessionIdRef.current = null;
          saveSessionIdToStorage(null);
        }
      } catch {
        // silently fail
      }
    },
    [sessionId]
  );

  // ── Rename a session ───────────────────────────────────────────
  const handleStartRename = useCallback(
    (id: string, currentTitle: string) => {
      setRenamingId(id);
      setRenameInput(currentTitle || "");
      // Focus the input on next render
      requestAnimationFrame(() => {
        renameInputRef.current?.focus();
        renameInputRef.current?.select();
      });
    },
    []
  );

  const handleFinishRename = useCallback(
    async (id: string) => {
      const newTitle = renameInput.trim();
      if (!newTitle || newTitle.length < 1) {
        setRenamingId(null);
        return;
      }

      try {
        await renameBuddySession(id, newTitle);
        // Update local sessions state optimistically
        setSessions((prev) =>
          prev.map((s) => (s.id === id ? { ...s, title: newTitle } : s))
        );
      } catch {
        // silently fail — server action will handle errors
      } finally {
        setRenamingId(null);
      }
    },
    [renameInput]
  );

  const handleCancelRename = useCallback(() => {
    setRenamingId(null);
    setRenameInput("");
  }, []);

  // ── New chat ──────────────────────────────────────────────────
  const handleNewChat = useCallback(() => {
    setMessages([]);
    setInput("");
    setSessionId(null);
    sessionIdRef.current = null;
    saveSessionIdToStorage(null);
    setSidebarOpen(false);
    inputRef.current?.focus();
  }, []);

  // ── Toggle sidebar + refresh sessions ─────────────────────────
  const toggleSidebar = useCallback(() => {
    setSidebarOpen((prev) => {
      if (!prev) {
        // Opening — refresh the list
        refreshSessions();
      }
      return !prev;
    });
    setDeleteConfirmId(null);
  }, [refreshSessions]);

  // ── Streaming handler ───────────────────────────────────────
  const handleSend = useCallback(
    async (text?: string) => {
      const message = (text ?? input).trim();
      if (!message || loading) return;

      const userMsg: BuddyMessage = { role: "user", content: message };
      setMessages((prev) => [...prev, userMsg]);
      setInput("");
      setLoading(true);
      setStreamingText("");

      abortRef.current?.abort();
      const controller = new AbortController();
      abortRef.current = controller;

      try {
        const response = await fetch("/api/ai/study-buddy", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            history: messagesRef.current,
            message,
            sessionId: sessionIdRef.current,
          }),
          signal: controller.signal,
        });

        if (!response.ok) {
          const err = await response.json().catch(() => ({}));
          setMessages((prev) => [
            ...prev,
            {
              role: "assistant",
              content: `⚠️ ${err.error ?? "حدث خطأ في الاتصال"}`,
            },
          ]);
          setLoading(false);
          return;
        }

        const reader = response.body?.getReader();
        if (!reader) {
          setMessages((prev) => [
            ...prev,
            {
              role: "assistant",
              content: "⚠️ حدث خطأ غير متوقع. حاول مرة أخرى.",
            },
          ]);
          setLoading(false);
          return;
        }

        const decoder = new TextDecoder();
        let buffer = "";
        let fullResponse = "";
        let streamDone = false;

        while (!streamDone) {
          const { done, value } = await reader.read();
          if (done) break;

          buffer += decoder.decode(value, { stream: true });

          const lines = buffer.split("\n\n");
          buffer = lines.pop() ?? "";

          for (const line of lines) {
            if (!line.startsWith("data: ")) continue;
            const data = line.slice(6);

            if (data === "[DONE]") {
              if (fullResponse) {
                setMessages((prev) => [
                  ...prev,
                  { role: "assistant", content: fullResponse },
                ]);
              }
              setStreamingText("");
              streamDone = true;
              break;
            }

            try {
              const parsed = JSON.parse(data);
              if (parsed.error) {
                setMessages((prev) => [
                  ...prev,
                  {
                    role: "assistant",
                    content: `⚠️ ${parsed.error}`,
                  },
                ]);
                setStreamingText("");
                streamDone = true;
                break;
              }

              if (parsed.sessionId) {
                setSessionId(parsed.sessionId);
                sessionIdRef.current = parsed.sessionId;
                saveSessionIdToStorage(parsed.sessionId);
                // New session created — refresh sidebar list
                refreshSessions();
              }

              if (parsed.text) {
                fullResponse += parsed.text;
                setStreamingText(fullResponse);
              }
            } catch {
              // Skip unparseable chunks
            }
          }
        }

        if (fullResponse && !streamDone) {
          setMessages((prev) => [
            ...prev,
            { role: "assistant", content: fullResponse },
          ]);
          setStreamingText("");
        }

        setLoading(false);
        // Refresh sessions list to update titles/updatedAt
        refreshSessions();
      } catch (e) {
        if (controller.signal.aborted) {
          setLoading(false);
          return;
        }
        setMessages((prev) => [
          ...prev,
          {
            role: "assistant",
            content: "⚠️ حدث خطأ غير متوقع. حاول مرة أخرى.",
          },
        ]);
        setLoading(false);
      }
    },
    [input, loading, refreshSessions]
  );

  const handleSendRef = useRef(handleSend);
  handleSendRef.current = handleSend;

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const handleSuggestion = (text: string) => {
    setInput(text);
    handleSend(text);
  };

  // ── Render ───────────────────────────────────────────────────
  return (
    <div className="relative max-w-3xl mx-auto pb-32 lg:pb-12 flex flex-col h-[calc(100dvh-12rem)]">
      {/* ── Header ── */}
      <div className="flex items-center justify-between mb-4 shrink-0">
        <button
          onClick={() => back()}
          className="flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground transition-colors"
        >
          <ChevronLeft className="h-4 w-4" />
          <span>رجوع</span>
        </button>

        <div className="flex items-center gap-2">
          <div className="h-8 w-8 rounded-lg bg-gradient-to-br from-violet-500 to-indigo-600 grid place-items-center">
            <Bot className="h-4 w-4 text-white" />
          </div>
          <div>
            <h1 className="text-sm font-bold">المساعد الذكي</h1>
            <p className="text-[9px] text-muted-foreground">
              {sessionId ? "محادثة محفوظة" : "مدعوم بـ Gemini"}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-1">
          {/* History sidebar toggle */}
          <button
            onClick={toggleSidebar}
            className={cn(
              "flex items-center gap-1 text-xs px-2 py-1.5 rounded-lg transition-colors",
              sidebarOpen
                ? "bg-violet-500/10 text-violet-600 dark:text-violet-400"
                : "text-muted-foreground hover:text-foreground hover:bg-muted/50"
            )}
            title="المحادثات السابقة"
          >
            <History className="h-3.5 w-3.5" />
            <span className="hidden sm:inline">السجل</span>
          </button>

          {/* New chat */}
          {messages.length > 0 && (
            <button
              onClick={handleNewChat}
              className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground transition-colors px-2 py-1.5 rounded-lg hover:bg-muted/50"
              title="محادثة جديدة"
            >
              <RefreshCw className="h-3.5 w-3.5" />
              <span className="hidden sm:inline">جديد</span>
            </button>
          )}
          {messages.length === 0 && !sidebarOpen && <div className="w-9" />}
        </div>
      </div>

      {/* ── Messages area ── */}
      <div className="flex-1 overflow-y-auto space-y-3 px-1 scrollbar-thin">
        {/* Restoring session loader */}
        {restoring && (
          <div className="flex items-center justify-center py-20">
            <FullScreenLoader label="جارٍ استعادة المحادثة…" />
          </div>
        )}

        {/* Session switching loader */}
        {sessionSwitching && (
          <div className="flex items-center justify-center py-20">
            <FullScreenLoader label="جارٍ التبديل…" />
          </div>
        )}

        {/* Welcome screen (only when no messages and not restoring) */}
        {!restoring && !sessionSwitching && messages.length === 0 && !loading && !initialLoading && (
          <WelcomeScreen onSuggestion={handleSuggestion} />
        )}

        {/* Initial loading (auto-sending from question context) */}
        {initialLoading && (
          <div className="flex items-center justify-center py-20">
            <FullScreenLoader label="جارٍ تجهيز المساعد الذكي…" />
          </div>
        )}

        {!sessionSwitching && (
          <AnimatePresence initial={false}>
            {messages.map((msg, i) => (
              <motion.div
                key={i}
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.25, ease: "easeOut" }}
                className={cn(
                  "flex gap-3",
                  msg.role === "user" ? "flex-row-reverse" : "flex-row"
                )}
              >
                <div
                  className={cn(
                    "shrink-0 h-8 w-8 rounded-xl grid place-items-center mt-1",
                    msg.role === "user"
                      ? "bg-primary text-primary-foreground"
                      : "bg-gradient-to-br from-violet-500 to-indigo-600 text-white"
                  )}
                >
                  {msg.role === "user" ? (
                    <span className="text-xs font-bold">أنت</span>
                  ) : (
                    <Bot className="h-4 w-4" />
                  )}
                </div>

                <div
                  className={cn(
                    "max-w-[80%] rounded-2xl px-4 py-3 text-sm leading-relaxed",
                    msg.role === "user"
                      ? "bg-primary text-primary-foreground rounded-tl-sm"
                      : "bg-muted/60 text-foreground rounded-tr-sm"
                  )}
                >
                  {msg.role === "assistant" ? (
                    <FormattedResponse text={msg.content} />
                  ) : (
                    <p>{msg.content}</p>
                  )}
                </div>
              </motion.div>
            ))}
          </AnimatePresence>
        )}

        {/* Streaming / Loading indicator */}
        {loading && (
          <motion.div
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            className="flex gap-3"
          >
            <div className="shrink-0 h-8 w-8 rounded-xl bg-gradient-to-br from-violet-500 to-indigo-600 grid place-items-center">
              <Bot className="h-4 w-4 text-white" />
            </div>
            {streamingText ? (
              <div className="rounded-2xl rounded-tr-sm bg-muted/60 px-4 py-3 min-w-[80px]">
                <FormattedResponse text={streamingText} />
                <span className="inline-block w-[2px] h-[1em] bg-violet-500 align-text-bottom animate-pulse" />
              </div>
            ) : (
              <div className="rounded-2xl rounded-tr-sm bg-muted/60 px-4 py-3">
                <div className="flex items-center gap-2">
                  <Loader2 className="h-4 w-4 animate-spin text-violet-500" />
                  <span className="text-xs text-muted-foreground">
                    جاري التفكير…
                  </span>
                </div>
              </div>
            )}
          </motion.div>
        )}

        <div ref={messagesEndRef} />
      </div>

      {/* ── Input area ── */}
      <div className="mt-4 shrink-0">
        <div className="relative">
          <textarea
            ref={inputRef}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="اسأل المساعد الذكي عن أي شيء…"
            rows={1}
            className="w-full rounded-2xl bg-muted/50 border border-border resize-none px-4 py-3 pe-12 text-sm outline-none focus:ring-2 focus:ring-primary/30 transition-all placeholder:text-muted-foreground/60"
            style={{ minHeight: 44, maxHeight: 120 }}
            onInput={(e) => {
              const el = e.currentTarget;
              el.style.height = "auto";
              el.style.height = Math.min(el.scrollHeight, 120) + "px";
            }}
          />
          <button
            onClick={() => handleSend()}
            disabled={!input.trim() || loading}
            className={cn(
              "absolute left-2 bottom-2 h-8 w-8 rounded-xl grid place-items-center transition-all",
              input.trim() && !loading
                ? "bg-primary text-primary-foreground hover:bg-primary/90"
                : "bg-muted text-muted-foreground cursor-not-allowed"
            )}
          >
            <Send className="h-4 w-4" />
          </button>
        </div>
        <p className="text-[10px] text-muted-foreground/60 mt-1.5 text-center">
          اضغط Enter للإرسال · Shift+Enter لسطر جديد · المحادثات محفوظة تلقائياً
        </p>
      </div>

      {/* ── Session History Sidebar ─────────────────────────────── */}
      <AnimatePresence>
        {sidebarOpen && (
          <>
            {/* Backdrop */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.15 }}
              className="fixed inset-0 bg-black/20 backdrop-blur-sm z-40"
              onClick={() => setSidebarOpen(false)}
            />

            {/* Sidebar panel */}
            <motion.div
              ref={sidebarRef}
              initial={{ x: 320 }}
              animate={{ x: 0 }}
              exit={{ x: 320 }}
              transition={{ type: "spring", damping: 25, stiffness: 300 }}
              className="fixed top-0 left-0 h-full w-[300px] sm:w-[340px] z-50 bg-card border-l border-border shadow-xl flex flex-col"
            >
              {/* Sidebar header */}
              <div className="flex items-center justify-between px-4 py-3 border-b border-border shrink-0">
                <div className="flex items-center gap-2">
                  <History className="h-4 w-4 text-muted-foreground" />
                  <h2 className="text-sm font-bold">المحادثات السابقة</h2>
                </div>
                <button
                  onClick={() => setSidebarOpen(false)}
                  className="h-7 w-7 rounded-lg grid place-items-center text-muted-foreground hover:text-foreground hover:bg-muted/50 transition-colors"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>

              {/* New chat button */}
              <div className="px-3 py-2 shrink-0">
                <button
                  onClick={handleNewChat}
                  className="w-full flex items-center justify-center gap-2 rounded-xl border border-dashed border-border hover:border-violet-300 dark:hover:border-violet-700 bg-muted/30 hover:bg-violet-500/5 text-sm text-muted-foreground hover:text-violet-600 dark:hover:text-violet-400 py-2.5 transition-all"
                >
                  <Plus className="h-4 w-4" />
                  <span>محادثة جديدة</span>
                </button>
              </div>

              {/* Session list */}
              <div className="flex-1 overflow-y-auto px-2 pb-3">
                {sessionsLoading && sessions.length === 0 ? (
                  <div className="flex items-center justify-center py-12">
                    <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
                  </div>
                ) : sessions.length === 0 ? (
                  <div className="flex flex-col items-center justify-center py-12 text-center px-4">
                    <MessageSquare className="h-8 w-8 text-muted-foreground/40 mb-2" />
                    <p className="text-xs text-muted-foreground/60">
                      لا توجد محادثات سابقة
                    </p>
                    <p className="text-[10px] text-muted-foreground/40 mt-1">
                      ابدأ محادثة جديدة وستظهر هنا
                    </p>
                  </div>
                ) : (
                  <div className="space-y-1">
                    {sessions.map((s) => {
                      const isActive = s.id === sessionId;
                      const isDeleting = deleteConfirmId === s.id;

                      return (
                        <div
                          key={s.id}
                          className={cn(
                            "group relative flex items-center gap-2 rounded-xl p-2.5 cursor-pointer transition-all",
                            isActive
                              ? "bg-violet-500/10 border border-violet-200 dark:border-violet-800/50"
                              : "hover:bg-muted/50 border border-transparent"
                          )}
                          onClick={() => {
                            if (!isDeleting) switchSession(s.id);
                          }}
                        >
                          {/* Active indicator */}
                          {isActive && (
                            <div className="absolute right-0 top-1/2 -translate-y-1/2 w-0.5 h-6 rounded-full bg-violet-500" />
                          )}

                          {/* Icon */}
                          <div
                            className={cn(
                              "shrink-0 h-7 w-7 rounded-lg grid place-items-center",
                              isActive
                                ? "bg-violet-500/20 text-violet-600 dark:text-violet-400"
                                : "bg-muted text-muted-foreground"
                            )}
                          >
                            <MessageSquare className="h-3.5 w-3.5" />
                          </div>

                          {/* Info */}
                          <div className="flex-1 min-w-0">
                            {renamingId === s.id ? (
                              <input
                                ref={renameInputRef}
                                value={renameInput}
                                onChange={(e) => setRenameInput(e.target.value)}
                                onKeyDown={(e) => {
                                  e.stopPropagation();
                                  if (e.key === "Enter") {
                                    handleFinishRename(s.id);
                                  } else if (e.key === "Escape") {
                                    handleCancelRename();
                                  }
                                }}
                                onBlur={() => handleFinishRename(s.id)}
                                onClick={(e) => e.stopPropagation()}
                                className="w-full text-xs font-medium bg-transparent border-b-2 border-violet-500 outline-none px-0.5 py-0 text-foreground"
                                maxLength={100}
                                dir="auto"
                              />
                            ) : (
                              <p
                                className={cn(
                                  "text-xs font-medium truncate",
                                  isActive && "text-violet-700 dark:text-violet-300"
                                )}
                                onDoubleClick={() =>
                                  handleStartRename(s.id, s.title)
                                }
                              >
                                {s.title || "محادثة جديدة"}
                              </p>
                            )}
                            <div className="flex items-center gap-2 mt-0.5">
                              <span className="text-[10px] text-muted-foreground/60">
                                {relativeTime(new Date(s.updatedAt))}
                              </span>
                              <span className="text-[10px] text-muted-foreground/40">
                                ·
                              </span>
                              <span className="text-[10px] text-muted-foreground/60">
                                {s.messageCount} رسالة
                              </span>
                            </div>
                          </div>

                          {/* Action buttons (appear on hover) */}
                          {!isDeleting && renamingId !== s.id ? (
                            <>
                              {/* Rename button */}
                              <button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  handleStartRename(s.id, s.title);
                                }}
                                className="shrink-0 h-7 w-7 rounded-lg grid place-items-center text-muted-foreground/40 hover:text-violet-500 hover:bg-violet-500/10 transition-all opacity-0 group-hover:opacity-100 focus:opacity-100"
                                title="تعديل الاسم"
                              >
                                <Pencil className="h-3.5 w-3.5" />
                              </button>

                              {/* Delete button */}
                              <button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  setDeleteConfirmId(s.id);
                                }}
                                className="shrink-0 h-7 w-7 rounded-lg grid place-items-center text-muted-foreground/40 hover:text-red-500 hover:bg-red-500/10 transition-all opacity-0 group-hover:opacity-100 focus:opacity-100"
                                title="حذف المحادثة"
                              >
                                <Trash2 className="h-3.5 w-3.5" />
                              </button>
                </>
                          ) : (
                            <div className="shrink-0 flex items-center gap-1">
                              <button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  handleDeleteSession(s.id);
                                }}
                                className="h-7 w-7 rounded-lg grid place-items-center bg-red-500/10 text-red-500 hover:bg-red-500/20 transition-colors"
                                title="تأكيد الحذف"
                              >
                                <Check className="h-3.5 w-3.5" />
                              </button>
                              <button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  setDeleteConfirmId(null);
                                }}
                                className="h-7 w-7 rounded-lg grid place-items-center text-muted-foreground/40 hover:text-foreground hover:bg-muted/50 transition-colors"
                                title="إلغاء"
                              >
                                <X className="h-3.5 w-3.5" />
                              </button>
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>

              {/* Footer */}
              <div className="px-4 py-2.5 border-t border-border shrink-0">
                <p className="text-[10px] text-muted-foreground/40 text-center">
                  آخر {sessions.length} محادثة — يتم الحفظ تلقائياً
                </p>
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Welcome screen
// ---------------------------------------------------------------------------

function WelcomeScreen({
  onSuggestion,
}: {
  onSuggestion: (text: string) => void;
}) {
  return (
    <div className="flex flex-col items-center justify-center py-12 text-center">
      <div className="h-16 w-16 rounded-2xl bg-gradient-to-br from-violet-500 via-indigo-500 to-purple-600 grid place-items-center shadow-lg mb-4">
        <Bot className="h-8 w-8 text-white" />
      </div>

      <h2 className="font-display text-lg font-bold mb-1">
        مرحباً بك في المساعد الذكي
      </h2>
      <p className="text-sm text-muted-foreground max-w-md leading-relaxed mb-6">
        اسألني عن أي شيء يخص اختبار القدرات اللفظية — شروحات، أمثلة، نصائح، أو
        تحليل أسئلة.
      </p>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 w-full max-w-lg">
        {SUGGESTIONS.map((s, i) => (
          <motion.button
            key={i}
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1 + i * 0.06 }}
            onClick={() => onSuggestion(s.text)}
            className="flex items-center gap-2 rounded-xl border border-border bg-card hover:bg-muted/50 px-3 py-2.5 text-xs font-medium text-right transition-all hover:border-primary/30 text-foreground/80 hover:text-foreground"
          >
            <span className="shrink-0 h-6 w-6 rounded-lg bg-primary/10 grid place-items-center text-primary">
              {s.icon}
            </span>
            <span>{s.text}</span>
          </motion.button>
        ))}
      </div>

      <p className="text-[10px] text-muted-foreground/50 mt-6">
        يمكنك السؤال بالعامية أو بالفصحى — أنا أفهمك 😊
      </p>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Format AI response — simple markdown-like rendering
// ---------------------------------------------------------------------------

function FormattedResponse({ text }: { text: string }) {
  const paragraphs = text.split(/\n\n+/);

  return (
    <div className="space-y-2">
      {paragraphs.map((para, i) => {
        const trimmed = para.trim();
        if (!trimmed) return null;

        if (trimmed.startsWith("- ") || trimmed.startsWith("• ")) {
          const items = trimmed.split(/\n/).filter(Boolean);
          return (
            <ul key={i} className="list-disc pr-4 space-y-0.5">
              {items.map((item, j) => (
                <li key={j} className="text-sm leading-relaxed">
                  {item.replace(/^[-•]\s*/, "")}
                </li>
              ))}
            </ul>
          );
        }

        const withBold = trimmed.split(/(\*\*[^*]+\*\*)/).map((part, j) => {
          if (part.startsWith("**") && part.endsWith("**")) {
            return (
              <strong key={j} className="font-semibold">
                {part.slice(2, -2)}
              </strong>
            );
          }
          return part;
        });

        return (
          <p key={i} className="text-sm leading-relaxed">
            {withBold}
          </p>
        );
      })}
    </div>
  );
}
