"use client";

import { useMemo, useRef, useState } from "react";
import { useLiveQuery } from "dexie-react-hooks";
import { useVirtualizer } from "@tanstack/react-virtual";
import { useTasksForView } from "@/features/views/useTasksForView";
import { TaskRow } from "./TaskRow";
import { TaskEditDialog, type TaskEditTarget } from "./TaskEditDialog";
import {
  deleteTaskPermanently,
  moveTask,
  restoreTask,
  setTaskCompleted,
  trashTask,
} from "@/db/taskRepository";
import { queryParentIdsWithChildren, querySubtasksByParent } from "@/db/taskQueries";
import { useTags } from "@/features/tags/useTags";
import useAppStore from "@/store/appStore";
import { toUserMessage } from "@/lib/errors";
import { t } from "@/lib/i18n";
import type { Task } from "@/types";

interface FlatRow {
  task: Task;
  depth: number;
  hasChildren: boolean;
  isExpanded: boolean;
}

export function TaskList() {
  const view = useAppStore((s) => s.activeView);
  const sortBy = useAppStore((s) => s.sortBy);
  const expandedTaskIds = useAppStore((s) => s.expandedTaskIds);
  const toggleTaskExpanded = useAppStore((s) => s.toggleTaskExpanded);

  const tasks = useTasksForView();
  const tags = useTags();
  const parentRef = useRef<HTMLDivElement>(null);
  const [dialogTarget, setDialogTarget] = useState<TaskEditTarget | null>(null);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [dragOverId, setDragOverId] = useState<string | null>(null);
  const draggedIdRef = useRef<string | null>(null);

  const parentIdsWithChildren = useLiveQuery(
    () => queryParentIdsWithChildren(),
    [],
    new Set<string>() as ReadonlySet<string>,
  );

  const expandedIdsArray = useMemo(() => [...expandedTaskIds], [expandedTaskIds]);
  const subtasksByParent = useLiveQuery(
    () => querySubtasksByParent(expandedIdsArray),
    [expandedIdsArray.join(",")],
    new Map<string, Task[]>(),
  );

  const rows = useMemo<FlatRow[]>(() => {
    if (!tasks) return [];
    const out: FlatRow[] = [];
    const pushChildren = (parentId: string, depth: number) => {
      for (const child of subtasksByParent.get(parentId) ?? []) {
        const childHasChildren = parentIdsWithChildren.has(child.id);
        const childExpanded = childHasChildren && expandedTaskIds.has(child.id);
        out.push({ task: child, depth, hasChildren: childHasChildren, isExpanded: childExpanded });
        if (childExpanded) pushChildren(child.id, depth + 1);
      }
    };
    for (const task of tasks) {
      const hasChildren = parentIdsWithChildren.has(task.id);
      const isExpanded = hasChildren && expandedTaskIds.has(task.id);
      out.push({ task, depth: 0, hasChildren, isExpanded });
      if (isExpanded) pushChildren(task.id, 1);
    }
    return out;
  }, [tasks, parentIdsWithChildren, expandedTaskIds, subtasksByParent]);

  const virtualizer = useVirtualizer({
    count: rows.length,
    getScrollElement: () => parentRef.current,
    estimateSize: () => 44,
    overscan: 10,
  });

  const canReorder = sortBy === "order" && view !== "trash";

  function handleDragStart(task: Task) {
    draggedIdRef.current = task.id;
  }

  function handleDragOver(e: React.DragEvent, targetId: string) {
    e.preventDefault();
    if (draggedIdRef.current && draggedIdRef.current !== targetId) {
      setDragOverId(targetId);
    }
  }

  async function handleDrop(targetId: string) {
    const draggedId = draggedIdRef.current;
    setDragOverId(null);
    draggedIdRef.current = null;
    if (!draggedId || draggedId === targetId) return;
    const target = rows.find((r) => r.task.id === targetId)?.task;
    const dragged = rows.find((r) => r.task.id === draggedId)?.task;
    if (!target || !dragged || target.parentId !== dragged.parentId) return;
    try {
      await moveTask(draggedId, { afterId: targetId });
    } catch (caught) {
      toUserMessage(caught);
    }
  }

  function openEdit(task: Task) {
    setDialogTarget({ task });
    setDialogOpen(true);
  }

  function openAddSubtask(task: Task) {
    setDialogTarget({ parentId: task.id });
    setDialogOpen(true);
  }

  if (tasks === undefined) {
    return <div className="text-muted-foreground text-sm">{t("loadingTasks")}</div>;
  }

  if (rows.length === 0) {
    return (
      <p className="text-muted-foreground text-sm">
        {t(
          view === "inbox"
            ? "emptyViewInbox"
            : view === "today"
              ? "emptyViewToday"
              : view === "upcoming"
                ? "emptyViewUpcoming"
                : view === "overdue"
                  ? "emptyViewOverdue"
                  : view === "completed"
                    ? "emptyViewCompleted"
                    : view === "important"
                      ? "emptyViewImportant"
                      : "emptyViewTrash",
        )}
      </p>
    );
  }

  const tagById = new Map(tags?.map((tag) => [tag.id, tag]) ?? []);

  return (
    <>
      <div ref={parentRef} className="min-h-0 flex-1 overflow-auto">
        <div style={{ height: virtualizer.getTotalSize(), position: "relative" }}>
          {virtualizer.getVirtualItems().map((item) => {
            const row = rows[item.index];
            if (!row) return null;
            const rowTags = row.task.tagIds
              .map((id) => tagById.get(id))
              .filter((tag) => tag !== undefined);
            return (
              <div
                key={row.task.id}
                style={{
                  position: "absolute",
                  top: 0,
                  left: 0,
                  width: "100%",
                  transform: `translateY(${item.start}px)`,
                }}
              >
                <TaskRow
                  task={row.task}
                  depth={row.depth}
                  view={view}
                  hasChildren={row.hasChildren}
                  isExpanded={row.isExpanded}
                  tags={rowTags}
                  dragHandleProps={
                    canReorder
                      ? {
                          draggable: true,
                          onDragStart: () => handleDragStart(row.task),
                          onDragOver: (e) => handleDragOver(e, row.task.id),
                          onDrop: () => void handleDrop(row.task.id),
                          onDragEnd: () => setDragOverId(null),
                          isDragOver: dragOverId === row.task.id,
                        }
                      : undefined
                  }
                  onToggleExpand={() => toggleTaskExpanded(row.task.id)}
                  onToggleComplete={() =>
                    void setTaskCompleted(row.task.id, row.task.status !== "done").catch(toUserMessage)
                  }
                  onEdit={() => openEdit(row.task)}
                  onAddSubtask={() => openAddSubtask(row.task)}
                  onTrash={() => void trashTask(row.task.id).catch(toUserMessage)}
                  onRestore={() => void restoreTask(row.task.id).catch(toUserMessage)}
                  onDeleteForever={() => void deleteTaskPermanently(row.task.id).catch(toUserMessage)}
                />
              </div>
            );
          })}
        </div>
      </div>

      <TaskEditDialog target={dialogTarget} open={dialogOpen} onOpenChange={setDialogOpen} />
    </>
  );
}
