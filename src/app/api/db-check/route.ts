// =====================================================================
// Database Connectivity Check — diagnostic endpoint for debugging
// Visit http://localhost:3000/api/db-check to test DB connection
// =====================================================================

import { NextResponse } from "next/server";
import { db } from "@/lib/db";

export async function GET() {
  const results: Record<string, unknown> = {
    timestamp: new Date().toISOString(),
    node_env: process.env.NODE_ENV || "not set",
    database_url_set: !!process.env.DATABASE_URL,
    database_url_format_valid: /^postgresql:\/\//.test(process.env.DATABASE_URL || ""),
    env_present: {
      GOOGLE_CLIENT_ID: !!process.env.GOOGLE_CLIENT_ID,
      GOOGLE_CLIENT_SECRET: !!process.env.GOOGLE_CLIENT_SECRET,
      NEXTAUTH_URL: process.env.NEXTAUTH_URL || "NOT SET",
      NEXTAUTH_SECRET: !!process.env.NEXTAUTH_SECRET,
      GOOGLE_API_KEY: !!process.env.GOOGLE_API_KEY,
    },
  };

  // Attempt database connection
  try {
    // Simple query to verify the database is reachable
    const start = Date.now();
    const userCount = await db.user.count();
    const sourceCount = await db.source.count();
    const questionCount = await db.question.count();
    const duration = Date.now() - start;

    results.database = {
      status: "✅ Connected",
      latency_ms: duration,
      counts: {
        users: userCount,
        sources: sourceCount,
        questions: questionCount,
      },
    };
  } catch (error) {
    results.database = {
      status: "❌ Connection Failed",
      error: error instanceof Error ? error.message : "Unknown error",
    };
  }

  return NextResponse.json(results, { status: 200 });
}
