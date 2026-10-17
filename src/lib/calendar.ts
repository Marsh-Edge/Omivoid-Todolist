import { addDays, endOfMonth, endOfWeek, startOfMonth, startOfWeek } from "date-fns";
import type { Task } from "@/types";

/**
 * Pure helpers for the month calendar. Free of React/Dexie so they can be
 * unit tested; the calendar component only lays out the result.
 */

export type WeekStartsOn = 0 | 1;

/** Local-time `yyyy-mm-dd` key for a timestamp. */
export function dayKey(ms: number): string {
  const d = new Date(ms);
  const month = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${d.getFullYear()}-${month}-${day}`;
}

/**
 * Indexes tasks by their due day. Tasks without a due date (`dueAt <= 0`) are
 * skipped — they cannot be placed on the grid.
 */
export function groupTasksByDay(tasks: readonly Task[]): Map<string, Task[]> {
  const byDay = new Map<string, Task[]>();
  for (const task of tasks) {
    if (task.dueAt <= 0) continue;
    const key = dayKey(task.dueAt);
    const list = byDay.get(key);
    if (list) list.push(task);
    else byDay.set(key, [task]);
  }
  return byDay;
}

/**
 * Weeks covering the month containing `monthMs`. Every week is exactly seven
 * dates starting on `weekStartsOn`, so leading/trailing days from adjacent
 * months are included (rendered dimmed by the caller).
 */
export function buildMonthMatrix(monthMs: number, weekStartsOn: WeekStartsOn = 0): Date[][] {
  const month = new Date(monthMs);
  const start = startOfWeek(startOfMonth(month), { weekStartsOn });
  const end = endOfWeek(endOfMonth(month), { weekStartsOn });

  const weeks: Date[][] = [];
  let cursor = start;
  while (cursor <= end) {
    const week: Date[] = [];
    for (let i = 0; i < 7; i++) {
      week.push(cursor);
      cursor = addDays(cursor, 1);
    }
    weeks.push(week);
  }
  return weeks;
}

/** Count of tasks that have no due date (cannot be shown on the grid). */
export function countWithoutDue(tasks: readonly Task[]): number {
  let count = 0;
  for (const task of tasks) if (task.dueAt <= 0) count++;
  return count;
}
