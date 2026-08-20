import type { Metadata } from "next";
import { StudioLibraryClient } from "@/components/studio/StudioLibraryClient";

export const metadata: Metadata = {
  title: "مكتبة المحتوى — استوديو همّة",
  description: "تصفح وإدارة جميع الأسئلة والمحتوى التعليمي في منصة همّة.",
};

export default function LibraryPage() {
  return <StudioLibraryClient />;
}
