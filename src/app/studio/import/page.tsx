import type { Metadata } from "next";
import { StudioImportClient } from "@/components/studio/StudioImportClient";

export const metadata: Metadata = {
  title: "مركز استيعاب المصادر — استوديو همّة",
  description: "ارفع ملفات PDF أو Word أو نصوص لاستخراج الأسئلة تلقائياً وإضافتها لمكتبة المحتوى.",
};

export default function ImportPage() {
  return <StudioImportClient />;
}
