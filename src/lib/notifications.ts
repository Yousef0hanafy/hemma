"use client";

// =====================================================================
// Notification Utilities — browser push notifications for review
// reminders and streak-at-risk alerts
// =====================================================================

// ---------------------------------------------------------------------------
// Permission
// ---------------------------------------------------------------------------

export type NotificationPermissionStatus = "granted" | "denied" | "default";

/** Check if the browser supports the Notification API. */
export function supportsNotifications(): boolean {
  return typeof Notification !== "undefined";
}

/** Get current notification permission status. */
export function getPermissionStatus(): NotificationPermissionStatus {
  if (!supportsNotifications()) return "denied";
  return Notification.permission;
}

/** Request notification permission from the user. Returns the granted status. */
export async function requestPermission(): Promise<NotificationPermissionStatus> {
  if (!supportsNotifications()) return "denied";
  try {
    const result = await Notification.requestPermission();
    return result;
  } catch {
    return "denied";
  }
}

// ---------------------------------------------------------------------------
// Local notification helpers
// ---------------------------------------------------------------------------

/**
 * Show a simple notification.
 * If the service worker is active, send it via SW for background handling.
 */
export function showLocalNotification(
  title: string,
  options?: {
    body?: string;
    icon?: string;
    badge?: string;
    tag?: string;
    data?: Record<string, unknown>;
    requireInteraction?: boolean;
  }
): Notification | null {
  if (!supportsNotifications()) return null;
  if (Notification.permission !== "granted") return null;

  try {
    const notif = new Notification(title, {
      body: options?.body,
      icon: options?.icon ?? "/icon-512.png",
      badge: options?.badge,
      tag: options?.tag, // same tag = replaces previous
      data: options?.data ?? {},
      requireInteraction: options?.requireInteraction ?? false,
      dir: "rtl",
      lang: "ar",
    });

    notif.onclick = () => {
      window.focus();
      notif.close();
    };

    return notif;
  } catch {
    return null;
  }
}

// ---------------------------------------------------------------------------
// Notification preferences (stored in localStorage for now)
// ---------------------------------------------------------------------------

interface NotificationPrefs {
  reviewReminder: boolean;
  streakAlert: boolean;
  /** Last date we showed each notification type ("YYYY-MM-DD" key → shown) */
  lastShown: Record<string, string>;
}

const PREFS_KEY = "hemma-notification-prefs";
const DEFAULT_PREFS: NotificationPrefs = {
  reviewReminder: true,
  streakAlert: true,
  lastShown: {},
};

function loadPrefs(): NotificationPrefs {
  if (typeof window === "undefined") return { ...DEFAULT_PREFS };
  try {
    const raw = localStorage.getItem(PREFS_KEY);
    if (!raw) return { ...DEFAULT_PREFS };
    return { ...DEFAULT_PREFS, ...JSON.parse(raw) };
  } catch {
    return { ...DEFAULT_PREFS };
  }
}

function savePrefs(prefs: NotificationPrefs): void {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(PREFS_KEY, JSON.stringify(prefs));
  } catch {
    // Silently fail
  }
}

export function getNotificationPrefs(): NotificationPrefs {
  return loadPrefs();
}

export function setNotificationPrefs(partial: Partial<NotificationPrefs>): void {
  const prefs = loadPrefs();
  Object.assign(prefs, partial);
  savePrefs(prefs);
}

// ---------------------------------------------------------------------------
// Check scheduling — prevent spamming the same notification type per day
// ---------------------------------------------------------------------------

function todayKey(): string {
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

/**
 * Check if we've already shown a notification with the given key today.
 * If `mark` is true, marks it as shown.
 */
function wasShownToday(key: string): boolean {
  const prefs = loadPrefs();
  return prefs.lastShown[key] === todayKey();
}

function markShownToday(key: string): void {
  const prefs = loadPrefs();
  prefs.lastShown[key] = todayKey();
  savePrefs(prefs);
}

// ---------------------------------------------------------------------------
// Specific notification triggers
// ---------------------------------------------------------------------------

/** Check type for the review reminder. */
export type ReviewReminderData = {
  type: "review_reminder";
  count: number;
};

/** Check type for the streak-at-risk alert. */
export type StreakAlertData = {
  type: "streak_alert";
  streak: number;
};

/**
 * Show a daily review reminder notification.
 * Returns true if a notification was shown, false if already shown today or permission denied.
 */
export function showReviewReminder(count: number): boolean {
  const prefs = loadPrefs();
  if (!prefs.reviewReminder) return false;
  if (wasShownToday("review_reminder")) return false;

  const notif = showLocalNotification("📚 لديك مراجعة اليوم!", {
    body: `لديك ${count} بطاقة للمراجعة. افتح التطبيق وراجع الآن!`,
    tag: "hemma-review-reminder",
    requireInteraction: true,
    data: { type: "review_reminder", count },
  });

  if (notif) {
    markShownToday("review_reminder");
    return true;
  }
  return false;
}

/**
 * Show a streak-at-risk alert.
 * Returns true if a notification was shown.
 */
export function showStreakAlert(streak: number): boolean {
  const prefs = loadPrefs();
  if (!prefs.streakAlert) return false;
  if (wasShownToday("streak_alert")) return false;

  const notif = showLocalNotification("🔥 سلسلتك في خطر!", {
    body: `لديك سلسلة من ${streak} يوم ولم تذاكر اليوم. لا تدعها تنقطع!`,
    tag: "hemma-streak-alert",
    requireInteraction: true,
    data: { type: "streak_alert", streak },
  });

  if (notif) {
    markShownToday("streak_alert");
    return true;
  }
  return false;
}

// ---------------------------------------------------------------------------
// Debug helpers
// ---------------------------------------------------------------------------

/** Clear all "shown today" marks (for testing). */
export function resetNotificationState(): void {
  const prefs = loadPrefs();
  prefs.lastShown = {};
  savePrefs(prefs);
}
