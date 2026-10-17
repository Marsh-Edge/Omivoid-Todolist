import type { Task, TaskStatus } from "@/types";

/**
 * Pure helpers for the Kanban board. Kept free of React and Dexie so they can
 * be unit tested and reused; the board component only renders the result.
 */

/** Board columns, left to right. */
export const BOARD_COLUMNS: readonly TaskStatus[] = ["todo", "in_progress", "done"];

export interface BoardGroup {
  status: TaskStatus;
  tasks: Task[];
}

/** Buckets tasks into the fixed status columns, preserving input order. */
export function groupTasksByStatus(tasks: readonly Task[]): BoardGroup[] {
  const byStatus = new Map<TaskStatus, Task[]>();
  for (const status of BOARD_COLUMNS) byStatus.set(status, []);
  for (const task of tasks) {
    byStatus.get(task.status)?.push(task);
  }
  return BOARD_COLUMNS.map((status) => ({
    status,
    tasks: byStatus.get(status) as Task[],
  }));
}
