// =====================================================================
// Database Connectivity Check — admin-only diagnostic endpoint
// Requires an authenticated admin session or the DB_CHECK_SECRET header.
// =====================================================================

import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { db } from "@/lib/db";

export async function GET(request: Request) {
  // Gate 1: Accept a shared secret from env for CI/ops tooling
  const secret = process.env.DB_CHECK_SECRET;
  const headerSecret = request.headers.get("x-db-check-secret");
  if (secret && headerSecret === secret) {
    return runCheck();
  }

  // Gate 2: Require an authenticated admin session
  const session = await getServerSession(authOptions);
  const role = (session?.user as any)?.role as string | undefined;

  if (!session?.user?.id || role !== "admin") {
    return NextResponse.json(
      { error: "Unauthorized. Admin access required." },
      { status: 401 }
    );
  }

  return runCheck();
}

async function runCheck() {
  const results: Record<string, unknown> = {
    timestamp: new Date().toISOString(),
    node_env: process.env.NODE_ENV || "not set",
    database_url_set: !!process.env.DATABASE_URL,
    database_url_format_valid: /^postgresql:\/\//.test(
      process.env.DATABASE_URL || ""
    ),
    env_present: {
      GOOGLE_CLIENT_ID: !!process.env.GOOGLE_CLIENT_ID,
      GOOGLE_CLIENT_SECRET: !!process.env.GOOGLE_CLIENT_SECRET,
      NEXTAUTH_URL: process.env.NEXTAUTH_URL ? "SET" : "NOT SET",
      NEXTAUTH_SECRET: !!process.env.NEXTAUTH_SECRET,
      GOOGLE_API_KEY: !!process.env.GOOGLE_API_KEY,
    },
  };

  // Attempt database connection
  try {
    const start = Date.now();
    const userCount = await db.user.count();
    const sourceCount = await db.source.count();
    const questionCount = await db.question.count();
    const duration = Date.now() - start;

    results.database = {
      status: "connected",
      latency_ms: duration,
      counts: {
        users: userCount,
        sources: sourceCount,
        questions: questionCount,
      },
    };
  } catch (error) {
    results.database = {
      status: "connection_failed",
      error: error instanceof Error ? error.message : "Unknown error",
    };
  }

  return NextResponse.json(results, { status: 200 });
}
