"use client";

import { motion } from "framer-motion";
import { Bot, Sparkles, MessageSquare } from "lucide-react";
import { cn } from "@/lib/utils";
import type { BuddyMessage } from "@/server/actions/study-buddy-session";

interface Props {
  message: BuddyMessage;
}

export function BuddyMessageBubble({ message }: Props) {
  const isAssistant = message.role === "assistant";

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.2 }}
      className={cn(
        "flex gap-3 text-sm leading-relaxed",
        isAssistant ? "justify-start" : "justify-end"
      )}
    >
      {isAssistant && (
        <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary border border-primary/20 shadow-xs">
          <Bot className="h-4 w-4" />
        </div>
      )}

      <div
        className={cn(
          "max-w-[85%] sm:max-w-[75%] rounded-2xl px-4 py-3 shadow-xs",
          isAssistant
            ? "bg-card text-card-foreground border border-border/80 rounded-tr-xs"
            : "bg-primary text-primary-foreground rounded-tl-xs"
        )}
      >
        <div className="whitespace-pre-wrap break-words">{message.content}</div>
        <div
          className={cn(
            "mt-1.5 text-[10px] opacity-60 text-left font-mono dir-ltr",
            isAssistant ? "text-muted-foreground" : "text-primary-foreground/80"
          )}
        >
          {new Date(message.createdAt ?? Date.now()).toLocaleTimeString([], {
            hour: "2-digit",
            minute: "2-digit",
          })}
        </div>
      </div>

      {!isAssistant && (
        <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-muted text-muted-foreground border border-border shadow-xs">
          <MessageSquare className="h-4 w-4" />
        </div>
      )}
    </motion.div>
  );
}
