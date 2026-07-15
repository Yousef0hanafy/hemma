"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useViewStore } from "@/lib/store/view-store";
import type { BuddyMessage } from "@/server/actions/ai-study-buddy";
import { cn } from "@/lib/utils";
import { FullScreenLoader } from "./LoadingStates";
import {
  Bot,
  Send,
  ChevronLeft,
  Sparkles,
  BookOpen,
  Lightbulb,
  ArrowLeft,
  Loader2,
  MessageSquare,
  X,
  RefreshCw,
} from "lucide-react";

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
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const abortRef = useRef<AbortController | null>(null);
  const messagesRef = useRef<BuddyMessage[]>([]);

  // Keep ref in sync with state for the streaming closure
  messagesRef.current = messages;

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

  // ── Streaming handler ───────────────────────────────────────
  const handleSend = useCallback(async (text?: string) => {
    const message = (text ?? input).trim();
    if (!message || loading) return;

    // Add user message
    const userMsg: BuddyMessage = { role: "user", content: message };
    setMessages((prev) => [...prev, userMsg]);
    setInput("");
    setLoading(true);
    setStreamingText("");

    // Abort previous request if any
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

      // ── Read the stream ────────────────────────────────────
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

        // Parse SSE events from buffer (split by double newline)
        const lines = buffer.split("\n\n");
        buffer = lines.pop() ?? "";

        for (const line of lines) {
          if (!line.startsWith("data: ")) continue;
          const data = line.slice(6);

          if (data === "[DONE]") {
            // Streaming complete — finalize the message
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
            if (parsed.text) {
              fullResponse += parsed.text;
              setStreamingText(fullResponse);
            } else if (parsed.error) {
              // Error event from the stream
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
          } catch {
            // Skip unparseable chunks
          }
        }
      }

      // Catch unexpected stream end without [DONE] or error
      if (fullResponse && !streamDone) {
        setMessages((prev) => [
          ...prev,
          { role: "assistant", content: fullResponse },
        ]);
        setStreamingText("");
      }

      setLoading(false);
    } catch (e) {
      if (controller.signal.aborted) {
        // User navigated away — silently ignore
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
  }, [input, loading]);

  // Stable ref to handleSend so the auto-send effect can call it
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

  const clearChat = () => {
    setMessages([]);
    setInput("");
    inputRef.current?.focus();
  };

  return (
    <div className="max-w-3xl mx-auto pb-32 lg:pb-12 flex flex-col h-[calc(100dvh-12rem)]">
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
            <p className="text-[9px] text-muted-foreground">مدعوم بـ Gemini</p>
          </div>
        </div>

        {messages.length > 0 && (
          <button
            onClick={clearChat}
            className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground transition-colors"
            title="مسح المحادثة"
          >
            <RefreshCw className="h-3.5 w-3.5" />
            <span className="hidden sm:inline">جديد</span>
          </button>
        )}
        {messages.length === 0 && <div className="w-14" />}
      </div>

      {/* ── Messages area ── */}
      <div className="flex-1 overflow-y-auto space-y-3 px-1 scrollbar-thin">
        {messages.length === 0 && !loading && !initialLoading && (
          <WelcomeScreen onSuggestion={handleSuggestion} />
        )}

        {initialLoading && (
          <div className="flex items-center justify-center py-20">
            <FullScreenLoader label="جارٍ تجهيز المساعد الذكي…" />
          </div>
        )}

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
              {/* Avatar */}
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

              {/* Bubble */}
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
                {/* Blinking cursor */}
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
          اضغط Enter للإرسال · Shift+Enter لسطر جديد · يستخدم Gemini للرد
        </p>
      </div>
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
      {/* Avatar */}
      <div className="h-16 w-16 rounded-2xl bg-gradient-to-br from-violet-500 via-indigo-500 to-purple-600 grid place-items-center shadow-lg mb-4">
        <Bot className="h-8 w-8 text-white" />
      </div>

      <h2 className="font-display text-lg font-bold mb-1">مرحباً بك في المساعد الذكي</h2>
      <p className="text-sm text-muted-foreground max-w-md leading-relaxed mb-6">
        اسألني عن أي شيء يخص اختبار القدرات اللفظية — شروحات، أمثلة، نصائح، أو تحليل أسئلة.
      </p>

      {/* Suggestions */}
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
  // Split by double newlines for paragraphs
  const paragraphs = text.split(/\n\n+/);

  return (
    <div className="space-y-2">
      {paragraphs.map((para, i) => {
        const trimmed = para.trim();
        if (!trimmed) return null;

        // Bullet list
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

        // Bold text (**...**)
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
