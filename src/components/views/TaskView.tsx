"use client";

import useAppStore from "@/store/appStore";
import { useProjects } from "@/features/projects/useProjects";
import { TaskForm } from "@/features/tasks/components/TaskForm";
import { TaskList } from "@/features/tasks/components/TaskList";
import { t } from "@/lib/i18n";
import type { SmartView } from "@/types";

const viewLabelKeys = {
  inbox: "viewInbox",
  today: "viewToday",
  upcoming: "viewUpcoming",
  overdue: "viewOverdue",
  completed: "viewCompleted",
  important: "viewImportant",
  trash: "viewTrash",
} as const satisfies Record<SmartView, Parameters<typeof t>[0]>;

export function TaskView() {
  const activeView = useAppStore((s) => s.activeView);
  const selectedProjectId = useAppStore((s) => s.selectedProjectId);
  const projects = useProjects();

  const project = selectedProjectId
    ? projects?.find((p) => p.id === selectedProjectId)
    : undefined;
  const title = project?.name ?? t(viewLabelKeys[activeView]);

  return (
    <div className="mx-auto flex h-full w-full max-w-3xl flex-col gap-4">
      <h1 className="text-lg font-semibold">{title}</h1>
      <TaskForm />
      <TaskList />
    </div>
  );
}
