"use client";

import { useState } from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { SidebarProvider } from "@/components/ui/sidebar";
import { StudioSidebar } from "./StudioSidebar";
import { StudioTopBar } from "./StudioTopBar";

export function StudioShell({ children }: { children: React.ReactNode }) {
  const [queryClient] = useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: {
            staleTime: 30_000,
            refetchOnWindowFocus: false,
          },
        },
      })
  );

  return (
    <QueryClientProvider client={queryClient}>
      <SidebarProvider defaultOpen={true}>
        <StudioSidebar />
        <main className="flex flex-col flex-1 min-h-svh">
          <StudioTopBar />
          <div className="flex-1 p-6">{children}</div>
        </main>
      </SidebarProvider>
    </QueryClientProvider>
  );
}
