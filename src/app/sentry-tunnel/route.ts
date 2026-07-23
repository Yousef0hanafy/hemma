// =====================================================================
// Sentry Tunnel Route
// Routes Sentry error reports through our domain to avoid ad-blockers.
// =====================================================================

import { NextRequest, NextResponse } from "next/server";

export async function POST(request: NextRequest) {
  try {
    const envelope = await request.text();
    const piece = envelope.split("\n")[0];
    let dsn: string | undefined;

    try {
      const header = JSON.parse(piece);
      dsn = header?.dsn;
    } catch {
      // Invalid envelope header
    }

    if (!dsn) {
      return new NextResponse("Invalid envelope", { status: 400 });
    }

    // Extract the project ID from the DSN
    const dsnParts = dsn.split("/");
    const projectId = dsnParts[dsnParts.length - 1];
    const sentryHost = new URL(dsn).host;

    // Forward the envelope to Sentry
    const response = await fetch(
      `https://${sentryHost}/api/${projectId}/envelope/`,
      {
        method: "POST",
        body: envelope,
        headers: { "Content-Type": "application/x-sentry-envelope" },
      }
    );

    return new NextResponse(response.body, {
      status: response.status,
      headers: { "Content-Type": "application/json" },
    });
  } catch {
    return new NextResponse("Error proxying to Sentry", { status: 500 });
  }
}
