import { endOfDay, startOfDay } from "date-fns";
import type { SmartView, Task } from "@/types";

export function isToday(dueAt: number, nowMs: number): boolean {
  if (dueAt <= 0) return false;
  const start = startOfDay(new Date(nowMs)).getTime();
  const end = endOfDay(new Date(nowMs)).getTime();
  return dueAt >= start && dueAt <= end;
}

export function isOverdue(dueAt: number, nowMs: number): boolean {
  if (dueAt <= 0) return false;
  if (isToday(dueAt, nowMs)) return false;
  return dueAt < startOfDay(new Date(nowMs)).getTime();
}

export function isUpcoming(dueAt: number, nowMs: number): boolean {
  if (dueAt <= 0) return false;
  if (isToday(dueAt, nowMs)) return false;
  return dueAt > endOfDay(new Date(nowMs)).getTime();
}

export function isCompleted(task: Task): boolean {
  return task.status === "done" && task.deletedAt === 0;
}

export function isTrashed(task: Task): boolean {
  return task.deletedAt > 0;
}

export function isImportant(task: Task): boolean {
  return task.priority === "high" && task.deletedAt === 0 && task.status !== "done";
}

export function isInbox(task: Task): boolean {
  return task.deletedAt === 0 && task.projectId === "";
}

/**
 * Single source of truth for smart-view membership.
 * Completed tasks only appear in Completed (or Trash); active views hide them.
 */
export function matchesView(task: Task, view: SmartView, nowMs: number): boolean {
  if (isTrashed(task)) {
    return view === "trash";
  }
  if (view === "trash") return false;
  if (view === "completed") return isCompleted(task);
  if (task.status === "done") return false;
  if (view === "important") return isImportant(task);
  if (view === "today") return isToday(task.dueAt, nowMs);
  if (view === "overdue") return isOverdue(task.dueAt, nowMs);
  if (view === "upcoming") return isUpcoming(task.dueAt, nowMs);
  if (view === "inbox") return isInbox(task);
  return false;
}
