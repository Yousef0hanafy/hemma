"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useViewStore } from "@/lib/store/view-store";
import { useUserProfile } from "@/lib/hooks/use-data";
import { toArabicDigits } from "@/lib/content/ui-helpers";
import { cn } from "@/lib/utils";
import {
  Sparkles,
  BookOpen,
  Timer,
  RefreshCw,
  BarChart3,
  Trophy,
  User,
  Zap,
  Target,
  Flame,
  Shield,
  ChevronLeft,
  Check,
} from "lucide-react";

// ---------------------------------------------------------------------------
// Tour step configuration
// ---------------------------------------------------------------------------

interface TourStep {
  id: string;
  icon: React.ReactNode;
  title: string;
  description: string;
  /** Optional action to navigate to a specific view when this step is shown */
  navigateTo?: Parameters<ReturnType<typeof useViewStore>["setView"]>[0];
}

const STEPS: TourStep[] = [
  {
    id: "welcome",
    icon: <Sparkles className="h-6 w-6" />,
    title: "أهلًا بك في همّة! 🎉",
    description:
      "منصة همّة التعليمية — رحلتك المتكاملة لإتقان القدرات اللفظية. في هذه الجولة السريعة، سنأخذك في جولة تعريفية بأهم الميزات. مدّتها أقل من دقيقة!",
  },
  {
    id: "dashboard",
    icon: <Flame className="h-6 w-6" />,
    title: "لوحة التحكم",
    description:
      "هنا ترى كل شيء في لمحة: سلسلة أيامك 🔥، نقاط الخبرة ⭐، مستواك، وإتقانك لكل فئة من فئات القدرات اللفظية. دائرة الإتقان تظهر تقدّمك في كل فئة بلون مختلف.",
  },
  {
    id: "study",
    icon: <BookOpen className="h-6 w-6" />,
    title: "المذاكرة 📖",
    description:
      "ادرس أي فئة تختارها. بعد كل سؤال ستحصل على تفسير فوري — تعرف لماذا كانت إجابتك صحيحة أو خاطئة. المذاكرة هي أفضل طريقة للفهم العميق.",
    navigateTo: { kind: "study_setup" },
  },
  {
    id: "exam",
    icon: <Timer className="h-6 w-6" />,
    title: "الاختبارات ⏱️",
    description:
      "اختبر نفسك باختبار وقتي يحاكي الاختبار الحقيقي. حدد عدد الأسئلة والوقت. في النهاية ستحصل على تقرير مفصّل ومراجعة لكل سؤال.",
    navigateTo: { kind: "exam_setup" },
  },
  {
    id: "revision",
    icon: <RefreshCw className="h-6 w-6" />,
    title: "المراجعة الذكية 🔄",
    description:
      "راجع أخطاءك في 'حديقة الأخطاء'، واستخدم بطاقات التكرار المتباعد لتثبيت المعلومات. المراجعة هي مفتاح الإتقان على المدى الطويل.",
    navigateTo: { kind: "revision", tab: "mistakes" },
  },
  {
    id: "stats",
    icon: <BarChart3 className="h-6 w-6" />,
    title: "الإحصاءات 📊",
    description:
      "تتبّع أداءك عبر الزمن في كل فئة. شاهد توزيع السرعة، سجل الاختبارات مع منحنى الأداء، واعرف نقاط قوّتك وضعفك.",
    navigateTo: { kind: "stats" },
  },
  {
    id: "achievements",
    icon: <Trophy className="h-6 w-6" />,
    title: "الإنجازات 🏆",
    description:
      "كل إنجاز تفتحه يمنحك نقاط خبرة إضافية. تحدَّ نفسك لفتحها جميعًا: أجب أسئلة كثيرة، حافظ على سلسلة أيامك، وأتقن كل الفئات!",
    navigateTo: { kind: "achievements" },
  },
  {
    id: "goals",
    icon: <Target className="h-6 w-6" />,
    title: "الأهداف اليومية 🎯",
    description:
      "حدّد أهدافًا يومية لنفسك: كم سؤالًا تريد حلّه؟ كم إجابة صحيحة؟ كم نقطة خبرة؟ تابع تقدّمك من لوحة التحكم واحتفل بتحقيق أهدافك.",
  },
  {
    id: "profile",
    icon: <User className="h-6 w-6" />,
    title: "ملفك الشخصي 👤",
    description:
      "في ملفّك الشخصي يمكنك رؤية إحصائياتك المتقدّمة، إنجازاتك، آخر نشاطاتك، وتعديل الإعدادات مثل المظهر الداكن والإشعارات.",
    navigateTo: { kind: "profile" },
  },
  {
    id: "complete",
    icon: <Check className="h-6 w-6" />,
    title: "انطلق في رحلتك! 🚀",
    description:
      "الآن أنت جاهز! ابدأ بالمذاكرة أو اختبر نفسك. تذكّر: الاستمرارية أهم من الكثافة. خطوة بخطوة نحو الإتقان.",
  },
];

// ---------------------------------------------------------------------------
// Storage key
// ---------------------------------------------------------------------------

const STORAGE_KEY = "hemma_onboarding_completed";

function isOnboardingCompleted(): boolean {
  if (typeof window === "undefined") return true;
  return localStorage.getItem(STORAGE_KEY) === "true";
}

function markOnboardingCompleted() {
  if (typeof window === "undefined") return;
  localStorage.setItem(STORAGE_KEY, "true");
}

// ---------------------------------------------------------------------------
// Onboarding Tour Component
// ---------------------------------------------------------------------------

export function OnboardingTour() {
  const { data: profile } = useUserProfile();
  const { setView } = useViewStore();
  const [isOpen, setIsOpen] = useState(false);
  const [currentStep, setCurrentStep] = useState(0);
  const readyRef = useRef(false);

  // Check if user is new and tour hasn't been completed
  useEffect(() => {
    if (!profile) return;
    const isNewUser = profile.totalXp === 0 && profile.currentStreak === 0;
    const alreadyCompleted = isOnboardingCompleted();
    if (isNewUser && !alreadyCompleted) {
      // Small delay so the dashboard renders first
      const timer = setTimeout(() => setIsOpen(true), 800);
      return () => clearTimeout(timer);
    }
  }, [profile]);

  const totalSteps = STEPS.length;
  const step = STEPS[currentStep];
  const isLastStep = currentStep === totalSteps - 1;
  const isFirstStep = currentStep === 0;

  const handleNext = useCallback(() => {
    if (currentStep < totalSteps - 1) {
      setCurrentStep((s) => s + 1);
    }
  }, [currentStep]);

  const handlePrev = useCallback(() => {
    if (currentStep > 0) {
      setCurrentStep((s) => s - 1);
    }
  }, [currentStep]);

  const handleSkip = useCallback(() => {
    markOnboardingCompleted();
    setIsOpen(false);
    // Return to dashboard if navigated away
    setView({ kind: "dashboard" });
  }, [setView]);

  const handleComplete = useCallback(() => {
    markOnboardingCompleted();
    setIsOpen(false);
    setView({ kind: "dashboard" });
  }, [setView]);

  // Keyboard navigation
  useEffect(() => {
    if (!isOpen) return;
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === "ArrowLeft" || e.key === " ") {
        e.preventDefault();
        handleNext();
      } else if (e.key === "ArrowRight") {
        e.preventDefault();
        handlePrev();
      } else if (e.key === "Escape") {
        handleSkip();
      }
    };
    window.addEventListener("keydown", handleKey);
    return () => window.removeEventListener("keydown", handleKey);
  }, [isOpen, handleNext, handlePrev, handleSkip]);

  // Navigate to matching view on step change
  useEffect(() => {
    if (!readyRef.current) {
      readyRef.current = true;
      return;
    }
    if (step?.navigateTo) {
      setView(step.navigateTo);
    } else {
      setView({ kind: "dashboard" });
    }
  }, [currentStep, step, setView]);

  if (!isOpen || !step) return null;

  return (
    <AnimatePresence>
      {/* Backdrop */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 z-50 bg-black/50 backdrop-blur-sm"
        onClick={handleSkip}
      />

      {/* Tour card */}
      <motion.div
        initial={{ opacity: 0, scale: 0.9, y: 20 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.9, y: 20 }}
        transition={{ type: "spring", stiffness: 260, damping: 22 }}
        className="fixed inset-x-4 bottom-8 sm:bottom-auto sm:top-1/2 sm:-translate-y-1/2 sm:inset-x-auto sm:left-1/2 sm:-translate-x-1/2 z-50 max-w-lg mx-auto"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="rounded-3xl bg-card border border-border shadow-2xl overflow-hidden">
          {/* Top gradient accent */}
          <div className="h-2 bg-gradient-to-l from-emerald-500 via-emerald-600 to-teal-600" />

          <div className="p-6 sm:p-8">
            {/* Step indicator + skip */}
            <div className="flex items-center justify-between mb-6">
              <div className="flex items-center gap-1.5">
                {STEPS.map((_, i) => (
                  <div
                    key={i}
                    className={cn(
                      "h-1.5 rounded-full transition-all duration-300",
                      i === currentStep
                        ? "w-6 bg-primary"
                        : i < currentStep
                        ? "w-1.5 bg-primary/40"
                        : "w-1.5 bg-muted"
                    )}
                  />
                ))}
              </div>
              <button
                onClick={handleSkip}
                className="text-[10px] text-muted-foreground hover:text-foreground transition-colors px-2 py-1 rounded-md hover:bg-muted"
              >
                تخطي الجولة
              </button>
            </div>

            {/* Icon */}
            <div className="flex justify-center mb-5">
              <div className="h-16 w-16 rounded-2xl bg-gradient-to-bl from-emerald-500 to-teal-600 text-white grid place-items-center shadow-lg">
                {step.icon}
              </div>
            </div>

            {/* Title */}
            <h2 className="text-xl font-bold text-center mb-3 font-display">
              {step.title}
            </h2>

            {/* Description */}
            <p className="text-sm text-muted-foreground text-center leading-relaxed mb-2">
              {step.description}
            </p>

            {/* Step counter */}
            <div className="text-center text-[10px] text-muted-foreground/60 mb-6">
              {toArabicDigits(currentStep + 1)} من {toArabicDigits(totalSteps)}
            </div>

            {/* Actions */}
            <div className="flex items-center justify-between gap-3">
              {/* Previous */}
              {!isFirstStep ? (
                <button
                  onClick={handlePrev}
                  className="inline-flex items-center gap-1.5 rounded-full bg-muted text-foreground px-4 py-2.5 text-xs font-semibold hover:bg-muted/80 transition-colors"
                >
                  <ChevronLeft className="h-3.5 w-3.5" />
                  <span>السابق</span>
                </button>
              ) : (
                <div />
              )}

              {/* Next / Complete */}
              {isLastStep ? (
                <button
                  onClick={handleComplete}
                  className="inline-flex items-center gap-1.5 rounded-full bg-gradient-to-l from-emerald-600 to-teal-600 text-white px-6 py-2.5 text-xs font-bold hover:from-emerald-500 hover:to-teal-500 transition-all shadow-sm active:scale-95"
                >
                  <Check className="h-3.5 w-3.5" />
                  <span>ابدأ الرحلة! 🚀</span>
                </button>
              ) : (
                <button
                  onClick={handleNext}
                  className="inline-flex items-center gap-1.5 rounded-full bg-primary text-primary-foreground px-5 py-2.5 text-xs font-semibold hover:bg-primary/90 transition-all active:scale-95"
                >
                  <span>التالي</span>
                  <ChevronLeft className="h-3.5 w-3.5" />
                </button>
              )}
            </div>

            {/* Keyboard hints */}
            <div className="mt-4 text-center text-[9px] text-muted-foreground/40">
              <kbd className="px-1 rounded bg-muted font-mono">Space</kbd>
              <span className="mx-0.5">أو</span>
              <kbd className="px-1 rounded bg-muted font-mono">←</kbd>
              <span className="mx-0.5">للانتقال ·</span>
              <kbd className="px-1 rounded bg-muted font-mono">Esc</kbd>
              <span className="mx-0.5">للخروج</span>
            </div>
          </div>
        </div>
      </motion.div>
    </AnimatePresence>
  );
}
