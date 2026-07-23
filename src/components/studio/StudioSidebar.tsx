"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import { getSidebarBadgeCounts } from "@/server/actions/studio-sidebar";
import { cn } from "@/lib/utils";
import {
  LayoutDashboard,
  BookOpen,
  Upload,
  ClipboardCheck,
  BarChart3,
  FolderOpen,
  Tags,
  Settings,
  Users,
  ChevronLeft,
  BrainCircuit,
  MessageSquare,
  Clock,
} from "lucide-react";
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarSeparator,
  useSidebar,
} from "@/components/ui/sidebar";

// ---------------------------------------------------------------------------
// Navigation structure
// ---------------------------------------------------------------------------

interface NavItem {
  label: string;
  href: string;
  icon: React.ComponentType<{ className?: string }>;
}

const CONTENT_ITEMS: NavItem[] = [
  { label: "مكتبة المحتوى", href: "/studio/library", icon: BookOpen },
  { label: "مركز الاستيراد", href: "/studio/import", icon: Upload },
  { label: "قائمة المراجعة", href: "/studio/review", icon: ClipboardCheck },
  { label: "التصنيفات", href: "/studio/categories", icon: Tags },
  { label: "المصادر", href: "/studio/sources", icon: FolderOpen },
];

const INSIGHTS_ITEMS: NavItem[] = [
  { label: "التحليلات", href: "/studio/analytics", icon: BarChart3 },
  { label: "سجل المعالجة", href: "/studio/audit", icon: Clock },
  { label: "المساعد الذكي", href: "/studio/chat", icon: MessageSquare },
  { label: "الذكاء الاصطناعي", href: "/studio/ai", icon: BrainCircuit },
];

const SYSTEM_ITEMS: NavItem[] = [
  { label: "المستخدمين", href: "/studio/users", icon: Users },
  { label: "الإعدادات", href: "/studio/settings", icon: Settings },
];

// ---------------------------------------------------------------------------
// Sidebar component
// ---------------------------------------------------------------------------

export function StudioSidebar() {
  const pathname = usePathname();

  // ── Live badge counts — single consolidated query ────────────
  const badgeCountsQ = useQuery({
    queryKey: ["sidebar-badge-counts"],
    queryFn: getSidebarBadgeCounts,
    refetchInterval: 60_000,
  });

  const badgeCounts = badgeCountsQ.data;
  const failedAiCount = badgeCounts?.failedAiToday ?? 0;
  const reviewCount = badgeCounts?.reviewQueueCount ?? 0;
  const totalQuestions = badgeCounts?.totalQuestions ?? 0;
  const userCount = badgeCounts?.nonAdminUsers ?? 0;
  const sourceCount = badgeCounts?.totalSources ?? 0;

  function isActive(href: string): boolean {
    if (href === "/studio") return pathname === "/studio";
    return pathname === href || pathname.startsWith(href + "/");
  }

  function renderSection(
    label: string,
    items: NavItem[],
    badgeOverrides?: Record<string, number>
  ) {
    return (
      <SidebarGroup>
        <SidebarGroupLabel>{label}</SidebarGroupLabel>
        <SidebarGroupContent>
          <SidebarMenu>
            {items.map((item) => {
              const active = isActive(item.href);
              const Icon = item.icon;
              const badge = badgeOverrides?.[item.href];
              return (
                <SidebarMenuItem key={item.href}>
                  <SidebarMenuButton
                    asChild
                    isActive={active}
                    tooltip={
                      badge !== undefined && badge > 0
                        ? `${item.label} (${badge > 99 ? "99+" : badge})`
                        : item.label
                    }
                  >
                    <Link href={item.href} className="flex items-center gap-2">
                      <Icon className="h-4 w-4 shrink-0" />
                      <span className="flex-1 text-right">{item.label}</span>
                      {badge !== undefined && badge > 0 && (
                        <>
                          {/* Expanded: number badge */}
                          <span className="inline-flex items-center justify-center h-5 min-w-[20px] rounded-full bg-rose-500 text-[10px] font-bold text-white px-1.5 tabular-nums group-data-[collapsible=icon]:hidden">
                            {badge > 99 ? "99+" : badge}
                          </span>
                          {/* Collapsed: small dot */}
                          <span className="hidden group-data-[collapsible=icon]:inline-flex h-2 w-2 rounded-full bg-rose-400 shrink-0" />
                        </>
                      )}
                    </Link>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              );
            })}
          </SidebarMenu>
        </SidebarGroupContent>
      </SidebarGroup>
    );
  }

  return (
    <Sidebar side="right" variant="sidebar" collapsible="icon">
      <SidebarHeader>
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton size="lg" asChild>
              <Link href="/studio" className="flex items-center gap-2">
                <div className="flex aspect-square size-8 items-center justify-center rounded-lg bg-primary text-primary-foreground">
                  <span className="font-bold text-sm">ه</span>
                </div>
                <div className="flex flex-col gap-0.5 leading-none text-right">
                  <span className="font-semibold">استوديو همة</span>
                  <span className="text-[10px] text-muted-foreground">
                    منصة المحتوى التعليمي
                  </span>
                </div>
              </Link>
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarHeader>

      <SidebarContent>
        {renderSection("المحتوى", CONTENT_ITEMS, {
          "/studio/library": totalQuestions,
          "/studio/review": reviewCount,
          "/studio/sources": sourceCount,
        })}
        <SidebarSeparator />
        {renderSection("التحليلات", INSIGHTS_ITEMS, {
          "/studio/audit": failedAiCount,
        })}
        <SidebarSeparator />
        {renderSection("النظام", SYSTEM_ITEMS, {
          "/studio/users": userCount,
        })}
      </SidebarContent>

      <SidebarFooter>
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton asChild tooltip="العودة للتطبيق">
              <Link
                href="/"
                className="flex items-center gap-2 text-muted-foreground"
              >
                <ChevronLeft className="h-4 w-4 shrink-0" />
                <span className="text-right">العودة للتطبيق</span>
              </Link>
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarFooter>
    </Sidebar>
  );
}
