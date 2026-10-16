"use client";

import { useLiveQuery } from "dexie-react-hooks";
import { queryTasksForView } from "@/db/taskQueries";
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

  return useLiveQuery(
    async () => {
      const tasks = await queryTasksForView(view, {
        projectId: selectedProjectId ?? undefined,
      });
      const dir = sortDir === "desc" ? -1 : 1;
      const sorted = [...tasks].sort((a, b) => {
        if (sortBy === "order") return dir * (a.order - b.order);
        return dir * (a[sortBy] - b[sortBy]);
      });
      // Top-level tasks only in the flat list; subtasks render when expanded.
      return sorted.filter((t) => t.parentId === "");
    },
    [view, selectedProjectId, sortBy, sortDir],
  );
}
