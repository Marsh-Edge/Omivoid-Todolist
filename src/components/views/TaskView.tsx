"use client";

import dynamic from "next/dynamic";
import type { LucideIcon } from "lucide-react";
import { CalendarDays, Columns3, List } from "lucide-react";
import { cn } from "cn";
import useAppStore, { type ViewMode } from "@/store/appStore";
import { useProjects } from "@/features/projects/useProjects";
import { TaskForm } from "@/features/tasks/components/TaskForm";
import { TaskList } from "@/features/tasks/components/TaskList";
import { t, type MessageKey } from "@/lib/i18n";
import type { SmartView } from "@/types";

// Board and calendar are lazy: their code (and the board's virtualizer usage)
// stays out of the initial bundle and loads on demand.
const KanbanBoard = dynamic(() => import("@/features/board/components/KanbanBoard"), {
  ssr: false,
  loading: () => <ViewLoading />,
});
const CalendarView = dynamic(() => import("@/features/calendar/components/CalendarView"), {
  ssr: false,
  loading: () => <ViewLoading />,
});

function ViewLoading() {
  return <div className="text-muted-foreground text-sm">{t("loadingTasks")}</div>;
}

const viewLabelKeys = {
  inbox: "viewInbox",
  today: "viewToday",
  upcoming: "viewUpcoming",
  overdue: "viewOverdue",
  completed: "viewCompleted",
  important: "viewImportant",
  trash: "viewTrash",
} as const satisfies Record<SmartView, MessageKey>;

const viewModes: ReadonlyArray<{ id: ViewMode; labelKey: MessageKey; icon: LucideIcon }> = [
  { id: "list", labelKey: "viewModeList", icon: List },
  { id: "board", labelKey: "viewModeBoard", icon: Columns3 },
  { id: "calendar", labelKey: "viewModeCalendar", icon: CalendarDays },
];

export function TaskView() {
  const activeView = useAppStore((s) => s.activeView);
  const selectedProjectId = useAppStore((s) => s.selectedProjectId);
  const viewMode = useAppStore((s) => s.viewMode);
  const setViewMode = useAppStore((s) => s.setViewMode);
  const projects = useProjects();

  const project = selectedProjectId
    ? projects?.find((p) => p.id === selectedProjectId)
    : undefined;
  const title = project?.name ?? t(viewLabelKeys[activeView]);

  return (
    <div
      className={cn(
        "mx-auto flex h-full w-full flex-col gap-4",
        viewMode === "list" && "max-w-3xl",
      )}
    >
      <div className="flex flex-wrap items-center gap-2">
        <h1 className="text-lg font-semibold">{title}</h1>
        <div
          role="group"
          aria-label={t("viewModeAria")}
          className="bg-muted ml-auto flex items-center gap-0.5 rounded-md p-0.5"
        >
          {viewModes.map(({ id, labelKey, icon: Icon }) => (
            <button
              key={id}
              type="button"
              onClick={() => setViewMode(id)}
              aria-pressed={viewMode === id}
              aria-label={t(labelKey)}
              title={t(labelKey)}
              className={cn(
                "flex items-center gap-1 rounded px-2 py-1 text-xs transition-colors",
                viewMode === id
                  ? "bg-background font-medium shadow-sm"
                  : "text-muted-foreground hover:text-foreground",
              )}
            >
              <Icon className="size-3.5" aria-hidden="true" />
              <span className="hidden sm:inline">{t(labelKey)}</span>
            </button>
          ))}
        </div>
      </div>

      <TaskForm />

      {viewMode === "list" ? (
        <TaskList />
      ) : viewMode === "board" ? (
        <KanbanBoard />
      ) : (
        <CalendarView />
      )}
    </div>
  );
}
