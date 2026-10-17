"use client";

import { useMemo, useRef, useState } from "react";
import { useLiveQuery } from "dexie-react-hooks";
import { useVirtualizer } from "@tanstack/react-virtual";
import { useTasksForView } from "@/features/views/useTasksForView";
import { useProjects } from "@/features/projects/useProjects";
import { useTags } from "@/features/tags/useTags";
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
import useAppStore from "@/store/appStore";
import { toUserMessage } from "@/lib/errors";
import { t } from "@/lib/i18n";
import {
  groupTasks,
  type GroupLabelResolver,
} from "@/lib/taskFilters";
import type { Task } from "@/types";

type FlatRow =
  | { kind: "header"; id: string; label: string }
  | {
      kind: "task";
      id: string;
      task: Task;
      depth: number;
      hasChildren: boolean;
      isExpanded: boolean;
    };

const ROW_HEIGHT = 44;
const HEADER_HEIGHT = 34;

export function TaskList() {
  const view = useAppStore((s) => s.activeView);
  const sortBy = useAppStore((s) => s.sortBy);
  const groupBy = useAppStore((s) => s.groupBy);
  const expandedTaskIds = useAppStore((s) => s.expandedTaskIds);
  const toggleTaskExpanded = useAppStore((s) => s.toggleTaskExpanded);
  const setDetailTaskId = useAppStore((s) => s.setDetailTaskId);

  const tasks = useTasksForView();
  const projects = useProjects();
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

  const groups = useMemo(() => {
    if (!tasks || groupBy === "none") return null;
    const projectNames = new Map(projects?.map((p) => [p.id, p.name]) ?? []);
    const tagNames = new Map(tags?.map((tag) => [tag.id, tag.name]) ?? []);
    const labels: GroupLabelResolver = {
      project: (id) => projectNames.get(id) ?? t("groupNoProject"),
      tag: (id) => tagNames.get(id) ?? t("groupNoTag"),
      date: {
        overdue: t("dateOverdue"),
        today: t("dateToday"),
        tomorrow: t("dateTomorrow"),
        thisWeek: t("dateThisWeek"),
        later: t("dateLater"),
        noDue: t("dateNoDue"),
      },
    };
    return groupTasks(tasks, groupBy, labels);
  }, [tasks, groupBy, projects, tags]);

  const rows = useMemo<FlatRow[]>(() => {
    if (!tasks) return [];
    const out: FlatRow[] = [];

    function pushChildren(parentId: string, depth: number) {
      for (const child of subtasksByParent.get(parentId) ?? []) {
        const childHasChildren = parentIdsWithChildren.has(child.id);
        const childExpanded = childHasChildren && expandedTaskIds.has(child.id);
        out.push({
          kind: "task",
          id: child.id,
          task: child,
          depth,
          hasChildren: childHasChildren,
          isExpanded: childExpanded,
        });
        if (childExpanded) pushChildren(child.id, depth + 1);
      }
    }

    function pushTask(task: Task) {
      const hasChildren = parentIdsWithChildren.has(task.id);
      const isExpanded = hasChildren && expandedTaskIds.has(task.id);
      out.push({ kind: "task", id: task.id, task, depth: 0, hasChildren, isExpanded });
      if (isExpanded) pushChildren(task.id, 1);
    }

    if (groups) {
      for (const group of groups) {
        out.push({ kind: "header", id: `header:${group.key}`, label: group.label });
        for (const task of group.tasks) pushTask(task);
      }
    } else {
      for (const task of tasks) pushTask(task);
    }
    return out;
  }, [tasks, groups, parentIdsWithChildren, expandedTaskIds, subtasksByParent]);

  const taskById = useMemo(() => {
    const map = new Map<string, Task>();
    for (const row of rows) {
      if (row.kind === "task") map.set(row.task.id, row.task);
    }
    return map;
  }, [rows]);

  const virtualizer = useVirtualizer({
    count: rows.length,
    getScrollElement: () => parentRef.current,
    estimateSize: (index) => (rows[index]?.kind === "header" ? HEADER_HEIGHT : ROW_HEIGHT),
    overscan: 10,
  });

  const canReorder = sortBy === "order" && view !== "trash" && groupBy === "none";

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
    const target = taskById.get(targetId);
    const dragged = taskById.get(draggedId);
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
            const positionStyle = {
              position: "absolute" as const,
              top: 0,
              left: 0,
              width: "100%",
              transform: `translateY(${item.start}px)`,
            };
            if (row.kind === "header") {
              return (
                <div key={row.id} style={positionStyle} className="flex h-[34px] items-center px-2">
                  <span className="text-muted-foreground text-xs font-semibold tracking-wide uppercase">
                    {row.label}
                  </span>
                </div>
              );
            }
            const rowTags = row.task.tagIds
              .map((id) => tagById.get(id))
              .filter((tag) => tag !== undefined);
            return (
              <div key={row.id} style={positionStyle}>
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
                  onOpenDetail={() => setDetailTaskId(row.task.id)}
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
