"use client";

import { useMemo, useRef, useState } from "react";
import { useTasksForView } from "@/features/views/useTasksForView";
import { useProjects } from "@/features/projects/useProjects";
import { useTags } from "@/features/tags/useTags";
import { setTaskStatus } from "@/db/taskRepository";
import { notifyError } from "@/lib/errors";
import { groupTasksByStatus } from "@/lib/board";
import useAppStore from "@/store/appStore";
import { BoardColumn } from "./BoardColumn";
import { t, type MessageKey } from "@/lib/i18n";
import type { TaskStatus } from "@/types";

const columnLabelKeys: Record<TaskStatus, MessageKey> = {
  todo: "statusTodo",
  in_progress: "statusInProgress",
  done: "statusDone",
};

/** Module-level so the render scope stays pure (React Compiler rule). */
async function moveTaskToStatus(id: string, status: TaskStatus): Promise<void> {
  try {
    await setTaskStatus(id, status);
  } catch (caught) {
    notifyError(caught);
  }
}

/**
 * Kanban board over the active view's tasks, grouped by status. Columns are
 * individually virtualized. Dragging a card to another column changes its
 * status (moving to Done clears/sets `completedAt`, or reschedules a recurring
 * task to its next occurrence).
 *
 * Scoped to the active view + filters, exactly like the list — so completing a
 * task removes it from an active view (the Done column fills up in the
 * Completed view). This keeps the board consistent with the list.
 */
export default function KanbanBoard() {
  const tasks = useTasksForView();
  const projects = useProjects();
  const tags = useTags();
  const setDetailTaskId = useAppStore((s) => s.setDetailTaskId);

  const [dragOverStatus, setDragOverStatus] = useState<TaskStatus | null>(null);
  const dragOverRef = useRef<TaskStatus | null>(null);
  const draggedIdRef = useRef<string | null>(null);

  const groups = useMemo(() => (tasks ? groupTasksByStatus(tasks) : []), [tasks]);
  const projectNames = useMemo(
    () => new Map((projects ?? []).map((p) => [p.id, p.name])),
    [projects],
  );
  const tagById = useMemo(() => new Map((tags ?? []).map((tag) => [tag.id, tag])), [tags]);

  function setDragOver(status: TaskStatus | null) {
    if (dragOverRef.current === status) return;
    dragOverRef.current = status;
    setDragOverStatus(status);
  }

  function handleDrop(id: string, status: TaskStatus) {
    const task = tasks?.find((item) => item.id === id);
    if (!task || task.status === status) return;
    void moveTaskToStatus(id, status);
  }

  if (!tasks) {
    return <div className="text-muted-foreground text-sm">{t("loadingTasks")}</div>;
  }

  return (
    <div className="flex min-h-0 flex-1 flex-col gap-2">
      <div className="flex min-h-0 flex-1 gap-3 overflow-x-auto pb-1">
        {groups.map((group) => (
          <BoardColumn
            key={group.status}
            label={t(columnLabelKeys[group.status])}
            tasks={group.tasks}
            projectNames={projectNames}
            tagById={tagById}
            isDragOver={dragOverStatus === group.status}
            emptyLabel={t("boardEmptyColumn")}
            onDragOverColumn={(e) => {
              e.preventDefault();
              setDragOver(group.status);
            }}
            onDropColumn={() => {
              const id = draggedIdRef.current;
              draggedIdRef.current = null;
              setDragOver(null);
              if (id) handleDrop(id, group.status);
            }}
            onCardDragStart={(id) => {
              draggedIdRef.current = id;
            }}
            onCardDragEnd={() => {
              draggedIdRef.current = null;
              setDragOver(null);
            }}
            onCardOpen={setDetailTaskId}
            onCardMove={handleDrop}
          />
        ))}
      </div>
      <p className="text-muted-foreground px-1 text-xs">{t("boardDropHint")}</p>
    </div>
  );
}
