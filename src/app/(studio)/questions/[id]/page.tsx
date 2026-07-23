import { getQuestionDetail } from "@/server/actions/studio-questions";
import { StudioQuestionEditor } from "@/components/studio/StudioQuestionEditor";
import { notFound } from "next/navigation";

interface Props {
  params: Promise<{ id: string }>;
}

export default async function QuestionPage({ params }: Props) {
  const { id } = await params;
  const detail = await getQuestionDetail(id);

  if (!detail) {
    notFound();
  }

  return <StudioQuestionEditor question={detail} />;
}
