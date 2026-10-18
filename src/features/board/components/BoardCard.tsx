"use client";

import { memo, useMemo } from "react";
import { format } from "date-fns";
import { CalendarDays, Flag, MoreHorizontal } from "lucide-react";
import { cn } from "cn";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { t, type MessageKey } from "@/lib/i18n";
import type { Tag, Task, TaskPriority, TaskStatus } from "@/types";

const priorityColors: Record<Exclude<TaskPriority, "none">, string> = {
  low: "text-blue-500 dark:text-blue-400",
  medium: "text-amber-600 dark:text-amber-400",
  high: "text-red-500 dark:text-red-400",
};

const statusLabelKeys: Record<TaskStatus, MessageKey> = {
  todo: "statusTodo",
  in_progress: "statusInProgress",
  done: "statusDone",
};

const allStatuses: readonly TaskStatus[] = ["todo", "in_progress", "done"];

export interface BoardCardProps {
  task: Task;
  projectName?: string;
  tagById: ReadonlyMap<string, Tag>;
  onOpen: (taskId: string) => void;
  onMoveTo: (taskId: string, status: TaskStatus) => void;
  onDragStart: (taskId: string) => void;
  onDragEnd: () => void;
}

export const BoardCard = memo(function BoardCard({
  task,
  projectName,
  tagById,
  onOpen,
  onMoveTo,
  onDragStart,
  onDragEnd,
}: BoardCardProps) {
  const isDone = task.status === "done";
  const priority = task.priority !== "none" ? priorityColors[task.priority] : null;
  const tags = useMemo(
    () =>
      task.tagIds
        .map((id) => tagById.get(id))
        .filter((tag): tag is Tag => tag !== undefined),
    [task.tagIds, tagById],
  );

  return (
    <article
      draggable
      onDragStart={() => onDragStart(task.id)}
      onDragEnd={onDragEnd}
      className="bg-card hover:bg-muted/60 group flex h-[76px] w-full cursor-grab flex-col overflow-hidden rounded-md border p-2 text-left shadow-sm transition-colors active:cursor-grabbing"
    >
      <div className="flex items-start gap-1.5">
        {priority ? <Flag className={cn("mt-0.5 size-3 shrink-0", priority)} aria-hidden="true" /> : null}
        <button
          type="button"
          onClick={() => onOpen(task.id)}
          className={cn(
            "min-w-0 flex-1 text-left text-sm line-clamp-2",
            isDone && "text-muted-foreground line-through",
          )}
        >
          {task.title}
        </button>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button
              type="button"
              variant="ghost"
              size="icon-sm"
              className="-mr-1 size-6 shrink-0 opacity-0 group-hover:opacity-100 focus-visible:opacity-100 data-[state=open]:opacity-100"
              aria-label={t("moveTaskAria", { title: task.title })}
            >
              <MoreHorizontal aria-hidden="true" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            {allStatuses
              .filter((status) => status !== task.status)
              .map((status) => (
                <DropdownMenuItem key={status} onSelect={() => onMoveTo(task.id, status)}>
                  {t(statusLabelKeys[status])}
                </DropdownMenuItem>
              ))}
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      <div className="text-muted-foreground mt-1 flex items-center gap-2 text-xs">
        {task.dueAt > 0 ? (
          <span className="inline-flex shrink-0 items-center gap-1 tabular-nums">
            <CalendarDays className="size-3" aria-hidden="true" />
            {format(task.dueAt, "MMM d")}
          </span>
        ) : null}
        {projectName ? <span className="truncate">{projectName}</span> : null}
        {tags.length > 0 ? (
          <span className="ml-auto flex shrink-0 items-center gap-1" aria-hidden="true">
            {tags.slice(0, 3).map((tag) => (
              <span
                key={tag.id}
                className="size-1.5 rounded-full"
                style={{ backgroundColor: tag.color || "var(--muted-foreground)" }}
              />
            ))}
          </span>
        ) : null}
      </div>
    </article>
  );
});
