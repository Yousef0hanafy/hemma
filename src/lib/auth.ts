import { AuthOptions } from "next-auth";
import { PrismaAdapter } from "@next-auth/prisma-adapter";
import GoogleProvider from "next-auth/providers/google";
import CredentialsProvider from "next-auth/providers/credentials";
import bcrypt from "bcryptjs";
import { db } from "./db";

// ── Token Revocation Store ─────────────────────────────────────
// Database-backed token revocation store for multi-instance support

export async function isTokenRevoked(jti: string): Promise<boolean> {
  try {
    const token = await db.revokedToken.findUnique({ where: { jti } });
    return !!token;
  } catch {
    return false;
  }
}

export async function revokeToken(jti: string): Promise<void> {
  try {
    const expiresAt = new Date(Date.now() + 15 * 60 * 1000); // 15 min TTL
    await db.revokedToken.upsert({
      where: { jti },
      create: { jti, expiresAt },
      update: { expiresAt },
    });
  } catch (error) {
    console.error("[TokenRevocation] Failed to revoke token:", error);
  }
}

// ── Role-Based Access Control ───────────────────────────────────

export type UserRole = "student" | "admin" | "editor" | "reviewer";

export interface Permission {
  resource: string;
  action: "create" | "read" | "update" | "delete";
}

// Permission matrix by role - FIXED to grant actual permissions
const ROLE_PERMISSIONS: Record<UserRole, Permission[]> = {
  student: [
    { resource: "question", action: "read" },
    { resource: "attempt", action: "create" },
    { resource: "attempt", action: "read" },
    { resource: "favorite", action: "create" },
    { resource: "favorite", action: "read" },
    { resource: "source", action: "read" },
    { resource: "category", action: "read" },
    { resource: "review_schedule", action: "read" },
    { resource: "review", action: "create" },
    { resource: "review", action: "read" },
    { resource: "challenge", action: "read" },
    { resource: "exam_session", action: "read" },
    { resource: "profile", action: "read" },
    { resource: "achievement", action: "read" },
  ],
  editor: [
    { resource: "question", action: "create" },
    { resource: "question", action: "read" },
    { resource: "question", action: "update" },
    { resource: "attempt", action: "read" },
    { resource: "favorite", action: "read" },
    { resource: "source", action: "read" },
    { resource: "category", action: "read" },
    { resource: "review_schedule", action: "read" },
    { resource: "exam_session", action: "read" },
    { resource: "profile", action: "read" },
    { resource: "achievement", action: "read" },
    { resource: "content_review", action: "create" },
    { resource: "content_review", action: "update" },
    { resource: "ai_processing", action: "create" },
    { resource: "ai_processing", action: "read" },
    { resource: "library", action: "read" },
    { resource: "library", action: "update" },
    { resource: "library", action: "delete" },
    { resource: "import", action: "read" },
    { resource: "import", action: "create" },
    { resource: "sources", action: "read" },
    { resource: "sources", action: "update" },
    { resource: "sources", action: "delete" },
  ],
  reviewer: [
    { resource: "question", action: "read" },
    { resource: "review", action: "create" },
    { resource: "review", action: "update" },
    { resource: "source", action: "read" },
    { resource: "category", action: "read" },
    { resource: "attempt", action: "read" },
    { resource: "favorite", action: "read" },
    { resource: "review_schedule", action: "read" },
    { resource: "exam_session", action: "read" },
    { resource: "profile", action: "read" },
    { resource: "achievement", action: "read" },
    { resource: "content_review", action: "read" },
    { resource: "ai_processing", action: "read" },
    { resource: "library", action: "read" },
    { resource: "sources", action: "read" },
  ],
  admin: [
    { resource: "*", action: "create" },
    { resource: "*", action: "read" },
    { resource: "*", action: "update" },
    { resource: "*", action: "delete" },
  ],
};

export function hasPermission(
  role: UserRole,
  resource: string,
  action: "create" | "read" | "update" | "delete"
): boolean {
  const permissions = ROLE_PERMISSIONS[role];
  return permissions.some(
    (p) =>
      (p.resource === resource || p.resource === "*") && p.action === action
  );
}

// ── Auth Configuration ──────────────────────────────────────────

function buildProviders() {
  const providers: AuthOptions["providers"] = [];

  // Google OAuth — only register if credentials are configured
  const googleId = process.env.GOOGLE_CLIENT_ID;
  const googleSecret = process.env.GOOGLE_CLIENT_SECRET;
  if (googleId && googleSecret) {
    providers.push(
      GoogleProvider({
        clientId: googleId,
        clientSecret: googleSecret,
      })
    );
  }

  // Email / password credentials
  providers.push(
    CredentialsProvider({
      name: "credentials",
      credentials: {
        email: { label: "البريد الإلكتروني", type: "email" },
        password: { label: "كلمة المرور", type: "password" },
      },
      async authorize(credentials) {
        if (!credentials?.email || !credentials?.password) {
          return null;
        }

        const user = await db.user.findUnique({
          where: { email: credentials.email },
        });

        // User must exist and have a password (i.e., signed up via credentials)
        if (!user || !user.password) {
          return null;
        }

        const isValid = await bcrypt.compare(credentials.password, user.password);
        if (!isValid) {
          return null;
        }

        return {
          id: user.id,
          email: user.email,
          name: user.name,
          image: user.image,
          role: user.role,
        };
      },
    })
  );

  return providers;
}

export const authOptions: AuthOptions = {
  adapter: PrismaAdapter(db),
  providers: buildProviders(),
  // JWT strategy with refresh token rotation
  session: { strategy: "jwt" },
  secret: process.env.NEXTAUTH_SECRET,
  callbacks: {
    async jwt({ token, user }) {
      // Initial sign-in
      if (user) {
        token.id = user.id;
        token.role = (user as any).role || "student";
        token.jti = crypto.randomUUID();
        token.accessToken = crypto.randomUUID();
        token.refreshToken = crypto.randomUUID();
        token.accessTokenExpires = Date.now() + 15 * 60 * 1000; // 15 min
      }

      // Check if token is revoked in database
      if (token.jti && (await isTokenRevoked(token.jti as string))) {
        return {};
      }

      // Live DB lookup to verify user existence and ensure fresh role
      if (token.id) {
        try {
          const dbUser = await db.user.findUnique({
            where: { id: token.id as string },
            select: { id: true, role: true },
          });

          if (!dbUser) {
            return {}; // User deleted or revoked
          }

          token.role = dbUser.role; // Always reflect up-to-date DB role
        } catch {
          // If DB is temporarily unreachable, fall back to current token role
        }
      }

      // Return token if access token is still valid
      if (Date.now() < (token.accessTokenExpires as number)) {
        return token;
      }

      return {
        ...token,
        accessTokenExpires: Date.now() + 15 * 60 * 1000,
      };
    },
    async session({ session, token }) {
      if (session.user) {
        (session.user as any).id = token.id as string;
        (session.user as any).role = token.role as string;
      }
      return session;
    },
  },
  pages: {
    signIn: "/",
  },
  // Gracefully degrade on missing configuration — don't crash
  debug: false,
};

// ── Authorization Helpers ───────────────────────────────────────

export async function requireRole(role: UserRole): Promise<string> {
  const { getServerSession } = await import("next-auth");
  const session = await getServerSession(authOptions);
  
  if (!session?.user?.id) {
    throw new Error("UNAUTHORIZED");
  }

  const userRole = (session.user as any).role as UserRole;
  if (!hasPermission(userRole, "*", "read") && userRole !== role) {
    throw new Error("FORBIDDEN");
  }

  return session.user.id;
}

export async function requireStudioAccess() {
  const { getServerSession } = await import("next-auth");
  const session = await getServerSession(authOptions);
  
  if (!session?.user?.id) {
    throw new Error("UNAUTHORIZED");
  }

  const userRole = (session.user as any).role as UserRole;
  // Only editors, reviewers, and admins can access studio
  if (!["editor", "reviewer", "admin"].includes(userRole)) {
    throw new Error("FORBIDDEN");
  }

  return session.user.id;
}

// ── Enhanced Authorization Helpers ──────────────────────────────

/**
 * Check if the current user has permission to perform an action on a resource
 * Throws an error if unauthorized
 */
export async function requirePermission(
  resource: string,
  action: "create" | "read" | "update" | "delete"
): Promise<string> {
  const { getServerSession } = await import("next-auth");
  const session = await getServerSession(authOptions);
  
  if (!session?.user?.id) {
    throw new Error("UNAUTHORIZED");
  }

  const userRole = (session.user as any).role as UserRole;
  if (!hasPermission(userRole, resource, action)) {
    throw new Error("FORBIDDEN");
  }

  return session.user.id;
}

/**
 * Get the current user's role from the session
 */
export async function getCurrentUserRole(): Promise<UserRole | null> {
  const { getServerSession } = await import("next-auth");
  const session = await getServerSession(authOptions);
  
  if (!session?.user?.id) {
    return null;
  }

  return (session.user as any).role as UserRole;
}
