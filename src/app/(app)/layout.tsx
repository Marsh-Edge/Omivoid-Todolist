"use client";

import { MainLayout } from "@/components/layout/MainLayout";

/**
 * Shared shell for all app routes (tasks + statistics). Living in a layout keeps
 * `MainLayout` — header, sidebar, dialogs, notification/snapshot hooks — mounted
 * across client-side navigation instead of remounting on every route change.
 */
export default function AppLayout({ children }: { children: React.ReactNode }) {
  return <MainLayout>{children}</MainLayout>;
}
