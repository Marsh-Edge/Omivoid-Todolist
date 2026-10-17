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
import useAppStore from "@/store/appStore";

export function MainLayout({ children }: { children: React.ReactNode }) {
  const paletteOpen = useAppStore((s) => s.paletteOpen);
  const setPaletteOpen = useAppStore((s) => s.setPaletteOpen);

  const togglePalette = useCallback(
    () => setPaletteOpen(!paletteOpen),
    [paletteOpen, setPaletteOpen],
  );
  useGlobalShortcuts(togglePalette);
  useDueNotifications();
  useAutoSnapshots();

  return (
    <div className="flex h-screen flex-col">
      <AppHeader />
      <div className="flex flex-1 overflow-hidden">
        <Sidebar />
        <main className="flex-1 overflow-hidden p-4">{children}</main>
        <TaskDetailPanel />
      </div>
      <CommandPalette />
      <SnapshotDialog />
      <Toaster />
    </div>
  );
}
