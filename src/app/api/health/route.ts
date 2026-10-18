import { db } from "@/lib/db";

export async function GET() {
  const checks: Record<string, { status: "ok" | "error"; latency?: number; error?: string }> = {};

  // Database check
  try {
    const start = Date.now();
    await db.$queryRaw`SELECT 1`;
    checks.database = {
      status: "ok",
      latency: Date.now() - start,
    };
  } catch (error) {
    // Log the details server-side; the public response must not leak them
    console.error("[health] database check failed:", error);
    checks.database = { status: "error" };
  }

  // Overall status
  const overallStatus = Object.values(checks).every((check) => check.status === "ok")
    ? "ok"
    : "error";

  return Response.json(
    {
      status: overallStatus,
      timestamp: new Date().toISOString(),
      checks,
    },
    {
      status: overallStatus === "ok" ? 200 : 503,
      headers: {
        "Cache-Control": "no-cache, no-store, must-revalidate",
      },
    }
  );
}
