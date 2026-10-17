import { addDays, startOfDay } from "date-fns";
import type { Task, TaskPriority, TaskStatus } from "@/types";

/**
 * Pure, testable search / filter / group predicates shared by the view hook
 * and the task list. Kept free of React and Dexie so they can be unit tested
 * and reused anywhere.
 *
 * These run *after* the index-backed view query has already narrowed the set
 * (see `queryTasksForView`), so a search never triggers a full-table scan.
 */

export interface TaskFilterCriteria {
  status?: TaskStatus[];
  priority?: TaskPriority[];
  projectId?: string;
  /** A task matches when it carries *any* of the selected tags (OR). */
  tagIds?: string[];
}

/** Case-insensitive substring match over the title and notes. */
export function matchesSearch(task: Task, query: string): boolean {
  const needle = query.trim().toLowerCase();
  if (!needle) return true;
  return (
    task.title.toLowerCase().includes(needle) ||
    task.notes.toLowerCase().includes(needle)
  );
}

export function matchesFilters(task: Task, filters: TaskFilterCriteria): boolean {
  if (filters.status && filters.status.length > 0 && !filters.status.includes(task.status)) {
    return false;
  }
  if (
    filters.priority &&
    filters.priority.length > 0 &&
    !filters.priority.includes(task.priority)
  ) {
    return false;
  }
  if (filters.projectId && task.projectId !== filters.projectId) {
    return false;
  }
  if (
    filters.tagIds &&
    filters.tagIds.length > 0 &&
    !task.tagIds.some((id) => filters.tagIds?.includes(id))
  ) {
    return false;
  }
  return true;
}

export function applyTaskSearchAndFilters(
  tasks: readonly Task[],
  search: string,
  filters: TaskFilterCriteria,
): Task[] {
  return tasks.filter((task) => matchesSearch(task, search) && matchesFilters(task, filters));
}

export type GroupBy = "none" | "project" | "date" | "tag";

export type DateBucket = "overdue" | "today" | "tomorrow" | "thisWeek" | "later" | "noDue";

/** Buckets a due timestamp relative to `nowMs` (local time). */
export function dateBucket(dueAt: number, nowMs: number): DateBucket {
  if (dueAt <= 0) return "noDue";
  const base = startOfDay(new Date(nowMs)).getTime();
  if (dueAt < base) return "overdue";
  if (dueAt < addDays(new Date(base), 1).getTime()) return "today";
  if (dueAt < addDays(new Date(base), 2).getTime()) return "tomorrow";
  if (dueAt < addDays(new Date(base), 7).getTime()) return "thisWeek";
  return "later";
}

export interface TaskGroup {
  key: string;
  label: string;
  tasks: Task[];
}

export interface GroupLabelResolver {
  /** Display name for a project id ("" → the "no project" label). */
  project: (id: string) => string;
  /** Display name for a tag id ("" → the "no tag" label). */
  tag: (id: string) => string;
  date: Record<DateBucket, string>;
}

const NO_PROJECT_KEY = "__none_project__";
const NO_TAG_KEY = "__none_tag__";
const DATE_ORDER: readonly DateBucket[] = [
  "overdue",
  "today",
  "tomorrow",
  "thisWeek",
  "later",
  "noDue",
];

/**
 * Groups already-sorted tasks for display. Groups appear in first-appearance
 * order, except date groups which use a fixed chronological order. When
 * grouping by tag a task joins its *first* tag group (no duplication).
 */
export function groupTasks(
  tasks: readonly Task[],
  groupBy: GroupBy,
  labels: GroupLabelResolver,
  nowMs: number = Date.now(),
): TaskGroup[] {
  if (groupBy === "none") return [];

  const order: string[] = [];
  const map = new Map<string, TaskGroup>();

  function add(key: string, label: string, task: Task) {
    let group = map.get(key);
    if (!group) {
      group = { key, label, tasks: [] };
      map.set(key, group);
      order.push(key);
    }
    group.tasks.push(task);
  }

  if (groupBy === "project") {
    for (const task of tasks) {
      const id = task.projectId;
      add(id || NO_PROJECT_KEY, labels.project(id), task);
    }
  } else if (groupBy === "tag") {
    for (const task of tasks) {
      const firstTag = task.tagIds[0];
      if (firstTag === undefined) add(NO_TAG_KEY, labels.tag(""), task);
      else add(`tag:${firstTag}`, labels.tag(firstTag), task);
    }
  } else {
    const byBucket = new Map<DateBucket, Task[]>();
    for (const task of tasks) {
      const bucket = dateBucket(task.dueAt, nowMs);
      const list = byBucket.get(bucket);
      if (list) list.push(task);
      else byBucket.set(bucket, [task]);
    }
    for (const bucket of DATE_ORDER) {
      const list = byBucket.get(bucket);
      if (list && list.length > 0) {
        map.set(bucket, { key: bucket, label: labels.date[bucket], tasks: list });
        order.push(bucket);
      }
    }
  }

  return order.map((key) => map.get(key) as TaskGroup);
}
