"use client";

import { useEffect, useMemo, useState } from "react";
import { useLiveQuery } from "dexie-react-hooks";
import { listActiveTasks } from "@/db/taskRepository";
import { listProjects } from "@/db/projectRepository";
import {
  completionTrend,
  countByPriority,
  countByStatus,
  summarizeTasks,
  topProjects,
  type PriorityCount,
  type ProjectCount,
  type StatusCount,
  type TaskSummary,
  type TrendPoint,
} from "@/lib/stats";

/** Days shown in the completions trend chart. */
export const TREND_DAYS = 30;

/** Projects shown in the "tasks per project" chart. */
export const TOP_PROJECTS_LIMIT = 6;

export interface StatsData {
  summary: TaskSummary;
  trend: TrendPoint[];
  statuses: StatusCount[];
  priorities: PriorityCount[];
  projects: ProjectCount[];
}

/**
 * Live, global statistics over all non-trashed tasks (`undefined` until the
 * first IndexedDB result arrives, static-export-safe). Reads the same
 * `[deletedAt+order]` index as the list, so no new index is required.
 *
 * `nowMs` is captured once per mount (React-Compiler-safe lazy state) so the
 * aggregation stays pure during render; overdue/today counts refresh when the
 * underlying data changes.
 */
export function useStats(): StatsData | undefined {
  const tasks = useLiveQuery(() => listActiveTasks(), []);
  const projects = useLiveQuery(() => listProjects(), []);
  const [nowMs, setNowMs] = useState(() => Date.now());

  useEffect(() => {
    const interval = window.setInterval(() => setNowMs(Date.now()), 60_000);
    const onFocus = () => setNowMs(Date.now());
    const onVisibility = () => {
      if (document.visibilityState === "visible") setNowMs(Date.now());
    };
    const onDayChange = () => setNowMs(Date.now());
    let midnightTimer: number | undefined;
    function scheduleMidnight(): void {
      if (midnightTimer !== undefined) window.clearTimeout(midnightTimer);
      const now = Date.now();
      const d = new Date(now);
      d.setHours(24, 0, 0, 0);
      const ms = d.getTime() - now;
      midnightTimer = window.setTimeout(() => {
        onDayChange();
        scheduleMidnight();
      }, ms);
    }
    scheduleMidnight();
    window.addEventListener("focus", onFocus);
    document.addEventListener("visibilitychange", onVisibility);
    return () => {
      if (midnightTimer !== undefined) window.clearTimeout(midnightTimer);
      window.clearInterval(interval);
      window.removeEventListener("focus", onFocus);
      document.removeEventListener("visibilitychange", onVisibility);
    };
  }, []);

  return useMemo(() => {
    if (!tasks || !projects) return undefined;
    return {
      summary: summarizeTasks(tasks, nowMs),
      trend: completionTrend(tasks, nowMs, TREND_DAYS),
      statuses: countByStatus(tasks),
      priorities: countByPriority(tasks),
      projects: topProjects(tasks, projects, TOP_PROJECTS_LIMIT),
    };
  }, [tasks, projects, nowMs]);
}
