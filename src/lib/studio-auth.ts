import { db } from "@/lib/db";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";

// Roles that are allowed inside the Studio
const STUDIO_ROLES = ["editor", "reviewer", "admin"] as const;
type StudioRole = (typeof STUDIO_ROLES)[number];

/**
 * Require the user to be logged in AND hold a studio role
 * (editor | reviewer | admin).  Throws an Arabic error on failure.
 *
 * Use this guard in ALL studio server actions.
 */
export async function requireStudioAccess(): Promise<string> {
  const session = await getServerSession(authOptions);

  if (!session?.user?.id) {
    throw new Error("يجب تسجيل الدخول أولاً");
  }

  const role = (session.user as any).role as string;
  if (!(STUDIO_ROLES as readonly string[]).includes(role)) {
    throw new Error("ليس لديك صلاحية الوصول إلى الاستوديو");
  }

  return session.user.id;
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
  const session = await getServerSession(authOptions);

  if (!session?.user?.id) {
    throw new Error("يجب تسجيل الدخول أولاً");
  }

  const role = (session.user as any).role as string;
  if (role !== "admin") {
    throw new Error(errorMessage ?? "ليس لديك صلاحية الوصول إلى هذه الميزة");
  }

  return session.user.id;
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
