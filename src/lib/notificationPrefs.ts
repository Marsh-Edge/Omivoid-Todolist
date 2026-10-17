/**
 * Tiny UI preference for desktop reminders. `localStorage` is allowed only for
 * settings like this (the task data itself lives in IndexedDB).
 */

const STORAGE_KEY = "omivoid:notify-due";

/** Reminders default to on; failures fall back to the default. */
export function isDueNotificationsEnabled(): boolean {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw === null ? true : raw === "1";
  } catch {
    return true;
  }
}

export function setDueNotificationsEnabled(enabled: boolean): void {
  try {
    localStorage.setItem(STORAGE_KEY, enabled ? "1" : "0");
  } catch {
    // Storage may be unavailable (private mode); reminders just won't persist.
  }
}
