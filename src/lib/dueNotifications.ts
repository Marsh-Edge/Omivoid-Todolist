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
 *
 * A task fires at `dueAt - remindBeforeMin` (lead time) and stays eligible for
 * `windowMs` after that instant, so a reminder set a day early still shows up
 * on the next launch rather than being missed.
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
    const remindAt = task.dueAt - task.remindBeforeMin * 60_000;
    if (remindAt <= nowMs && nowMs - remindAt <= windowMs) {
      if (notified[task.id] !== task.dueAt) notify.push(task);
      next[task.id] = task.dueAt;
    }
  }

  return { notify, notified: next };
}
