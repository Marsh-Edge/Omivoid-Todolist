"use client";

import { useCallback, useState } from "react";
import { ChevronDown, SlidersHorizontal } from "lucide-react";
import { cn } from "cn";
import { Button } from "@/components/ui/button";
import { useDismissable } from "@/hooks/useDismissable";
import { t, type MessageKey } from "@/lib/i18n";
import useAppStore from "@/store/appStore";
import type { TaskFilterCriteria, TaskPriority, TaskStatus } from "@/types";

const statuses: readonly TaskStatus[] = ["todo", "in_progress", "done"];
const priorities: readonly TaskPriority[] = ["none", "low", "medium", "high"];

const statusLabels: Record<TaskStatus, MessageKey> = {
  todo: "statusTodo",
  in_progress: "statusInProgress",
  done: "statusDone",
};

const priorityLabels: Record<TaskPriority, MessageKey> = {
  none: "priorityNone",
  low: "priorityLow",
  medium: "priorityMedium",
  high: "priorityHigh",
};

/** Adds/removes `value`; an emptied list becomes `undefined` ("no constraint"). */
function toggleValue<T>(list: readonly T[] | undefined, value: T): T[] | undefined {
  const current = list ?? [];
  const next = current.includes(value)
    ? current.filter((item) => item !== value)
    : [...current, value];
  return next.length > 0 ? next : undefined;
}

function countActiveFilters(filters: TaskFilterCriteria): number {
  let count = 0;
  if (filters.status && filters.status.length > 0) count += 1;
  if (filters.priority && filters.priority.length > 0) count += 1;
  if (filters.projectId) count += 1;
  if (filters.tagIds && filters.tagIds.length > 0) count += 1;
  return count;
}

/** Status + priority filter chips for the active view. */
export function FilterMenu() {
  const filters = useAppStore((s) => s.filters);
  const setFilters = useAppStore((s) => s.setFilters);
  const clearFilters = useAppStore((s) => s.clearFilters);
  const [open, setOpen] = useState(false);
  const close = useCallback(() => setOpen(false), []);
  const ref = useDismissable<HTMLDivElement>(open, close);

  const activeCount = countActiveFilters(filters);

  function toggleStatus(status: TaskStatus) {
    setFilters({ ...filters, status: toggleValue(filters.status, status) });
  }

  function togglePriority(priority: TaskPriority) {
    setFilters({ ...filters, priority: toggleValue(filters.priority, priority) });
  }

  return (
    <div className="relative" ref={ref}>
      <Button
        type="button"
        variant="outline"
        size="sm"
        onClick={() => setOpen((value) => !value)}
        aria-expanded={open}
        aria-label={t("filterButtonAria")}
        className="gap-1"
      >
        <SlidersHorizontal className="size-3.5" aria-hidden="true" />
        {activeCount > 0 ? (
          <span className="text-xs">{t("filterActiveCount", { count: activeCount })}</span>
        ) : null}
        <ChevronDown className="size-3" aria-hidden="true" />
      </Button>

      {open ? (
        <div className="bg-popover ring-border absolute right-0 z-50 mt-2 min-w-[220px] rounded-md p-2 shadow-lg ring-1">
          <p className="text-muted-foreground px-1 pb-1 text-xs font-semibold uppercase tracking-wide">
            {t("filterStatus")}
          </p>
          <div className="flex flex-wrap gap-1 pb-2" role="group" aria-label={t("filterStatus")}>
            {statuses.map((status) => {
              const active = filters.status?.includes(status) ?? false;
              return (
                <button
                  key={status}
                  type="button"
                  onClick={() => toggleStatus(status)}
                  aria-pressed={active}
                  className={cn(
                    "rounded-full border px-2 py-0.5 text-xs transition-colors",
                    active ? "border-ring bg-accent font-medium" : "hover:bg-accent",
                  )}
                >
                  {t(statusLabels[status])}
                </button>
              );
            })}
          </div>

          <p className="text-muted-foreground px-1 pb-1 text-xs font-semibold uppercase tracking-wide">
            {t("filterPriority")}
          </p>
          <div className="flex flex-wrap gap-1 pb-1" role="group" aria-label={t("filterPriority")}>
            {priorities.map((priority) => {
              const active = filters.priority?.includes(priority) ?? false;
              return (
                <button
                  key={priority}
                  type="button"
                  onClick={() => togglePriority(priority)}
                  aria-pressed={active}
                  className={cn(
                    "rounded-full border px-2 py-0.5 text-xs transition-colors",
                    active ? "border-ring bg-accent font-medium" : "hover:bg-accent",
                  )}
                >
                  {t(priorityLabels[priority])}
                </button>
              );
            })}
          </div>

          <div className="bg-border my-1 h-px" />
          <button
            type="button"
            onClick={clearFilters}
            disabled={activeCount === 0}
            className="hover:bg-accent flex w-full items-center rounded px-2 py-1 text-sm disabled:pointer-events-none disabled:opacity-50"
          >
            {t("filterClear")}
          </button>
        </div>
      ) : null}
    </div>
  );
}
