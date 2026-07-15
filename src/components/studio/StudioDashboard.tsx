import { StudioDashboardClient } from "./StudioDashboardClient";

export function StudioDashboard() {
  return (
    <div className="space-y-6">
      {/* Page header */}
      <div>
        <h1 className="text-2xl font-bold">لوحة التحكم</h1>
        <p className="text-sm text-muted-foreground mt-1">
          نظرة عامة على حالة المحتوى في المنصة
        </p>
      </div>

      <StudioDashboardClient />
    </div>
  );
}
