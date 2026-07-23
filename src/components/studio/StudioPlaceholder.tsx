import { Construction } from "lucide-react";
import Link from "next/link";
import { Button } from "@/components/ui/button";

interface StudioPlaceholderProps {
  title: string;
  description: string;
  icon?: React.ReactNode;
}

export function StudioPlaceholder({
  title,
  description,
  icon,
}: StudioPlaceholderProps) {
  return (
    <div className="flex flex-col items-center justify-center py-24 text-center max-w-md mx-auto">
      <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-muted mb-6">
        {icon ?? <Construction className="h-8 w-8 text-muted-foreground" />}
      </div>
      <h1 className="text-2xl font-bold mb-2">{title}</h1>
      <p className="text-sm text-muted-foreground mb-8 leading-relaxed">
        {description}
      </p>
      <div className="flex items-center gap-3">
        <Button asChild variant="outline">
          <Link href="/studio">العودة للوحة التحكم</Link>
        </Button>
        <Button asChild>
          <Link href="/studio/library">مكتبة المحتوى</Link>
        </Button>
      </div>
    </div>
  );
}
