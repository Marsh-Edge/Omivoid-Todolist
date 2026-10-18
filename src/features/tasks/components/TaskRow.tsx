"use client";

import { memo, type MouseEvent } from "react";
import {
  CalendarDays,
  Check,
  ChevronRight,
  Flag,
  GripVertical,
  Pencil,
  Plus,
  Repeat,
  RotateCcw,
  Trash2,
  Trash,
} from "lucide-react";
import { cn } from "cn";
import { Button } from "@/components/ui/button";
import { recurrenceLabel, t } from "@/lib/i18n";
import { isOverdue, isToday } from "@/lib/viewPredicates";
import { format } from "date-fns";
import type { Tag, Task, TaskPriority, SmartView } from "@/types";

const priorityColors: Record<Exclude<TaskPriority, "none">, string> = {
  low: "text-blue-500 dark:text-blue-400",
  medium: "text-amber-600 dark:text-amber-400",
  high: "text-red-500 dark:text-red-400",
};

/**
 * Shared, stable drag handlers. Each receives the calling row's `taskId` so
 * the parent can create them once instead of one closure per row.
 */
export interface TaskDragHandlers {
  onDragStart: (e: React.DragEvent, taskId: string) => void;
  onDragOver: (e: React.DragEvent, taskId: string) => void;
  onDrop: (e: React.DragEvent, taskId: string) => void;
  onDragEnd: () => void;
}

export interface TaskRowProps {
  task: Task;
  depth: number;
  view: SmartView;
  hasChildren: boolean;
  isExpanded: boolean;
  tags: readonly Tag[];
  /** undefined disables drag & drop (e.g. non-manual sort, trash view). Must be stable. */
  dragHandlers?: TaskDragHandlers;
  isDragOver?: boolean;
  onToggleExpand: (task: Task) => void;
  onToggleComplete: (task: Task) => void;
  onOpenDetail: (task: Task) => void;
  onEdit: (task: Task) => void;
  onAddSubtask: (task: Task) => void;
  onTrash: (task: Task) => void;
  onRestore: (task: Task) => void;
  onDeleteForever: (task: Task) => void;
}

export const TaskRow = memo(function TaskRow({
  task,
  depth,
  view,
  hasChildren,
  isExpanded,
  tags,
  dragHandlers,
  isDragOver = false,
  onToggleExpand,
  onToggleComplete,
  onOpenDetail,
  onEdit,
  onAddSubtask,
  onTrash,
  onRestore,
  onDeleteForever,
}: TaskRowProps) {
  const isDone = task.status === "done";
  const isTrashView = view === "trash";
  const showDue = task.dueAt > 0 && !isDone && !isTrashView;
  // Snapshot timestamp for due-state rendering; safe (no re-render loop).
  const nowMs = Date.now();
  const dueOverdue = showDue && isOverdue(task.dueAt, nowMs);
  const dueToday = showDue && isToday(task.dueAt, nowMs);
  const priority = task.priority !== "none" ? priorityColors[task.priority] : null;

  function handleTitleClick(e: MouseEvent<HTMLButtonElement>) {
    e.stopPropagation();
    onOpenDetail(task);
  }

  return (
    <div
      className={cn(
        "group flex h-11 items-center gap-2 rounded-lg px-2 transition-colors hover:bg-muted/60",
        isDragOver && "bg-accent ring-1 ring-ring",
        depth > 0 && "text-[0.925em]",
      )}
      style={depth > 0 ? { paddingLeft: `${0.5 + depth * 1.25}rem` } : undefined}
      {...(dragHandlers
        ? {
            draggable: true,
            onDragStart: (e: React.DragEvent) => dragHandlers.onDragStart(e, task.id),
            onDragOver: (e: React.DragEvent) => dragHandlers.onDragOver(e, task.id),
            onDrop: (e: React.DragEvent) => dragHandlers.onDrop(e, task.id),
            onDragEnd: dragHandlers.onDragEnd,
          }
        : {})}
    >
      {dragHandlers ? (
        <span
          className="cursor-grab text-muted-foreground/40 opacity-0 transition-opacity group-hover:opacity-100 focus-within:opacity-100"
          aria-hidden="true"
        >
          <GripVertical className="size-3.5" />
        </span>
      ) : null}

      {hasChildren ? (
        <button
          type="button"
          onClick={() => onToggleExpand(task)}
          aria-expanded={isExpanded}
          aria-label={
            isExpanded
              ? t("collapseSubtasks", { title: task.title })
              : t("expandSubtasks", { title: task.title })
          }
          className="flex size-5 shrink-0 items-center justify-center rounded text-muted-foreground hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        >
          <ChevronRight
            className={cn("size-3.5 transition-transform", isExpanded && "rotate-90")}
            aria-hidden="true"
          />
        </button>
      ) : (
        <span className="size-5 shrink-0" aria-hidden="true" />
      )}

      {!isTrashView ? (
        <button
          type="button"
          role="checkbox"
          aria-checked={isDone}
          onClick={() => onToggleComplete(task)}
          aria-label={
            isDone ? t("markIncomplete", { title: task.title }) : t("markComplete", { title: task.title })
          }
          className={cn(
            "flex size-4 shrink-0 items-center justify-center rounded-full border border-muted-foreground/40 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
            isDone && "bg-primary border-primary text-primary-foreground",
          )}
        >
          <Check
            className={cn("size-3 transition-transform", isDone ? "scale-100" : "scale-0")}
            aria-hidden="true"
          />
        </button>
      ) : null}

      <button
        type="button"
        onClick={handleTitleClick}
        title={t("openNotes", { title: task.title })}
        className={cn(
          "min-w-0 flex-1 truncate text-left text-sm transition-colors",
          isDone && "text-muted-foreground line-through",
        )}
      >
        {task.title}
      </button>

      {priority ? <Flag className={cn("size-3 shrink-0", priority)} aria-hidden="true" /> : null}

      {task.recurrence ? (
        <span
          className="text-muted-foreground shrink-0"
          title={t("taskRepeats", { rule: recurrenceLabel(task.recurrence) })}
        >
          <Repeat className="size-3" aria-hidden="true" />
          <span className="sr-only">{t("taskRepeats", { rule: recurrenceLabel(task.recurrence) })}</span>
        </span>
      ) : null}

      {showDue ? (
        <span
          className={cn(
            "flex shrink-0 items-center gap-1 text-xs tabular-nums",
            dueOverdue
              ? "text-red-600 dark:text-red-400"
              : dueToday
                ? "text-amber-600 dark:text-amber-400"
                : "text-muted-foreground",
          )}
        >
          <CalendarDays className="size-3" aria-hidden="true" />
          {format(task.dueAt, "MMM d")}
        </span>
      ) : null}

      {tags.length > 0 ? (
        <span className="flex shrink-0 items-center gap-1" aria-hidden="true">
          {tags.slice(0, 3).map((tag) => (
            <span
              key={tag.id}
              className="size-1.5 rounded-full"
              style={{ backgroundColor: tag.color || "var(--muted-foreground)" }}
            />
          ))}
          {tags.length > 3 ? <span className="text-muted-foreground text-xs">+{tags.length - 3}</span> : null}
        </span>
      ) : null}

      <span className="flex shrink-0 items-center gap-0.5 opacity-0 transition-opacity group-hover:opacity-100 focus-within:opacity-100">
        {isTrashView ? (
          <>
            <Button
              type="button"
              variant="ghost"
              size="icon-sm"
              onClick={() => onRestore(task)}
              aria-label={t("restoreTask", { title: task.title })}
            >
              <RotateCcw aria-hidden="true" />
            </Button>
            <Button
              type="button"
              variant="ghost"
              size="icon-sm"
              onClick={() => onDeleteForever(task)}
              aria-label={t("deleteForever", { title: task.title })}
            >
              <Trash aria-hidden="true" />
            </Button>
          </>
        ) : (
          <>
            <Button
              type="button"
              variant="ghost"
              size="icon-sm"
              onClick={() => onEdit(task)}
              aria-label={t("editTask", { title: task.title })}
            >
              <Pencil aria-hidden="true" />
            </Button>
            <Button
              type="button"
              variant="ghost"
              size="icon-sm"
              onClick={() => onAddSubtask(task)}
              aria-label={t("addSubtaskAria", { title: task.title })}
            >
              <Plus aria-hidden="true" />
            </Button>
            <Button
              type="button"
              variant="ghost"
              size="icon-sm"
              onClick={() => onTrash(task)}
              aria-label={t("deleteTask", { title: task.title })}
            >
              <Trash2 aria-hidden="true" />
            </Button>
          </>
        )}
      </span>
    </div>
  );
});
