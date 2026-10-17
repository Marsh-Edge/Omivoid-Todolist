/**
 * Pure statistics aggregation for the (lazy-loaded) Statistics page.
 *
 * Input is always an in-memory array of tasks already read through the indexed
 * `[deletedAt+order]` query (`listActiveTasks`), so nothing here touches Dexie
 * or the clock implicitly — `nowMs` is injected, making every function
 * deterministic and unit-testable. Trashed rows are ignored everywhere.
 */

import { endOfDay, startOfDay, subDays } from "date-fns";
import type { Project, Task, TaskPriority, TaskStatus } from "@/types";

/** Sentinel/absent checks mirror the domain rules (see `src/types`). */
function isTrashed(task: Task): boolean {
  return task.deletedAt > 0;
}

export interface TaskSummary {
  /** Non-trashed tasks that are not done. */
  active: number;
  /** Non-trashed tasks marked done (all time). */
  completed: number;
  /** Active tasks whose due time is in the past. */
  overdue: number;
  /** Active tasks due sometime today. */
  dueToday: number;
  /** completed / (completed + active) as a 0–100 integer. */
  completionRate: number;
}

/** Headline counts for the summary cards. */
export function summarizeTasks(tasks: readonly Task[], nowMs: number): TaskSummary {
  const dayStart = startOfDay(new Date(nowMs)).getTime();
  const dayEnd = endOfDay(new Date(nowMs)).getTime();

  let active = 0;
  let completed = 0;
  let overdue = 0;
  let dueToday = 0;

  for (const task of tasks) {
    if (isTrashed(task)) continue;
    if (task.status === "done") {
      completed += 1;
      continue;
    }
    active += 1;
    if (task.dueAt <= 0) continue;
    if (task.dueAt < dayStart) overdue += 1;
    else if (task.dueAt <= dayEnd) dueToday += 1;
  }

  const denom = completed + active;
  const completionRate = denom === 0 ? 0 : Math.round((completed / denom) * 100);
  return { active, completed, overdue, dueToday, completionRate };
}

export interface TrendPoint {
  /** Epoch ms at the start of the day bucket. */
  dayStart: number;
  count: number;
}

/**
 * Tasks completed per day over the last `days` days (inclusive of today),
 * oldest first. Days with no completions are present with `count: 0` so the
 * chart keeps an even time axis. Completions older than the window are ignored.
 */
export function completionTrend(
  tasks: readonly Task[],
  nowMs: number,
  days: number,
): TrendPoint[] {
  const clampedDays = Math.max(1, Math.floor(days));
  const today = startOfDay(new Date(nowMs)).getTime();

  const buckets = new Map<number, number>();
  for (let i = 0; i < clampedDays; i += 1) {
    buckets.set(subDays(new Date(today), clampedDays - 1 - i).getTime(), 0);
  }

  // Derive the window bounds from the bucket keys themselves so DST transitions
  // can't drift the arithmetic.
  const oldest = Math.min(...buckets.keys());
  for (const task of tasks) {
    if (isTrashed(task)) continue;
    if (task.completedAt <= 0) continue;
    const dayStart = startOfDay(new Date(task.completedAt)).getTime();
    if (dayStart < oldest || dayStart > today) continue;
    buckets.set(dayStart, (buckets.get(dayStart) ?? 0) + 1);
  }

  return [...buckets.entries()]
    .sort((a, b) => a[0] - b[0])
    .map(([dayStart, count]) => ({ dayStart, count }));
}

export interface StatusCount {
  status: TaskStatus;
  count: number;
}

const STATUS_ORDER: readonly TaskStatus[] = ["todo", "in_progress", "done"];

/** Non-trashed task counts per status, in a stable order. */
export function countByStatus(tasks: readonly Task[]): StatusCount[] {
  const counts: Record<TaskStatus, number> = { todo: 0, in_progress: 0, done: 0 };
  for (const task of tasks) {
    if (isTrashed(task)) continue;
    counts[task.status] += 1;
  }
  return STATUS_ORDER.map((status) => ({ status, count: counts[status] }));
}

export interface PriorityCount {
  priority: TaskPriority;
  count: number;
}

const PRIORITY_ORDER: readonly TaskPriority[] = ["high", "medium", "low", "none"];

/** Non-trashed task counts per priority (high → none). */
export function countByPriority(tasks: readonly Task[]): PriorityCount[] {
  const counts: Record<TaskPriority, number> = { none: 0, low: 0, medium: 0, high: 0 };
  for (const task of tasks) {
    if (isTrashed(task)) continue;
    counts[task.priority] += 1;
  }
  return PRIORITY_ORDER.map((priority) => ({ priority, count: counts[priority] }));
}

export interface ProjectCount {
  /** "" for the Inbox bucket. */
  id: string;
  name: string;
  color: string;
  count: number;
}

/**
 * Top projects by non-trashed task count (descending), including an Inbox
 * bucket for tasks without a project. Ties keep project input order; unknown
 * project ids (orphaned tasks) fall back to a generic label.
 */
export function topProjects(
  tasks: readonly Task[],
  projects: readonly Project[],
  limit: number,
): ProjectCount[] {
  const byId = new Map(projects.map((project) => [project.id, project]));
  const counts = new Map<string, number>();

  for (const task of tasks) {
    if (isTrashed(task)) continue;
    counts.set(task.projectId, (counts.get(task.projectId) ?? 0) + 1);
  }

  const buckets: ProjectCount[] = [];
  for (const [id, count] of counts) {
    const project = byId.get(id);
    buckets.push({
      id,
      name: project?.name ?? (id === "" ? "" : id),
      color: project?.color ?? "",
      count,
    });
  }

  buckets.sort((a, b) => b.count - a.count);
  return buckets.slice(0, Math.max(0, Math.floor(limit)));
}
