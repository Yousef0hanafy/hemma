import { db } from "@/lib/db";

/**
 * An import runs inside one request; if the platform kills that request
 * (timeout, crash) the source stays "processing" forever. Anything still
 * processing after this long can't be alive any more.
 */
const STUCK_AFTER_MS = 15 * 60 * 1000;

/** Mark abandoned imports as failed so they show up as retryable. */
export async function failStuckSources(): Promise<void> {
  try {
    await db.source.updateMany({
      where: {
        status: "processing",
        importedAt: { lt: new Date(Date.now() - STUCK_AFTER_MS) },
      },
      data: {
        status: "failed",
        metadata: JSON.stringify({
          error: "توقفت المعالجة قبل اكتمالها (انتهت مهلة الخادم). أعد رفع الملف.",
        }),
      },
    });
  } catch (error) {
    console.warn("[failStuckSources]", error);
  }
}
