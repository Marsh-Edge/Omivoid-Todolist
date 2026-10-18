"use client";

import { useCallback, useMemo } from "react";
import { useLiveQuery } from "dexie-react-hooks";
import { listNoteLinksTo } from "@/db/noteLinkRepository";
import { queryActiveTaskTitles } from "@/db/taskQueries";
import { normalizeTitle } from "@/lib/wikiLinks";
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
}

const MAX_SUGGESTIONS = 20;

/**
 * On-demand title resolution and backlink computation for the task detail
 * panel. The active-task set is read live *only while the panel is mounted*
 * (see PLAN.md for the indexed-table follow-up).
 */
export function useTaskNoteReferences(task: Task | undefined): TaskNoteReferences {
  const tasks = useLiveQuery(() => queryActiveTaskTitles(), []);
  const backlinks = useLiveQuery(
    () => (task ? listNoteLinksTo(task.id) : Promise.resolve([])),
    [task?.id],
  );

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

  const backlinksSuggestions = useMemo<TaskSuggestion[]>(() => {
    const ids = new Set(backlinks?.map((link) => link.sourceTaskId) ?? []);
    return (tasks ?? [])
      .filter((item) => item.id !== task?.id && ids.has(item.id))
      .map((item) => ({ id: item.id, title: item.title }));
  }, [backlinks, tasks, task?.id]);

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

  return {
    resolveTitle,
    backlinks: backlinksSuggestions,
    suggestTitles,
  };
}
