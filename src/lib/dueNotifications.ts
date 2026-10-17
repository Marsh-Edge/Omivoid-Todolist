import type { Task } from "@/types";

/**
 * How far back an overdue task still raises a reminder. Without a window, the
 * first launch would fire a notification for every task that has ever been
 * missed; with it, only recently-due work is announced.
 */
export const DUE_NOTIFY_WINDOW_MS = 3 * 24 * 60 * 60 * 1000;

export interface DueNotificationSelection {
  /** Tasks that just became due and have not been announced yet. */
  notify: Task[];
  /**
   * Map of `taskId → dueAt` for everything currently in the reminder window,
   * to persist so the same occurrence is never announced twice. Tasks that
   * leave the window (completed, deleted, rescheduled) drop out automatically.
   */
  notified: Record<string, number>;
}

/**
 * Pure selection of which tasks deserve a desktop notification right now,
 * given the set already announced. Kept free of `Notification`/Dexie so it can
 * be unit tested.
 */
export function selectDueNotifications(
  tasks: readonly Task[],
  nowMs: number,
  notified: Readonly<Record<string, number>>,
  windowMs: number = DUE_NOTIFY_WINDOW_MS,
): DueNotificationSelection {
  const next: Record<string, number> = {};
  const notify: Task[] = [];

  for (const task of tasks) {
    if (task.deletedAt > 0 || task.status === "done" || task.dueAt <= 0) continue;
    if (task.dueAt <= nowMs && nowMs - task.dueAt <= windowMs) {
      if (notified[task.id] !== task.dueAt) notify.push(task);
      next[task.id] = task.dueAt;
    }
  }

  return { notify, notified: next };
}
