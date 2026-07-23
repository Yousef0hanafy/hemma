import { redirect } from "next/navigation";
import { getServerSession } from "next-auth";
import { authOptions, requireStudioAccess } from "@/lib/auth";
import { StudioShell } from "@/components/studio/StudioShell";

export default async function StudioLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  try {
    await requireStudioAccess();
  } catch (error) {
    // User is not authorized for studio access
    redirect("/api/auth/signin");
  }

  return <StudioShell>{children}</StudioShell>;
}
