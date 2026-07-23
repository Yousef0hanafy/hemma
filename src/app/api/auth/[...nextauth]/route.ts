import NextAuth from "next-auth";
import { authOptions } from "@/lib/auth";

// =====================================================================
// Safely initialize NextAuth.
// If initialization fails OR returns an unexpected shape, use fallback
// handlers that return JSON errors (not HTML crash pages).
// =====================================================================

let handler: { GET: Function; POST: Function };

try {
  const h = NextAuth(authOptions);
  // NextAuth v4 returns { GET, POST } for App Router.
  // Check it actually has these methods before using them.
  if (h && typeof h.GET === "function" && typeof h.POST === "function") {
    handler = h;
    console.log("[NextAuth] ✅ Initialized successfully");
  } else {
    // h exists but doesn't have GET/POST — unexpected shape
    const shapeInfo =
      h === null
        ? "null"
        : h === undefined
          ? "undefined"
          : `${typeof h} with keys: [${Object.keys(h).join(", ")}]`;
    console.error("[NextAuth] ❌ Unexpected return shape:", shapeInfo);
    throw new Error(
      `NextAuth returned ${shapeInfo} instead of { GET, POST } handler`
    );
  }
} catch (e) {
  const msg = e instanceof Error ? e.message : "Unknown error";
  console.error("[NextAuth] ❌ Initialization FAILED:", msg);
  handler = {
    GET: () =>
      Response.json({ error: "فشل تهيئة المصادقة", detail: msg }, { status: 500 }),
    POST: () =>
      Response.json({ error: "فشل تهيئة المصادقة", detail: msg }, { status: 500 }),
  };
}

// Standard NextAuth export pattern — no wrapper, no .bind()
export { handler as GET, handler as POST };
