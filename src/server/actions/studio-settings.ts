"use server";

import { db } from "@/lib/db";
import {
  requireStudioAccess,
  requireAdminAccess,
} from "@/lib/studio-auth";

// ---------------------------------------------------------------------------
// Default settings (used when no setting is stored in DB)
// ---------------------------------------------------------------------------

export const DEFAULT_SETTINGS: Record<string, string> = {
  // Publishing defaults
  default_import_status: "review",
  require_review_before_publish: "true",
  auto_approve_high_quality: "false",
  auto_approve_threshold: "0.85",

  // Review workflow
  min_reviewers_to_approve: "1",
  ai_quality_flag_threshold: "0.6",
  ai_quality_good_threshold: "0.8",

  // AI configuration
  auto_process_on_import: "false",
  auto_estimate_difficulty_on_import: "false",
  auto_generate_explanations_on_import: "false",
  enable_ai_quality_check: "true",
  enable_ai_explanation: "false",
  ai_provider: "auto",  // auto | gemini | heuristic
  ai_model: "gemini-2.0-flash",

  // System
  site_name: "استوديو همة",
  maintenance_mode: "false",
};

// ---------------------------------------------------------------------------
// DTO
// ---------------------------------------------------------------------------

export interface SettingsDTO {
  [key: string]: string;
}

// ---------------------------------------------------------------------------
// Get all settings (with defaults for any missing)
// ---------------------------------------------------------------------------

export async function getSettings(): Promise<SettingsDTO> {
  await requireStudioAccess();

  const stored = await db.studioSetting.findMany();
  const storedMap = new Map(stored.map((s) => [s.key, s.value]));

  // Merge: defaults win if no stored value exists
  const merged: SettingsDTO = {};
  for (const [key, defaultValue] of Object.entries(DEFAULT_SETTINGS)) {
    merged[key] = storedMap.get(key) ?? defaultValue;
  }

  return merged;
}

// ---------------------------------------------------------------------------
// Update a single setting
// ---------------------------------------------------------------------------

export async function updateSetting(
  key: string,
  value: string
): Promise<{ ok: boolean }> {
  await requireAdminAccess("ليس لديك صلاحية لتعديل الإعدادات");

  if (!(key in DEFAULT_SETTINGS)) {
    throw new Error(`الإعداد "${key}" غير معروف`);
  }

  // Validate booleans
  if (["true", "false"].includes(DEFAULT_SETTINGS[key])) {
    if (value !== "true" && value !== "false") {
      throw new Error("القيمة يجب أن تكون نعم أو لا");
    }
  }

  // Validate numbers
  if (key === "min_reviewers_to_approve") {
    const n = parseInt(value, 10);
    if (isNaN(n) || n < 1 || n > 10) {
      throw new Error("يجب أن يكون العدد بين 1 و 10");
    }
  }

  if (
    key === "auto_approve_threshold" ||
    key === "ai_quality_flag_threshold" ||
    key === "ai_quality_good_threshold"
  ) {
    const n = parseFloat(value);
    if (isNaN(n) || n < 0 || n > 1) {
      throw new Error("يجب أن تكون القيمة بين 0 و 1");
    }
  }

  await db.studioSetting.upsert({
    where: { key },
    update: { value },
    create: { key, value },
  });

  return { ok: true };
}

// ---------------------------------------------------------------------------
// Reset a setting to default
// ---------------------------------------------------------------------------

export async function resetSetting(key: string): Promise<{ ok: boolean }> {
  await requireAdminAccess("ليس لديك صلاحية لتعديل الإعدادات");

  if (!(key in DEFAULT_SETTINGS)) {
    throw new Error(`الإعداد "${key}" غير معروف`);
  }

  await db.studioSetting.delete({ where: { key } }).catch(() => {});
  return { ok: true };
}

// ---------------------------------------------------------------------------
// Reset all settings to defaults
// ---------------------------------------------------------------------------

export async function resetAllSettings(): Promise<{ ok: boolean }> {
  await requireAdminAccess("ليس لديك صلاحية لتعديل الإعدادات");

  await db.studioSetting.deleteMany();
  return { ok: true };
}
