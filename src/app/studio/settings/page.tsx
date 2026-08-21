import { StudioSettingsClient } from "@/components/studio/StudioSettingsClient";
import { Suspense } from "react";

export const dynamic = "force-dynamic";

export default function SettingsPage() {
  return (
    <Suspense fallback={null}>
      <StudioSettingsClient />
    </Suspense>
  );
}
