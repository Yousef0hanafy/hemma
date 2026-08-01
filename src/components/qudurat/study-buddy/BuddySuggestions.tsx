"use client";

import { motion } from "framer-motion";
import { Lightbulb, BookOpen, Sparkles, MessageSquare } from "lucide-react";

export interface SuggestionItem {
  icon: React.ReactNode;
  text: string;
}

export const DEFAULT_SUGGESTIONS: SuggestionItem[] = [
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

interface Props {
  onSelect: (text: string) => void;
}

export function BuddySuggestions({ onSelect }: Props) {
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 max-w-xl mx-auto w-full">
      {DEFAULT_SUGGESTIONS.map((item, idx) => (
        <motion.button
          key={idx}
          whileHover={{ scale: 1.02 }}
          whileTap={{ scale: 0.98 }}
          onClick={() => onSelect(item.text)}
          className="flex items-center gap-2.5 p-3 rounded-xl border border-border/80 bg-card hover:bg-accent hover:border-accent text-right transition-colors shadow-xs text-xs sm:text-sm"
        >
          <span className="text-primary shrink-0">{item.icon}</span>
          <span className="text-foreground/90 font-medium line-clamp-2">{item.text}</span>
        </motion.button>
      ))}
    </div>
  );
}
