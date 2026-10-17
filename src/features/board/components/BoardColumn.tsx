"use client";

import { useRef } from "react";
import { useVirtualizer } from "@tanstack/react-virtual";
import { cn } from "cn";
import { BoardCard } from "./BoardCard";
import type { Tag, Task, TaskStatus } from "@/types";

/** Card height (76px) + 8px gap; the virtualizer uses it as a fixed estimate. */
const ITEM_HEIGHT = 84;

export interface BoardColumnProps {
  label: string;
  tasks: readonly Task[];
  projectNames: Map<string, string>;
  tagById: Map<string, Tag>;
  isDragOver: boolean;
  emptyLabel: string;
  onDragOverColumn: (e: React.DragEvent) => void;
  onDropColumn: () => void;
  onCardDragStart: (id: string) => void;
  onCardDragEnd: () => void;
  onCardOpen: (id: string) => void;
  onCardMove: (id: string, status: TaskStatus) => void;
}

export function BoardColumn({
  label,
  tasks,
  projectNames,
  tagById,
  isDragOver,
  emptyLabel,
  onDragOverColumn,
  onDropColumn,
  onCardDragStart,
  onCardDragEnd,
  onCardOpen,
  onCardMove,
}: BoardColumnProps) {
  const scrollRef = useRef<HTMLDivElement>(null);

  const virtualizer = useVirtualizer({
    count: tasks.length,
    getScrollElement: () => scrollRef.current,
    estimateSize: () => ITEM_HEIGHT,
    overscan: 6,
  });

  return (
    <section
      aria-label={label}
      onDragOver={onDragOverColumn}
      onDrop={onDropColumn}
      className={cn(
        "bg-muted/20 flex h-full w-[280px] shrink-0 flex-col rounded-lg border",
        isDragOver && "ring-ring ring-2",
      )}
    >
      <header className="flex items-center justify-between gap-2 px-3 py-2">
        <h2 className="text-xs font-semibold tracking-wide uppercase">{label}</h2>
        <span className="text-muted-foreground text-xs tabular-nums">{tasks.length}</span>
      </header>

      {tasks.length === 0 ? (
        <p className="text-muted-foreground min-h-0 flex-1 px-3 py-2 text-xs">{emptyLabel}</p>
      ) : (
        <div ref={scrollRef} className="min-h-0 flex-1 overflow-y-auto px-2">
          <div style={{ height: virtualizer.getTotalSize(), position: "relative" }}>
            {virtualizer.getVirtualItems().map((item) => {
              const task = tasks[item.index];
              if (!task) return null;
              return (
                <div
                  key={task.id}
                  className="pb-2"
                  style={{
                    position: "absolute",
                    top: 0,
                    left: 0,
                    width: "100%",
                    height: ITEM_HEIGHT,
                    transform: `translateY(${item.start}px)`,
                  }}
                >
                  <BoardCard
                    task={task}
                    projectName={task.projectId ? projectNames.get(task.projectId) : undefined}
                    tags={task.tagIds
                      .map((id) => tagById.get(id))
                      .filter((tag): tag is Tag => tag !== undefined)}
                    onOpen={() => onCardOpen(task.id)}
                    onMoveTo={(status) => onCardMove(task.id, status)}
                    onDragStart={() => onCardDragStart(task.id)}
                    onDragEnd={onCardDragEnd}
                  />
                </div>
              );
            })}
          </div>
        </div>
      )}
    </section>
  );
}
