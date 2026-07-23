import { AuthOptions } from "next-auth";
import { PrismaAdapter } from "@next-auth/prisma-adapter";
import GoogleProvider from "next-auth/providers/google";
import CredentialsProvider from "next-auth/providers/credentials";
import bcrypt from "bcryptjs";
import { db } from "./db";

// ── Token Revocation Store ─────────────────────────────────────
// In production, use Redis or database-backed store
const revokedTokens = new Set<string>();

export function isTokenRevoked(jti: string): boolean {
  return revokedTokens.has(jti);
}

export function revokeToken(jti: string): void {
  revokedTokens.add(jti);
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
    { resource: "favorite", action: "create" },
    { resource: "source", action: "read" },
    { resource: "category", action: "read" },
    { resource: "review_schedule", action: "read" },
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
    async jwt({ token, user, account }) {
      // Initial sign-in
      if (user) {
        token.id = user.id;
        token.role = (user as any).role || "student";
        token.jti = crypto.randomUUID();
        token.accessToken = crypto.randomUUID();
        token.refreshToken = crypto.randomUUID();
        token.accessTokenExpires = Date.now() + 15 * 60 * 1000; // 15 min
      }

      // Check if token is revoked
      if (token.jti && isTokenRevoked(token.jti as string)) {
        return {};
      }

      // Return previous token if access token is still valid
      if (Date.now() < (token.accessTokenExpires as number)) {
        return token;
      }

      // Access token has expired - try to refresh
      // In a full implementation, this would call a refresh endpoint
      // For now, we'll just extend the expiration
      return {
        ...token,
        accessTokenExpires: Date.now() + 15 * 60 * 1000,
      };
    },
    async session({ session, token }) {
      if (session.user) {
        (session.user as { id: string; role: string }).id = token.id as string;
        (session.user as { role: string }).role = token.role as string;
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
