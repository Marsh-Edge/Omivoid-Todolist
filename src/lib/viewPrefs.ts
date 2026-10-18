/**
 * View preferences persist across sessions via `localStorage` (allowed by the
 * project rules for tiny UI settings). Persisted: list/board/calendar layout,
 * sort + grouping, instant filter chips and the search query — NOT navigation
 * (active view / selected project) or dialog state.
 *
 * Everything read back is validated with Zod; a corrupt or outdated blob is
 * discarded and the app starts from its defaults instead of crashing.
 */

import { z } from "zod";
import type { TaskFilterCriteria } from "@/types";
import type { AppFilters, AppState, ViewMode } from "@/store/appStore";

export const VIEW_PREFS_STORAGE_KEY = "omivoid-view";

const taskFilterCriteriaSchema = z
  .object({
    status: z.array(z.enum(["todo", "in_progress", "done"])),
    priority: z.array(z.enum(["none", "low", "medium", "high"])),
    projectId: z.string(),
    tagIds: z.array(z.string()),
  })
  .partial();

export const viewPrefsSchema = z
  .object({
    viewMode: z.enum(["list", "board", "calendar"]),
    sortBy: z.enum(["dueAt", "createdAt", "updatedAt", "order"]),
    sortDir: z.enum(["asc", "desc"]),
    groupBy: z.enum(["none", "project", "date", "tag"]),
    filters: taskFilterCriteriaSchema,
    searchQuery: z.string().max(500),
  })
  .partial();

/** The app-state fields that survive a restart. */
export type ViewPrefs = {
  viewMode: ViewMode;
  sortBy: AppState["sortBy"];
  sortDir: AppState["sortDir"];
  groupBy: AppState["groupBy"];
  filters: AppFilters;
  searchQuery: string;
};

export type ViewPrefsPartial = Partial<ViewPrefs>;

/** Reads and validates the persisted prefs, or null when absent/corrupt. */
export function readViewPrefs(): ViewPrefsPartial | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.localStorage.getItem(VIEW_PREFS_STORAGE_KEY);
    if (!raw) return null;
    const parsed = viewPrefsSchema.safeParse(JSON.parse(raw));
    if (!parsed.success) {
      console.warn("[omivoid] discarding invalid view prefs", parsed.error.issues);
      return null;
    }
    return parsed.data as ViewPrefsPartial;
  } catch {
    // Unreadable JSON or storage unavailable (private mode).
    return null;
  }
}

/** Writes the full current prefs slice; failures are swallowed silently. */
export function writeViewPrefs(prefs: ViewPrefs): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(VIEW_PREFS_STORAGE_KEY, JSON.stringify(prefs));
  } catch {
    // Storage can be unavailable (private mode); defaults just won't persist.
  }
}

/** Picks the persistable slice out of the store state. */
export function pickViewPrefs(state: {
  viewMode: ViewMode;
  sortBy: AppState["sortBy"];
  sortDir: AppState["sortDir"];
  groupBy: AppState["groupBy"];
  filters: TaskFilterCriteria;
  searchQuery: string;
}): ViewPrefs {
  return {
    viewMode: state.viewMode,
    sortBy: state.sortBy,
    sortDir: state.sortDir,
    groupBy: state.groupBy,
    filters: state.filters,
    searchQuery: state.searchQuery,
  };
}
