"use client";

import { useLiveQuery } from "dexie-react-hooks";
import { queryTasksForView } from "@/db/taskQueries";
import { visibleInFlatList } from "@/lib/viewPredicates";
import useAppStore from "@/store/appStore";
import type { Task } from "@/types";

/**
 * Live, index-backed task list for the active smart view / selected project.
 *
 * `undefined` until the first IndexedDB result arrives (static-export-safe).
 * Sorting honors the store's `sortBy`/`sortDir`; manual order uses the
 * `[parentId+order]`-friendly `order` field.
 */
export function useTasksForView(): Task[] | undefined {
  const view = useAppStore((s) => s.activeView);
  const selectedProjectId = useAppStore((s) => s.selectedProjectId);
  const sortBy = useAppStore((s) => s.sortBy);
  const sortDir = useAppStore((s) => s.sortDir);
  const searchQuery = useAppStore((s) => s.searchQuery);
  const filters = useAppStore((s) => s.filters);

  return useLiveQuery(
    async () => {
      const tasks = await queryTasksForView(view, {
        projectId: selectedProjectId ?? undefined,
        search: searchQuery,
        filters,
      });
      const dir = sortDir === "desc" ? -1 : 1;
      const sorted = [...tasks].sort((a, b) => {
        const primary = sortBy === "order" ? a.order - b.order : a[sortBy] - b[sortBy];
        if (primary !== 0) return dir * primary;
        // Deterministic tiebreaker: equal sort keys keep a stable order across
        // views and re-queries instead of inheriting whatever the index returned.
        if (a.createdAt !== b.createdAt) return a.createdAt - b.createdAt;
        return a.id < b.id ? -1 : a.id > b.id ? 1 : 0;
      });
      // Top-level tasks only in the flat list (subtasks render when
      // expanded); the Completed view also keeps finished subtasks so a
      // completed child never disappears from every view.
      return sorted.filter((t) => visibleInFlatList(t, view));
    },
    // `filters` is a stable reference between store updates; list its fields so
    // a mutation of any filter re-runs the live query.
    [
      view,
      selectedProjectId,
      sortBy,
      sortDir,
      searchQuery,
      filters.status?.join(",") ?? "",
      filters.priority?.join(",") ?? "",
      filters.projectId ?? "",
      filters.tagIds?.join(",") ?? "",
    ],
  );
}
