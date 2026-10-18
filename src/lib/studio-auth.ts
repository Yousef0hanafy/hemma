import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";

// Roles that are allowed inside the Studio
export const STUDIO_ROLES = ["editor", "reviewer", "admin"] as const;
/** Roles that may change content (questions, sources, categories, imports, AI jobs) */
export const EDITOR_ROLES = ["editor", "admin"] as const;

/**
 * Resolve the current session and require one of `allowed` roles.
 * The role comes from the JWT, which the jwt callback refreshes from the DB
 * on every request — so demotions take effect immediately.
 */
async function requireRoleIn(
  allowed: readonly string[],
  errorMessage: string
): Promise<string> {
  const session = await getServerSession(authOptions);

  if (!session?.user?.id) {
    throw new Error("يجب تسجيل الدخول أولاً");
  }

  if (!allowed.includes(session.user.role)) {
    throw new Error(errorMessage);
  }

  return session.user.id;
}

/**
 * Require the user to be logged in AND hold a studio role
 * (editor | reviewer | admin).  Throws an Arabic error on failure.
 *
 * Use this guard (or a stricter one below) in ALL studio server actions.
 */
export async function requireStudioAccess(): Promise<string> {
  return requireRoleIn(
    STUDIO_ROLES,
    "ليس لديك صلاحية الوصول إلى الاستوديو (مطلوب حساب مدير أو محرر)"
  );
}

/**
 * Require a role that may modify content (editor | admin).
 */
export async function requireEditorAccess(): Promise<string> {
  return requireRoleIn(
    EDITOR_ROLES,
    "ليس لديك صلاحية تعديل المحتوى (مطلوب حساب محرر أو مدير)"
  );
}

/**
 * Require the user to be logged in and return their user ID.
 * Does NOT check role — suitable for student-facing server actions
 * where any authenticated user may proceed.
 */
export async function requireAuth(): Promise<string> {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    throw new Error("يجب تسجيل الدخول أولاً");
  }
  return session.user.id;
}

/**
 * Require the user to be logged in AND have admin role.
 * Throws an Arabic error if unauthenticated or not an admin.
 */
export async function requireAdminAccess(
  errorMessage?: string
): Promise<string> {
  return requireRoleIn(
    ["admin"],
    errorMessage ?? "ليس لديك صلاحية الوصول إلى هذه الميزة (مطلوب حساب مدير)"
  );
}

// ---------------------------------------------------------------------------
// Input validation helpers (used by studio server actions)
// ---------------------------------------------------------------------------

/**
 * Validate that a string is a valid ID format
 */
export function isValidId(id: unknown): boolean {
  if (!id || typeof id !== "string") return false;
  // CUID / UUID / alphanumeric ID — reject anything with special chars
  return /^[a-zA-Z0-9_-]+$/.test(id) && id.length <= 128;
}

/**
 * Validate that a string is within acceptable length bounds
 */
export function isValidLength(
  value: unknown,
  maxLength: number,
  minLength: number = 1
): boolean {
  if (!value || typeof value !== "string") return false;
  const trimmed = value.trim();
  return trimmed.length >= minLength && trimmed.length <= maxLength;
}

/**
 * Validate that a value is one of the allowed enum values
 */
export function isValidEnum<T extends string>(
  value: unknown,
  allowedValues: readonly T[]
): value is T {
  return typeof value === "string" && allowedValues.includes(value as T);
}
