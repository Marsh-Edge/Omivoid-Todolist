"use client";

import { useCallback, useMemo } from "react";
import { useLiveQuery } from "dexie-react-hooks";
import { listActiveTasks } from "@/db/taskRepository";
import { findBacklinks, normalizeTitle } from "@/lib/wikiLinks";
import type { Task } from "@/types";

export interface TaskSuggestion {
  id: string;
  title: string;
}

export interface TaskNoteReferences {
  /** Resolves a wiki-link title to a task id (case-insensitive), or null. */
  resolveTitle: (title: string) => string | null;
  /** Other active tasks whose notes link to `task.title`. */
  backlinks: TaskSuggestion[];
  /** Title suggestions for the link picker, excluding the current task. */
  suggestTitles: (query: string, excludeId: string) => TaskSuggestion[];
  /** True once the active-task set has loaded. */
  ready: boolean;
}

const MAX_SUGGESTIONS = 20;

/**
 * On-demand title resolution and backlink computation for the task detail
 * panel. The active-task set is read live *only while the panel is mounted*
 * (see PLAN.md for the indexed-table follow-up).
 */
export function useTaskNoteReferences(task: Task | undefined): TaskNoteReferences {
  const tasks = useLiveQuery(() => listActiveTasks(), []);

  const titleToId = useMemo(() => {
    const map = new Map<string, string>();
    for (const item of tasks ?? []) {
      const key = normalizeTitle(item.title);
      if (key && !map.has(key)) map.set(key, item.id);
    }
    return map;
  }, [tasks]);

  const resolveTitle = useCallback(
    (title: string) => titleToId.get(normalizeTitle(title)) ?? null,
    [titleToId],
  );

  const backlinks = useMemo<TaskSuggestion[]>(() => {
    if (!tasks || !task) return [];
    return findBacklinks(
      tasks.filter((item) => item.id !== task.id),
      task.title,
    ).map((item) => ({ id: item.id, title: item.title }));
  }, [tasks, task]);

  const suggestTitles = useCallback(
    (query: string, excludeId: string): TaskSuggestion[] => {
      const needle = normalizeTitle(query);
      return (tasks ?? [])
        .filter((item) => item.id !== excludeId)
        .filter((item) => !needle || normalizeTitle(item.title).includes(needle))
        .slice(0, MAX_SUGGESTIONS)
        .map((item) => ({ id: item.id, title: item.title }));
    },
    [tasks],
  );

  return { resolveTitle, backlinks, suggestTitles, ready: tasks !== undefined };
}
