"use client";

import { useCallback } from "react";
import { Sidebar } from "./Sidebar";
import { AppHeader } from "./AppHeader";
import { TaskDetailPanel } from "@/features/tasks/components/TaskDetailPanel";
import { useDueNotifications } from "@/features/notifications/useDueNotifications";
import { useAutoSnapshots } from "@/features/backups/useAutoSnapshots";
import { SnapshotDialog } from "@/features/backups/components/SnapshotDialog";
import { CommandPalette } from "@/components/CommandPalette";
import { Toaster } from "@/components/ui/toaster";
import { useGlobalShortcuts } from "@/hooks/useGlobalShortcuts";
import { useDesktopBridge } from "@/hooks/useDesktopBridge";
import useAppStore from "@/store/appStore";
import { t } from "@/lib/i18n";

export function MainLayout({ children }: { children: React.ReactNode }) {
  const paletteOpen = useAppStore((s) => s.paletteOpen);
  const setPaletteOpen = useAppStore((s) => s.setPaletteOpen);

  const togglePalette = useCallback(
    () => setPaletteOpen(!paletteOpen),
    [paletteOpen, setPaletteOpen],
  );
  useGlobalShortcuts(togglePalette);
  useDesktopBridge();
  useDueNotifications();
  useAutoSnapshots();

  return (
    <div className="flex h-screen flex-col">
      <a
        href="#main-content"
        className="sr-only focus:ring-ring focus:bg-primary focus:text-primary-foreground focus:fixed focus:top-2 focus:left-2 focus:z-[200] focus:rounded-md focus:px-3 focus:py-2 focus:text-sm focus:not-sr-only focus:ring-2"
      >
        {t("skipToContent")}
      </a>
      <AppHeader />
      <div className="flex flex-1 overflow-hidden">
        <Sidebar />
        <main id="main-content" tabIndex={-1} className="flex-1 overflow-hidden p-4 outline-none">
          {children}
        </main>
        <TaskDetailPanel />
      </div>
      <CommandPalette />
      <SnapshotDialog />
      <Toaster />
    </div>
  );
}
