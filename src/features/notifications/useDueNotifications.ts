"use client";

import { useEffect } from "react";
import { listActiveTasks } from "@/db/taskRepository";
import { selectDueNotifications } from "@/lib/dueNotifications";
import { isDueNotificationsEnabled } from "@/lib/notificationPrefs";
import { t } from "@/lib/i18n";

const STORAGE_KEY = "omivoid:due-notified";
const CHECK_INTERVAL_MS = 60_000;

function readNotified(): Record<string, number> {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return {};
    const parsed: unknown = JSON.parse(raw);
    return parsed !== null && typeof parsed === "object"
      ? (parsed as Record<string, number>)
      : {};
  } catch {
    return {};
  }
}

function writeNotified(value: Record<string, number>): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(value));
  } catch {
    // Best-effort; worst case a reminder repeats next launch.
  }
}

/**
 * Fires an OS notification when a task's due time passes, once per occurrence,
 * and only for tasks overdue within the recent window. Uses the Web
 * `Notification` API, which the Electron renderer grants by default (no
 * preload/IPC needed). Polls on an interval; silently no-ops where the API or
 * permission is unavailable.
 */
export function useDueNotifications(): void {
  useEffect(() => {
    async function check(): Promise<void> {
      if (typeof Notification === "undefined" || !isDueNotificationsEnabled()) return;
      try {
        if (Notification.permission === "default") {
          await Notification.requestPermission();
        }
        if (Notification.permission !== "granted") return;

        const tasks = await listActiveTasks();
        const { notify, notified } = selectDueNotifications(tasks, Date.now(), readNotified());
        for (const task of notify) {
          try {
            new Notification(t("notificationTitle"), { body: task.title, tag: task.id });
          } catch {
            // Some environments throw instead of no-oping; ignore.
          }
        }
        // Always persist so the map stays pruned to tasks in the window.
        writeNotified(notified);
      } catch {
        // Never surface reminder errors to the user.
      }
    }

    void check();
    const timer = window.setInterval(() => void check(), CHECK_INTERVAL_MS);
    return () => window.clearInterval(timer);
  }, []);
}
