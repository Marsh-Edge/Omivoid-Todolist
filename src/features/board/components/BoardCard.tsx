"use client";

import { format } from "date-fns";
import { CalendarDays, Flag } from "lucide-react";
import { cn } from "cn";
import { t } from "@/lib/i18n";
import type { Tag, Task, TaskPriority } from "@/types";

const priorityColors: Record<Exclude<TaskPriority, "none">, string> = {
  low: "text-blue-500",
  medium: "text-amber-500",
  high: "text-red-500",
};

export interface BoardCardProps {
  task: Task;
  projectName?: string;
  tags: readonly Tag[];
  onOpen: () => void;
  onDragStart: () => void;
  onDragEnd: () => void;
}

export function BoardCard({
  task,
  projectName,
  tags,
  onOpen,
  onDragStart,
  onDragEnd,
}: BoardCardProps) {
  const isDone = task.status === "done";
  const priority = task.priority !== "none" ? priorityColors[task.priority] : null;

  return (
    <article
      draggable
      onDragStart={onDragStart}
      onDragEnd={onDragEnd}
      onClick={onOpen}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          onOpen();
        }
      }}
      role="button"
      tabIndex={0}
      aria-label={t("openNotes", { title: task.title })}
      className="bg-card hover:bg-muted/60 focus-visible:ring-ring flex h-[76px] w-full cursor-grab flex-col overflow-hidden rounded-md border p-2 text-left shadow-sm transition-colors focus-visible:ring-2 focus-visible:outline-none active:cursor-grabbing"
    >
      <div className="flex items-start gap-1.5">
        {priority ? (
          <Flag className={cn("mt-0.5 size-3 shrink-0", priority)} aria-hidden="true" />
        ) : null}
        <span
          className={cn(
            "line-clamp-2 text-sm",
            isDone && "text-muted-foreground line-through",
          )}
        >
          {task.title}
        </span>
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
}
