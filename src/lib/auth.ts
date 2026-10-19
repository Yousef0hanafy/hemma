import { AuthOptions } from "next-auth";
import { PrismaAdapter } from "@next-auth/prisma-adapter";
import GoogleProvider from "next-auth/providers/google";
import CredentialsProvider from "next-auth/providers/credentials";
import bcrypt from "bcryptjs";
import { db } from "./db";
import { clientIpFromHeaders, consumeRateLimit, RATE_LIMITS } from "./rate-limiter";

/** Error code surfaced to the client by signIn() when login is throttled. */
export const LOGIN_RATE_LIMITED = "RATE_LIMITED";

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

// bcrypt hash (cost 12) of a random throwaway string — compared against when
// no user matches, to equalise login timing.
const DUMMY_PASSWORD_HASH = "$2b$12$75zbw3fAPjqqbBNzoj8BkO5U9mDnsfKjTi6EkJChda57jgrtRBQhG";

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
      async authorize(credentials, req) {
        if (!credentials?.email || !credentials?.password) {
          return null;
        }

        // Brute-force protection: per email and per client IP
        const [perEmail, perIp] = await Promise.all([
          consumeRateLimit(RATE_LIMITS.loginPerEmail, credentials.email.trim().toLowerCase()),
          consumeRateLimit(RATE_LIMITS.loginPerIp, clientIpFromHeaders(req?.headers)),
        ]);
        if (!perEmail.success || !perIp.success) {
          throw new Error(LOGIN_RATE_LIMITED);
        }

        const user = await db.user.findFirst({
          where: { email: { equals: credentials.email.trim(), mode: "insensitive" } },
        });

        // Always run one bcrypt compare so response time doesn't reveal
        // whether the email is registered.
        const hash = user?.password ?? DUMMY_PASSWORD_HASH;
        const isValid = await bcrypt.compare(credentials.password, hash);

        // User must exist and have a password (i.e., signed up via credentials)
        if (!user || !user.password) {
          return null;
        }
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
  session: {
    strategy: "jwt",
    maxAge: 30 * 24 * 60 * 60, // 30 days maximum session lifespan
  },
  secret: process.env.NEXTAUTH_SECRET,
  callbacks: {
    async jwt({ token, user, account, profile }) {
      // Initial sign-in
      if (user) {
        token.id = user.id;
        token.role = (user as any).role || "student";

        // Bootstrap the owner account: ADMIN_EMAIL is promoted only when the
        // email is proven by Google (credentials signups are unverified).
        const adminEmail = process.env.ADMIN_EMAIL?.trim().toLowerCase();
        const googleVerified =
          account?.provider === "google" &&
          (profile as { email_verified?: boolean } | undefined)?.email_verified === true;
        if (
          adminEmail &&
          googleVerified &&
          user.email?.toLowerCase() === adminEmail &&
          token.role !== "admin"
        ) {
          await db.user.update({ where: { id: user.id }, data: { role: "admin" } });
          token.role = "admin";
        }
      }

      // Live DB lookup on every request: a deleted user loses access and a
      // role change (promotion/demotion) applies immediately — this is the
      // session "revocation" mechanism for these stateless JWTs.
      if (token.id) {
        try {
          const dbUser = await db.user.findUnique({
            where: { id: token.id as string },
            select: { id: true, role: true },
          });

          if (!dbUser) {
            return {}; // User deleted or deactivated -> fail closed
          }

          token.role = dbUser.role; // Always reflect up-to-date DB role
        } catch (error) {
          // Fail-closed on database connection/lookup errors to prevent unauthorized role escalation
          console.error("[Auth] Database error verifying user session:", error);
          return {};
        }
      }

      return token;
    },
    async session({ session, token }) {
      if (session.user) {
        session.user.id = token.id as string;
        session.user.role = token.role as string;
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

  const userRole = session.user.role as UserRole;
  if (!hasPermission(userRole, resource, action)) {
    throw new Error("FORBIDDEN");
  }

  return session.user.id;
}
