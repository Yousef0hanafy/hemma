import { db } from "@/lib/db";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";

/**
 * Require the user to be logged in and return their user ID.
 * Throws an error with an Arabic message if unauthenticated.
 * Designed for use in server actions within the Studio.
 */
export async function requireStudioAccess(): Promise<string> {
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
  const userId = await requireStudioAccess();

  const user = await db.user.findUnique({
    where: { id: userId },
    select: { role: true },
  });

  if (user?.role !== "admin") {
    throw new Error(errorMessage ?? "ليس لديك صلاحية الوصول إلى هذه الميزة");
  }

  return userId;
}

/**
 * Validate that a string is a valid ID format
 */
export function isValidId(id: unknown): boolean {
  if (!id || typeof id !== "string") return false;
  // Basic UUID or alphanumeric ID validation
  return /^[a-zA-Z0-9_-]+$/.test(id);
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
