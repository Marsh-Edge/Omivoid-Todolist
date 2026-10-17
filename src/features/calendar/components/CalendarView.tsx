"use client";

import { useMemo, useState } from "react";
import { addMonths, format, isSameMonth, isToday } from "date-fns";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { cn } from "cn";
import { Button } from "@/components/ui/button";
import { useTasksForView } from "@/features/views/useTasksForView";
import { buildMonthMatrix, countWithoutDue, dayKey, groupTasksByDay } from "@/lib/calendar";
import useAppStore from "@/store/appStore";
import { t } from "@/lib/i18n";

/** Most tasks shown per day cell before the "+N more" overflow. */
const MAX_VISIBLE_PER_DAY = 3;

/**
 * Month calendar of the active view's tasks that have a due date. Tasks
 * without a due date can't be placed, so they're summarized instead.
 */
export default function CalendarView() {
  const tasks = useTasksForView();
  const setDetailTaskId = useAppStore((s) => s.setDetailTaskId);
  const [monthMs, setMonthMs] = useState(() => Date.now());

  const monthDate = useMemo(() => new Date(monthMs), [monthMs]);
  const weeks = useMemo(() => buildMonthMatrix(monthMs, 0), [monthMs]);
  const tasksByDay = useMemo(() => groupTasksByDay(tasks ?? []), [tasks]);
  const noDue = useMemo(() => countWithoutDue(tasks ?? []), [tasks]);

  if (!tasks) {
    return <div className="text-muted-foreground text-sm">{t("loadingTasks")}</div>;
  }

  const weekdays = weeks[0] ?? [];

  return (
    <div className="flex min-h-0 flex-1 flex-col gap-3">
      <div className="flex flex-wrap items-center gap-2">
        <Button
          type="button"
          variant="outline"
          size="icon-sm"
          onClick={() => setMonthMs((m) => addMonths(new Date(m), -1).getTime())}
          aria-label={t("calendarPrevMonth")}
        >
          <ChevronLeft aria-hidden="true" />
        </Button>
        <Button type="button" variant="outline" size="sm" onClick={() => setMonthMs(Date.now())}>
          {t("calendarTodayButton")}
        </Button>
        <Button
          type="button"
          variant="outline"
          size="icon-sm"
          onClick={() => setMonthMs((m) => addMonths(new Date(m), 1).getTime())}
          aria-label={t("calendarNextMonth")}
        >
          <ChevronRight aria-hidden="true" />
        </Button>
        <h2 className="ml-1 text-sm font-semibold">{format(monthDate, "MMMM yyyy")}</h2>
        {noDue > 0 ? (
          <span className="text-muted-foreground ml-auto text-xs">
            {t("calendarNoDueNote", { count: noDue })}
          </span>
        ) : null}
      </div>

      <div className="grid grid-cols-7 gap-px">
        {weekdays.map((day) => (
          <div
            key={dayKey(day.getTime())}
            className="text-muted-foreground py-1 text-center text-xs font-medium"
          >
            {format(day, "EEE")}
          </div>
        ))}
      </div>

      <div className="flex min-h-0 flex-1 flex-col gap-px">
        {weeks.map((week) => (
          <div
            key={dayKey((week[0] ?? new Date()).getTime())}
            className="grid min-h-0 flex-1 grid-cols-7 gap-px"
          >
            {week.map((day) => {
              const key = dayKey(day.getTime());
              const dayTasks = tasksByDay.get(key) ?? [];
              const inMonth = isSameMonth(day, monthDate);
              const dayIsToday = isToday(day);
              return (
                <div
                  key={key}
                  aria-label={t("calendarDayAria", { date: format(day, "MMM d") })}
                  className={cn(
                    "flex min-h-0 flex-col gap-0.5 overflow-hidden rounded-sm border p-1",
                    !inMonth && "opacity-40",
                    dayIsToday && "border-primary",
                  )}
                >
                  <span
                    className={cn(
                      "text-[0.7rem] tabular-nums",
                      dayIsToday ? "font-semibold" : "text-muted-foreground",
                    )}
                  >
                    {format(day, "d")}
                  </span>

                  {dayTasks.slice(0, MAX_VISIBLE_PER_DAY).map((task) => (
                    <button
                      key={task.id}
                      type="button"
                      onClick={() => setDetailTaskId(task.id)}
                      aria-label={t("openNotes", { title: task.title })}
                      title={task.title}
                      className="bg-muted hover:bg-accent truncate rounded px-1 py-0.5 text-left text-[0.7rem]"
                    >
                      {task.title}
                    </button>
                  ))}

                  {dayTasks.length > MAX_VISIBLE_PER_DAY ? (
                    <span className="text-muted-foreground text-[0.65rem]">
                      {t("calendarMoreTasks", { count: dayTasks.length - MAX_VISIBLE_PER_DAY })}
                    </span>
                  ) : null}
                </div>
              );
            })}
          </div>
        ))}
      </div>
    </div>
  );
}
