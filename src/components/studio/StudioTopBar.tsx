"use client";

import { useState } from "react";
import Link from "next/link";
import { useSession, signOut } from "next-auth/react";
import {
  Search,
  Sparkles,
  Bell,
  ChevronDown,
  LogOut,
  User as UserIcon,
  Settings,
  PanelRightOpen,
  Command,
} from "lucide-react";
import { cn } from "@/lib/utils";
import {
  SidebarTrigger,
  useSidebar,
} from "@/components/ui/sidebar";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

export function StudioTopBar() {
  const { data: session } = useSession();
  const { state } = useSidebar();
  const [searchFocused, setSearchFocused] = useState(false);

  const user = session?.user;
  const initials = user?.name
    ? user.name
        .split(" ")
        .map((n) => n[0])
        .join("")
        .slice(0, 2)
    : "??";

  return (
    <header
      className={cn(
        "sticky top-0 z-30 flex h-14 items-center gap-4 border-b border-border/60 bg-background/80 backdrop-blur-sm px-4 transition-all duration-200",
        state === "collapsed" ? "pe-4" : "pe-4"
      )}
    >
      {/* Sidebar toggle + brand */}
      <div className="flex items-center gap-2 shrink-0">
        <SidebarTrigger className="h-8 w-8 text-muted-foreground hover:text-foreground" />
        <Link
          href="/studio"
          className="hidden sm:flex items-center gap-1.5 text-sm font-semibold text-foreground"
        >
          <span className="text-primary">ه</span>
          <span className="hidden md:inline">استوديو</span>
        </Link>
      </div>

      {/* Search bar */}
      <div
        className={cn(
          "flex-1 max-w-lg mx-auto relative",
          searchFocused && "max-w-xl"
        )}
      >
        <div
          className={cn(
            "flex items-center gap-2 h-9 rounded-lg border border-border bg-muted/50 px-3 transition-all",
            searchFocused && "border-primary/50 ring-1 ring-primary/20 bg-background"
          )}
        >
          <Search className="h-4 w-4 text-muted-foreground shrink-0" />
          <input
            type="text"
            placeholder="ابحث في الاستوديو... (Cmd+K)"
            className="flex-1 bg-transparent text-sm outline-none placeholder:text-muted-foreground/60"
            onFocus={() => setSearchFocused(true)}
            onBlur={() => setSearchFocused(false)}
          />
          <kbd className="hidden sm:inline-flex items-center gap-0.5 rounded border border-border bg-muted px-1.5 py-0.5 text-[10px] font-medium text-muted-foreground">
            <Command className="h-2.5 w-2.5" />
            K
          </kbd>
        </div>
      </div>

      {/* Right actions */}
      <div className="flex items-center gap-1.5 shrink-0">
        {/* AI Assistant status */}
        <button
          className="relative flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-xs font-medium text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
          aria-label="مساعد الذكاء الاصطناعي"
        >
          <span className="relative flex h-2 w-2">
            <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-75" />
            <span className="relative inline-flex h-2 w-2 rounded-full bg-emerald-500" />
          </span>
          <Sparkles className="h-3.5 w-3.5" />
          <span className="hidden sm:inline">AI</span>
        </button>

        {/* Notifications */}
        <button
          className="relative flex items-center justify-center h-8 w-8 rounded-lg text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
          aria-label="الإشعارات"
        >
          <Bell className="h-4 w-4" />
          <span className="absolute -top-0.5 -right-0.5 flex h-4 min-w-[14px] items-center justify-center rounded-full bg-rose-500 text-[8px] font-bold text-white px-1">
            3
          </span>
        </button>

        {/* User menu */}
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button className="flex items-center gap-2 rounded-lg px-2 py-1 hover:bg-muted transition-colors">
              <Avatar className="h-7 w-7">
                <AvatarImage src={user?.image ?? ""} alt={user?.name ?? ""} />
                <AvatarFallback className="text-[10px] bg-primary/10 text-primary font-semibold">
                  {initials}
                </AvatarFallback>
              </Avatar>
              <span className="hidden sm:inline text-sm font-medium max-w-24 truncate">
                {user?.name ?? "مستخدم"}
              </span>
              <ChevronDown className="h-3 w-3 text-muted-foreground hidden sm:block" />
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-56">
            <DropdownMenuLabel>
              <div className="flex flex-col gap-0.5">
                <span>{user?.name ?? "مستخدم"}</span>
                <span className="text-xs font-normal text-muted-foreground">
                  {user?.email ?? ""}
                </span>
              </div>
            </DropdownMenuLabel>
            <DropdownMenuSeparator />
            <DropdownMenuItem asChild>
              <Link href="/studio/settings" className="cursor-pointer">
                <Settings className="h-4 w-4 ml-2" />
                إعدادات الاستوديو
              </Link>
            </DropdownMenuItem>
            <DropdownMenuItem asChild>
              <Link href="/" className="cursor-pointer">
                <PanelRightOpen className="h-4 w-4 ml-2" />
                التطبيق الرئيسي
              </Link>
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem
              onClick={() => signOut()}
              className="text-destructive focus:text-destructive cursor-pointer"
            >
              <LogOut className="h-4 w-4 ml-2" />
              تسجيل الخروج
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </header>
  );
}
