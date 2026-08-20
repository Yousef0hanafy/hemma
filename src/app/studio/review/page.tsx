import type { Metadata } from "next";
import { StudioReviewClient } from "@/components/studio/StudioReviewClient";

export const metadata: Metadata = {
  title: "قائمة المراجعة — استوديو همّة",
  description: "راجع الأسئلة المولدة بالذكاء الاصطناعي واعتمدها أو ارفضها قبل النشر.",
};

export default function ReviewPage() {
  return <StudioReviewClient />;
}
