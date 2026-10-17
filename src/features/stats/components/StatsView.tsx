"use client";

import { useMemo } from "react";
import { format } from "date-fns";
import { Inbox } from "lucide-react";
import { t, type MessageKey } from "@/lib/i18n";
import { useStats, TREND_DAYS } from "@/features/stats/useStats";
import { StatCard } from "./StatCard";
import { BarChart, type Bar } from "./BarChart";
import { BarList, type BarListRow } from "./BarList";
import type { TaskPriority, TaskStatus } from "@/types";

const statusLabelKeys: Record<TaskStatus, MessageKey> = {
  todo: "statusTodo",
  in_progress: "statusInProgress",
  done: "statusDone",
};

const priorityLabelKeys: Record<TaskPriority, MessageKey> = {
  high: "priorityHigh",
  medium: "priorityMedium",
  low: "priorityLow",
  none: "priorityNone",
};

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="bg-card border-border flex flex-col gap-3 rounded-lg border p-4">
      <h2 className="text-sm font-semibold">{title}</h2>
      {children}
    </section>
  );
}

/**
 * Global statistics dashboard over all non-trashed tasks. Loaded only on the
 * `/stats` route, so its code stays out of the initial bundle.
 */
export default function StatsView() {
  const stats = useStats();

  const trendBars = useMemo<Bar[]>(() => {
    if (!stats) return [];
    return stats.trend.map((point) => ({
      key: String(point.dayStart),
      value: point.count,
      label: format(new Date(point.dayStart), "MMM d"),
      title: `${format(new Date(point.dayStart), "MMM d")}: ${point.count}`,
    }));
  }, [stats]);

  const statusRows = useMemo<BarListRow[]>(
    () =>
      (stats?.statuses ?? []).map((item) => ({
        key: item.status,
        label: t(statusLabelKeys[item.status]),
        value: item.count,
        color: item.status === "done" ? "var(--muted-foreground)" : "var(--primary)",
      })),
    [stats],
  );

  const priorityRows = useMemo<BarListRow[]>(
    () =>
      (stats?.priorities ?? []).map((item) => ({
        key: item.priority,
        label: t(priorityLabelKeys[item.priority]),
        value: item.count,
      })),
    [stats],
  );

  const projectRows = useMemo<BarListRow[]>(
    () =>
      (stats?.projects ?? []).map((item) => ({
        key: item.id || "inbox",
        label: item.id === "" ? t("viewInbox") : item.name,
        value: item.count,
        color: item.color || undefined,
      })),
    [stats],
  );

  if (!stats) {
    return <div className="text-muted-foreground text-sm">{t("loadingTasks")}</div>;
  }

  const { summary } = stats;
  const hasAnyTask = summary.active + summary.completed > 0;

  return (
    <div className="mx-auto flex h-full w-full max-w-5xl flex-col gap-4 overflow-y-auto pb-4">
      <div className="flex items-center gap-2">
        <Inbox className="text-muted-foreground size-4" aria-hidden="true" />
        <h1 className="text-lg font-semibold">{t("statsTitle")}</h1>
      </div>

      {!hasAnyTask ? (
        <p className="text-muted-foreground py-8 text-center text-sm">{t("statsEmpty")}</p>
      ) : (
        <>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
            <StatCard labelKey="statsActive" value={summary.active} />
            <StatCard labelKey="statsCompleted" value={summary.completed} />
            <StatCard labelKey="statsOverdue" value={summary.overdue} tone="warning" />
            <StatCard labelKey="statsDueToday" value={summary.dueToday} />
            <StatCard
              labelKey="statsCompletionRate"
              value={summary.completionRate}
              suffix="%"
            />
          </div>

          <Section title={t("statsTrendTitle", { days: TREND_DAYS })}>
            <BarChart
              bars={trendBars}
              ariaLabel={t("statsTrendAria")}
              emptyLabel={t("statsNoData")}
            />
          </Section>

          <div className="grid gap-4 md:grid-cols-2">
            <Section title={t("statsStatusTitle")}>
              <BarList
                rows={statusRows}
                ariaLabel={t("statsStatusTitle")}
                emptyLabel={t("statsNoData")}
              />
            </Section>
            <Section title={t("statsPriorityTitle")}>
              <BarList
                rows={priorityRows}
                ariaLabel={t("statsPriorityTitle")}
                emptyLabel={t("statsNoData")}
              />
            </Section>
          </div>

          <Section title={t("statsProjectsTitle")}>
            <BarList
              rows={projectRows}
              ariaLabel={t("statsProjectsTitle")}
              emptyLabel={t("statsNoData")}
            />
          </Section>
        </>
      )}
    </div>
  );
}
