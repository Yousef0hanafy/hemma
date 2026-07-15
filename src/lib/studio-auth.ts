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
