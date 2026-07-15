"use client";

import { useEffect, useState, useRef } from "react";
import { motion } from "framer-motion";
import { useSession, signIn } from "next-auth/react";
import {
  LogIn,
  Sparkles,
  BookOpen,
  Target,
  Shield,
  ArrowLeft,
  Clock,
  RotateCcw,
  X,
  Mail,
  Lock,
  User as UserIcon,
  Loader2,
} from "lucide-react";
import { toast } from "sonner";
import { signupWithEmail } from "@/server/actions/auth";
import type { SignupResult } from "@/server/actions/auth";
import { useViewStore } from "@/lib/store/view-store";
import { FullScreenLoader } from "./LoadingStates";
import {
  loadPendingExam,
  clearPendingExam,
  pendingSessionLabel,
} from "@/lib/exam-persistence";

/**
 * Guards view content behind authentication.
 * - Loading → spinner
 * - Unauthenticated → login prompt (saves active view state first)
 * - Authenticated → children + optional restore banner for interrupted sessions
 */
export function AuthGate({ children }: { children: React.ReactNode }) {
  const { status } = useSession();
  const [showRestore, setShowRestore] = useState(false);
  const dismissed = useRef(false);

  // Check for a saved pending exam once after auth is confirmed
  useEffect(() => {
    if (status === "authenticated" && !dismissed.current) {
      const saved = loadPendingExam();
      if (saved) {
        setShowRestore(true);
      }
    }
  }, [status]);

  if (status === "loading") {
    return <FullScreenLoader label="جارٍ التحقق من الجلسة…" />;
  }

  if (status === "unauthenticated") {
    return <LoginPrompt />;
  }

  return (
    <>
      {showRestore && <SessionRestoreBanner onDismiss={() => { dismissed.current = true; setShowRestore(false); }} />}
      {children}
    </>
  );
}

// ---------------------------------------------------------------------------
// Restore banner — shown after re-auth when an interrupted session is found
// ---------------------------------------------------------------------------

function SessionRestoreBanner({ onDismiss }: { onDismiss: () => void }) {
  const { setView } = useViewStore();
  const saved = loadPendingExam();

  const handleResume = () => {
    if (!saved) return;
    clearPendingExam();
    setView(saved.view);
    onDismiss();
  };

  const handleDiscard = () => {
    clearPendingExam();
    onDismiss();
  };

  if (!saved) return null;

  return (
    <motion.div
      initial={{ opacity: 0, y: -12, scale: 0.95 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      transition={{ duration: 0.4, ease: "easeOut" }}
      className="mb-4"
    >
      <div className="relative overflow-hidden rounded-2xl bg-gradient-to-bl from-amber-500 via-amber-600 to-orange-700 text-white p-5 shadow-lg">
        {/* Decorative dots */}
        <div
          className="absolute inset-0 opacity-10 pointer-events-none"
          style={{
            backgroundImage:
              "radial-gradient(circle at 80% 20%, white 1px, transparent 1px)",
            backgroundSize: "30px 30px",
          }}
        />

        <div className="relative flex items-start gap-4">
          <div className="h-12 w-12 rounded-xl bg-white/20 backdrop-blur grid place-items-center shrink-0">
            <Clock className="h-6 w-6" />
          </div>

          <div className="flex-1 min-w-0">
            <h3 className="font-bold text-base mb-0.5">لديك {pendingSessionLabel(saved.view)} لم يُكتمل</h3>
            <p className="text-sm text-amber-100/90 leading-relaxed">
              تم حفظ تقدّمك. يمكنك استئناف {pendingSessionLabel(saved.view)} من حيث توقّفت.
            </p>

            {/* Quick stats */}
            <div className="mt-3 flex items-center gap-4 text-xs text-amber-100/80">
              <span>
                {saved.internal.selections
                  ? Object.values(saved.internal.selections).filter(Boolean).length
                  : 0} سؤال مُجاب
              </span>
              {saved.view.kind === "exam_running" && saved.internal.timeLeft > 0 && (
                <span>الوقت المتبقي: {Math.floor(saved.internal.timeLeft / 60)} دقيقة</span>
              )}
            </div>

            <div className="mt-3 flex items-center gap-2">
              <button
                onClick={handleResume}
                className="inline-flex items-center gap-1.5 rounded-full bg-white text-amber-700 px-4 py-2 text-xs font-bold hover:bg-amber-50 transition-colors shadow-sm"
              >
                <RotateCcw className="h-3.5 w-3.5" />
                <span>استئناف {pendingSessionLabel(saved.view)}</span>
              </button>
              <button
                onClick={handleDiscard}
                className="inline-flex items-center gap-1.5 rounded-full px-3 py-2 text-xs font-semibold text-amber-100/80 hover:text-white hover:bg-white/10 transition-colors"
              >
                <X className="h-3.5 w-3.5" />
                <span>تجاهل</span>
              </button>
            </div>
          </div>
        </div>
      </div>
    </motion.div>
  );
}

// ---------------------------------------------------------------------------
// Login prompt — polished landing card with sign-in button
// ---------------------------------------------------------------------------

function LoginPrompt() {
  const [mode, setMode] = useState<"login" | "signup">("login");
  const [loginLoading, setLoginLoading] = useState(false);
  const [loginError, setLoginError] = useState<string | null>(null);

  // Store credentials at submission time for reliable auto-login after signup
  const signupEmailRef = useRef("");
  const signupPasswordRef = useRef("");
  const [signupState, setSignupState] = useState<SignupResult | null>(null);
  const [signupPending, setSignupPending] = useState(false);

  // Auto-login after successful signup using captured ref values
  useEffect(() => {
    if (signupState?.success) {
      const email = signupEmailRef.current;
      const password = signupPasswordRef.current;
      if (email && password) {
        signIn("credentials", {
          email,
          password,
          callbackUrl: "/",
        });
      }
    }
  }, [signupState]);

  const handleSignup = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const form = e.currentTarget;
    const email = (form.elements.namedItem("email") as HTMLInputElement).value.trim();
    const password = (form.elements.namedItem("password") as HTMLInputElement).value;
    const name = (form.elements.namedItem("name") as HTMLInputElement).value.trim();

    // Capture credentials BEFORE the async call so they're available for auto-login
    signupEmailRef.current = email;
    signupPasswordRef.current = password;

    setSignupPending(true);
    try {
      const formData = new FormData();
      formData.set("name", name);
      formData.set("email", email);
      formData.set("password", password);

      const result = await signupWithEmail(null, formData);
      setSignupState(result);
    } catch {
      setSignupState({ success: false, error: "حدث خطأ غير متوقع. حاول مرة أخرى." });
    } finally {
      setSignupPending(false);
    }
  };

  const handleLogin = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setLoginError(null);

    const form = e.currentTarget;
    const email = (form.elements.namedItem("email") as HTMLInputElement).value.trim();
    const password = (form.elements.namedItem("password") as HTMLInputElement).value;

    if (!email || !password) {
      setLoginError("الرجاء إدخال البريد الإلكتروني وكلمة المرور");
      return;
    }

    setLoginLoading(true);
    try {
      const result = await signIn("credentials", {
        email,
        password,
        redirect: false,
      });

      if (result?.error) {
        setLoginError("البريد الإلكتروني أو كلمة المرور غير صحيحة");
      } else if (result?.ok) {
        // Force page reload to pick up the new session
        window.location.reload();
      }
    } catch {
      setLoginError("حدث خطأ. حاول مرة أخرى.");
    } finally {
      setLoginLoading(false);
    }
  };

  return (
    <div className="min-h-[70vh] flex items-center justify-center p-4">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.6, ease: "easeOut" }}
        className="w-full max-w-lg"
      >
        <div className="relative overflow-hidden rounded-3xl bg-gradient-to-bl from-emerald-700 via-emerald-800 to-teal-900 text-white p-8 sm:p-10 shadow-lg">
          <div
            className="absolute inset-0 opacity-10 pointer-events-none"
            style={{
              backgroundImage:
                "radial-gradient(circle at 20% 30%, white 1px, transparent 1px), radial-gradient(circle at 70% 60%, white 1px, transparent 1px)",
              backgroundSize: "40px 40px, 60px 60px",
            }}
          />

          <div className="relative space-y-6">
            {/* Logo + Title */}
            <div className="flex items-center gap-3">
              <div className="h-14 w-14 rounded-2xl bg-white/20 backdrop-blur grid place-items-center shadow-inner">
                <img
                  src="/logo-splash.png"
                  alt=""
                  width={40}
                  height={40}
                  className="h-9 w-9 object-contain"
                  draggable={false}
                />
              </div>
              <div className="text-right">
                <h1 className="font-display text-2xl font-bold">منصة همّة التعليمية</h1>
                <p className="text-sm text-emerald-100/80">التحضير المتميّز لاختبار القدرات اللفظية</p>
              </div>
            </div>

            <div className="border-t border-white/10" />

            {/* Features grid */}
            <div className="grid grid-cols-2 gap-3">
              <div className="flex items-center gap-2 rounded-xl bg-white/10 backdrop-blur p-3">
                <BookOpen className="h-4 w-4 text-emerald-200 shrink-0" />
                <span className="text-xs font-medium">مذاكرة بتفسير فوري</span>
              </div>
              <div className="flex items-center gap-2 rounded-xl bg-white/10 backdrop-blur p-3">
                <Target className="h-4 w-4 text-emerald-200 shrink-0" />
                <span className="text-xs font-medium">اختبارات وقتية</span>
              </div>
              <div className="flex items-center gap-2 rounded-xl bg-white/10 backdrop-blur p-3">
                <Sparkles className="h-4 w-4 text-emerald-200 shrink-0" />
                <span className="text-xs font-medium">مراجعة ذكية للأخطاء</span>
              </div>
              <div className="flex items-center gap-2 rounded-xl bg-white/10 backdrop-blur p-3">
                <Shield className="h-4 w-4 text-emerald-200 shrink-0" />
                <span className="text-xs font-medium">تتبّع التقدّم والإتقان</span>
              </div>
            </div>

            {/* ── Tab switcher: Login / Signup ── */}
            <div className="flex rounded-xl bg-white/10 backdrop-blur p-1">
              <button
                onClick={() => setMode("login")}
                className={`flex-1 rounded-lg py-2 text-sm font-semibold transition-all ${
                  mode === "login"
                    ? "bg-white text-emerald-800 shadow-sm"
                    : "text-emerald-100/70 hover:text-white"
                }`}
              >
                تسجيل الدخول
              </button>
              <button
                onClick={() => setMode("signup")}
                className={`flex-1 rounded-lg py-2 text-sm font-semibold transition-all ${
                  mode === "signup"
                    ? "bg-white text-emerald-800 shadow-sm"
                    : "text-emerald-100/70 hover:text-white"
                }`}
              >
                إنشاء حساب
              </button>
            </div>

            {/* ── Login Form ── */}
            {mode === "login" && (
              <form onSubmit={handleLogin} className="space-y-3">
                <div className="space-y-1">
                  <label htmlFor="login-email" className="text-xs font-medium text-emerald-100/80">
                    البريد الإلكتروني
                  </label>
                  <div className="relative">
                    <Mail className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-emerald-300/60" />
                    <input
                      id="login-email"
                      name="email"
                      type="email"
                      autoComplete="email"
                      placeholder="name@example.com"
                      dir="ltr"
                      className="w-full rounded-xl bg-white/10 backdrop-blur border border-white/10 text-white placeholder:text-emerald-200/40 px-10 py-2.5 text-sm outline-none focus:ring-2 focus:ring-white/30 transition-all"
                    />
                  </div>
                </div>

                <div className="space-y-1">
                  <label htmlFor="login-password" className="text-xs font-medium text-emerald-100/80">
                    كلمة المرور
                  </label>
                  <div className="relative">
                    <Lock className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-emerald-300/60" />
                    <input
                      id="login-password"
                      name="password"
                      type="password"
                      autoComplete="current-password"
                      placeholder="••••••••"
                      dir="ltr"
                      className="w-full rounded-xl bg-white/10 backdrop-blur border border-white/10 text-white placeholder:text-emerald-200/40 px-10 py-2.5 text-sm outline-none focus:ring-2 focus:ring-white/30 transition-all"
                    />
                  </div>
                </div>

                {loginError && (
                  <motion.p
                    initial={{ opacity: 0, y: -4 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="text-xs text-rose-300 font-medium"
                  >
                    {loginError}
                  </motion.p>
                )}

                <button
                  type="submit"
                  disabled={loginLoading}
                  className="w-full inline-flex items-center justify-center gap-2 rounded-xl bg-white text-emerald-800 px-6 py-2.5 text-sm font-bold hover:bg-emerald-50 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {loginLoading ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <LogIn className="h-4 w-4" />
                  )}
                  <span>{loginLoading ? "جاري تسجيل الدخول…" : "تسجيل الدخول"}</span>
                </button>
              </form>
            )}

            {/* ── Signup Form ── */}
            {mode === "signup" && (
              <form onSubmit={handleSignup} className="space-y-3">
                <div className="space-y-1">
                  <label htmlFor="signup-name" className="text-xs font-medium text-emerald-100/80">
                    الاسم
                  </label>
                  <div className="relative">
                    <UserIcon className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-emerald-300/60" />
                    <input
                      id="signup-name"
                      name="name"
                      type="text"
                      autoComplete="name"
                      placeholder="الاسم الثلاثي"
                      className="w-full rounded-xl bg-white/10 backdrop-blur border border-white/10 text-white placeholder:text-emerald-200/40 px-10 py-2.5 text-sm outline-none focus:ring-2 focus:ring-white/30 transition-all"
                    />
                  </div>
                </div>

                <div className="space-y-1">
                  <label htmlFor="signup-email" className="text-xs font-medium text-emerald-100/80">
                    البريد الإلكتروني
                  </label>
                  <div className="relative">
                    <Mail className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-emerald-300/60" />
                    <input
                      id="signup-email"
                      name="email"
                      type="email"
                      autoComplete="email"
                      placeholder="name@example.com"
                      dir="ltr"
                      className="w-full rounded-xl bg-white/10 backdrop-blur border border-white/10 text-white placeholder:text-emerald-200/40 px-10 py-2.5 text-sm outline-none focus:ring-2 focus:ring-white/30 transition-all"
                    />
                  </div>
                </div>

                <div className="space-y-1">
                  <label htmlFor="signup-password" className="text-xs font-medium text-emerald-100/80">
                    كلمة المرور
                  </label>
                  <div className="relative">
                    <Lock className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-emerald-300/60" />
                    <input
                      id="signup-password"
                      name="password"
                      type="password"
                      autoComplete="new-password"
                      placeholder="٦ أحرف على الأقل"
                      dir="ltr"
                      className="w-full rounded-xl bg-white/10 backdrop-blur border border-white/10 text-white placeholder:text-emerald-200/40 px-10 py-2.5 text-sm outline-none focus:ring-2 focus:ring-white/30 transition-all"
                    />
                  </div>
                </div>

                {signupState && !signupState.success && (
                  <motion.p
                    initial={{ opacity: 0, y: -4 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="text-xs text-rose-300 font-medium"
                  >
                    {signupState.error}
                  </motion.p>
                )}

                <button
                  type="submit"
                  disabled={signupPending}
                  className="w-full inline-flex items-center justify-center gap-2 rounded-xl bg-white text-emerald-800 px-6 py-2.5 text-sm font-bold hover:bg-emerald-50 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {signupPending ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <UserIcon className="h-4 w-4" />
                  )}
                  <span>{signupPending ? "جاري إنشاء الحساب…" : "إنشاء حساب جديد"}</span>
                </button>
              </form>
            )}

            {/* ── Divider ── */}
            <div className="flex items-center gap-3">
              <div className="flex-1 h-px bg-white/10" />
              <span className="text-[11px] text-emerald-100/50">أو</span>
              <div className="flex-1 h-px bg-white/10" />
            </div>

            {/* ── Google button ── */}
            <button
              onClick={() => signIn("google", { callbackUrl: "/" })}
              className="w-full inline-flex items-center justify-center gap-2.5 rounded-xl bg-white/10 backdrop-blur border border-white/10 px-6 py-2.5 text-sm font-semibold hover:bg-white/20 transition-all group"
            >
              <svg className="h-5 w-5" viewBox="0 0 24 24">
                <path
                  fill="currentColor"
                  d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z"
                />
                <path
                  fill="currentColor"
                  d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                />
                <path
                  fill="currentColor"
                  d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
                />
                <path
                  fill="currentColor"
                  d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
                />
              </svg>
              <span>{mode === "login" ? "تسجيل الدخول" : "إنشاء حساب"} بـ Google</span>
            </button>

            <p className="text-center text-[11px] text-emerald-100/60">
              بالتسجيل، أنت توافق على{" "}
              <a href="/terms" target="_blank" className="underline hover:text-white transition-colors">
                شروط الاستخدام
              </a>{" "}
              و{" "}
              <a href="/privacy" target="_blank" className="underline hover:text-white transition-colors">
                سياسة الخصوصية
              </a>
            </p>
          </div>
        </div>
      </motion.div>
    </div>
  );
}
