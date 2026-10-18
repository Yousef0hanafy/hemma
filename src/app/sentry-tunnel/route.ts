// =====================================================================
// Sentry Tunnel Route
// Routes Sentry error reports through our domain to avoid ad-blockers.
// =====================================================================

import { NextRequest, NextResponse } from "next/server";

function parseDsn(dsn: string | undefined): { host: string; projectId: string } | null {
  if (!dsn) return null;
  try {
    const url = new URL(dsn);
    const projectId = url.pathname.split("/").filter(Boolean).pop();
    if (url.protocol !== "https:" || !projectId || !/^\d+$/.test(projectId)) return null;
    return { host: url.host, projectId };
  } catch {
    return null;
  }
}

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

    // Only forward to OUR Sentry project — otherwise this route is an open
    // relay that lets anyone make the server POST to arbitrary hosts.
    const allowed = parseDsn(process.env.NEXT_PUBLIC_SENTRY_DSN ?? process.env.SENTRY_DSN);
    const requested = parseDsn(dsn);
    if (
      !allowed ||
      !requested ||
      requested.host !== allowed.host ||
      requested.projectId !== allowed.projectId
    ) {
      return new NextResponse("Unknown DSN", { status: 400 });
    }
    const { host: sentryHost, projectId } = allowed;

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
