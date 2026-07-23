import { getServerSession } from "next-auth";
import { authOptions } from "./auth";

/**
 * Returns the authenticated user's ID to use as `userBucket`.
 * Throws if the user is not signed in.
 */
export async function getUserBucket(): Promise<string> {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    throw new Error("Not authenticated — user must sign in first");
  }
  return session.user.id;
}
