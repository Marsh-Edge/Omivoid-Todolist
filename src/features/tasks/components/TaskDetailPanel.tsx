"use client";

import { useEffect } from "react";
import { useLiveQuery } from "dexie-react-hooks";
import { format } from "date-fns";
import { CalendarDays, Flag, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { getTask } from "@/db/taskRepository";
import { useProjects } from "@/features/projects/useProjects";
import { useTaskNoteReferences } from "@/features/notes/useTaskNoteReferences";
import { NotesEditor } from "@/features/notes/components/NotesEditor";
import useAppStore from "@/store/appStore";
import { t } from "@/lib/i18n";
import type { Task } from "@/types";

const priorityLabelKeys = {
  none: "priorityNone",
  low: "priorityLow",
  medium: "priorityMedium",
  high: "priorityHigh",
} as const;

const priorityClasses: Record<Exclude<Task["priority"], "none">, string> = {
  low: "text-blue-500",
  medium: "text-amber-500",
  high: "text-red-500",
};

/**
 * Outer shell: renders nothing (and starts no DB queries) unless a task is
 * selected, so the active-task scan in `useTaskNoteReferences` only happens
 * while the panel is actually open.
 */
export function TaskDetailPanel() {
  const detailTaskId = useAppStore((s) => s.detailTaskId);
  if (!detailTaskId) return null;
  return <TaskDetailContent taskId={detailTaskId} />;
}

function TaskDetailContent({ taskId }: { taskId: string }) {
  const setDetailTaskId = useAppStore((s) => s.setDetailTaskId);
  const projects = useProjects();

  const task = useLiveQuery(
    async (): Promise<Task | null> => (await getTask(taskId)) ?? null,
    [taskId],
  );

  // The task vanished (permanently deleted) — close the panel.
  useEffect(() => {
    if (task === null) setDetailTaskId(null);
  }, [task, setDetailTaskId]);

  const references = useTaskNoteReferences(task ?? undefined);

  const projectName = task
    ? (projects?.find((project) => project.id === task.projectId)?.name ?? t("projectUnassigned"))
    : "";

  return (
    <aside
      className="flex h-full w-[400px] max-w-[45vw] shrink-0 flex-col border-l"
      aria-label={t("taskDetailAria")}
    >
      <div className="flex items-start gap-2 border-b px-4 py-3">
        <div className="min-w-0 flex-1">
          <h2 className="truncate text-sm font-semibold">
            {task ? task.title : t("loadingTasks")}
          </h2>
          {task ? (
            <div className="text-muted-foreground mt-1 flex flex-wrap items-center gap-3 text-xs">
              <span className="inline-flex items-center gap-1">
                <Flag
                  className={
                    task.priority === "none" ? "size-3" : `size-3 ${priorityClasses[task.priority]}`
                  }
                  aria-hidden="true"
                />
                {t(priorityLabelKeys[task.priority])}
              </span>
              {task.dueAt > 0 ? (
                <span className="inline-flex items-center gap-1">
                  <CalendarDays className="size-3" aria-hidden="true" />
                  {format(task.dueAt, "MMM d, yyyy")}
                </span>
              ) : null}
              <span className="truncate">{projectName}</span>
            </div>
          ) : null}
        </div>
        <Button
          type="button"
          variant="ghost"
          size="icon-sm"
          onClick={() => setDetailTaskId(null)}
          aria-label={t("closeNotes")}
        >
          <X aria-hidden="true" />
        </Button>
      </div>

      <div className="flex min-h-0 flex-1 flex-col gap-5 overflow-y-auto p-4">
        {task ? (
          <NotesEditor
            key={task.id}
            task={task}
            resolveTitle={references.resolveTitle}
            suggestTitles={references.suggestTitles}
            onOpenTask={setDetailTaskId}
          />
        ) : null}

        <section className="flex flex-col gap-2" aria-label={t("backlinks")}>
          <h3 className="text-sm font-medium">{t("backlinks")}</h3>
          {references.backlinks.length === 0 ? (
            <p className="text-muted-foreground text-xs">{t("noBacklinks")}</p>
          ) : (
            <ul className="flex flex-col gap-1">
              {references.backlinks.map((backlink) => (
                <li key={backlink.id}>
                  <button
                    type="button"
                    onClick={() => setDetailTaskId(backlink.id)}
                    aria-label={t("openLinkedTask", { title: backlink.title })}
                    className="hover:bg-accent flex w-full items-center rounded-md border px-2 py-1.5 text-left text-sm"
                  >
                    <span className="truncate">{backlink.title}</span>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>
    </aside>
  );
}
