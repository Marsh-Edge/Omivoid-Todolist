"use client";

import { useEffect, useState, type FormEvent } from "react";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { createTask, updateTask } from "@/db/taskRepository";
import { useProjects } from "@/features/projects/useProjects";
import { toUserMessage } from "@/lib/errors";
import { recurrenceUnit, t, type MessageKey } from "@/lib/i18n";
import { formatRecurrence, parseRecurrence } from "@/lib/recurrence";
import type { RecurrenceFreq, Task, TaskPriority, TaskStatus } from "@/types";

export interface TaskEditTarget {
  /** undefined = create a new task */
  task?: Task;
  /** parent id when creating a subtask */
  parentId?: string;
}

const priorities: readonly TaskPriority[] = ["none", "low", "medium", "high"];
const statuses: readonly TaskStatus[] = ["todo", "in_progress", "done"];

const recurrenceFreqs: readonly RecurrenceFreq[] = ["daily", "weekly", "monthly", "yearly"];

const recurrenceFreqLabelKeys: Record<RecurrenceFreq, MessageKey> = {
  daily: "recurrenceFreqDaily",
  weekly: "recurrenceFreqWeekly",
  monthly: "recurrenceFreqMonthly",
  yearly: "recurrenceFreqYearly",
};

const MAX_RECURRENCE_INTERVAL = 9999;

function clampInterval(value: number): number {
  return Math.min(Math.max(value, 1), MAX_RECURRENCE_INTERVAL);
}

/** Parses the interval field; invalid or empty input falls back to 1. */
function parseIntervalText(text: string): number {
  const n = Number(text);
  return Number.isInteger(n) && n >= 1 ? clampInterval(n) : 1;
}

/** Reminder lead-time presets, in minutes before the due time. */
const remindPresets = [0, 10, 30, 60, 120, 1440] as const;

function remindOptionLabel(minutes: number): string {
  if (minutes <= 0) return t("remindAtDue");
  if (minutes % 1440 === 0) {
    return minutes === 1440 ? t("remindDayBefore") : t("remindDaysBefore", { count: minutes / 1440 });
  }
  if (minutes >= 60 && minutes % 60 === 0) {
    return minutes === 60 ? t("remindHourBefore") : t("remindHoursBefore", { count: minutes / 60 });
  }
  return t("remindMinutesBefore", { count: minutes });
}

function toLocalInput(ms: number): string {
  if (ms <= 0) return "";
  const d = new Date(ms);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

export function TaskEditDialog({
  target,
  open,
  onOpenChange,
}: {
  target: TaskEditTarget | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const projects = useProjects();
  const [title, setTitle] = useState("");
  const [priority, setPriority] = useState<TaskPriority>("none");
  const [status, setStatus] = useState<TaskStatus>("todo");
  const [dueLocal, setDueLocal] = useState("");
  const [freq, setFreq] = useState<RecurrenceFreq | "">("");
  const [intervalText, setIntervalText] = useState("1");
  const [projectId, setProjectId] = useState("");
  const [remindBeforeMin, setRemindBeforeMin] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!open) return;
    const timer = window.setTimeout(() => {
      if (target?.task) {
        setTitle(target.task.title);
        setPriority(target.task.priority);
        setStatus(target.task.status);
        setDueLocal(toLocalInput(target.task.dueAt));
        const rule = parseRecurrence(target.task.recurrence);
        setFreq(rule?.freq ?? "");
        setIntervalText(String(rule?.interval ?? 1));
        setProjectId(target.task.projectId);
        setRemindBeforeMin(target.task.remindBeforeMin);
        setError(null);
      } else {
        setTitle("");
        setPriority("none");
        setStatus("todo");
        setDueLocal("");
        setFreq("");
        setIntervalText("1");
        setProjectId("");
        setRemindBeforeMin(0);
        setError(null);
      }
    }, 0);
    return () => window.clearTimeout(timer);
  }, [open, target]);

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    const trimmed = title.trim();
    if (!trimmed) {
      setError(t("titleRequired"));
      return;
    }
    setSaving(true);
    setError(null);
    try {
      const dueAt = dueLocal ? new Date(dueLocal).getTime() : 0;
      const recurrence = freq ? formatRecurrence({ freq, interval: parseIntervalText(intervalText) }) : "";
      const dueValue = Number.isFinite(dueAt) ? dueAt : 0;
      const remind = dueValue > 0 ? remindBeforeMin : 0;
      if (target?.task) {
        await updateTask(target.task.id, {
          title: trimmed,
          priority,
          status,
          dueAt: dueValue,
          recurrence,
          remindBeforeMin: remind,
          projectId,
        });
      } else {
        await createTask({
          title: trimmed,
          priority,
          status,
          dueAt: dueValue,
          recurrence,
          remindBeforeMin: remind,
          projectId,
          parentId: target?.parentId ?? "",
        });
      }
      onOpenChange(false);
    } catch (caught) {
      setError(toUserMessage(caught));
    } finally {
      setSaving(false);
    }
  }

  const isSubtask = Boolean(target?.parentId);
  const interval = parseIntervalText(intervalText);

  // Keep a non-preset lead time (e.g. from a backup) selectable.
  const remindOptions: number[] = (remindPresets as readonly number[]).includes(remindBeforeMin)
    ? [...remindPresets]
    : [...remindPresets, remindBeforeMin].sort((a, b) => a - b);

  function handleIntervalChange(value: string): void {
    setIntervalText(value);
  }

  function handleIntervalBlur(): void {
    setIntervalText(String(parseIntervalText(intervalText)));
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>
            {target?.task
              ? t("editTask", { title: target.task.title })
              : isSubtask
                ? t("addSubtask")
                : t("addTaskButton")}
          </DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="flex flex-col gap-3">
          <div className="flex flex-col gap-1.5">
            <label htmlFor="task-title" className="text-xs font-medium">
              {t("taskTitleLabel")}
            </label>
            <Input
              id="task-title"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder={t("addTaskPlaceholder")}
              aria-label={t("taskTitleLabel")}
              aria-invalid={error !== null}
              autoFocus
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="flex flex-col gap-1.5">
              <label htmlFor="task-status" className="text-xs font-medium">
                {t("statusLabel")}
              </label>
              <select
                id="task-status"
                value={status}
                onChange={(e) => setStatus(e.target.value as TaskStatus)}
                className="h-8 w-full rounded-lg border border-input bg-transparent px-2 text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50"
              >
                {statuses.map((s) => (
                  <option key={s} value={s}>
                    {t(s === "todo" ? "statusTodo" : s === "in_progress" ? "statusInProgress" : "statusDone")}
                  </option>
                ))}
              </select>
            </div>

            <div className="flex flex-col gap-1.5">
              <label htmlFor="task-priority" className="text-xs font-medium">
                {t("priorityLabel")}
              </label>
              <select
                id="task-priority"
                value={priority}
                onChange={(e) => setPriority(e.target.value as TaskPriority)}
                className="h-8 w-full rounded-lg border border-input bg-transparent px-2 text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50"
              >
                {priorities.map((p) => (
                  <option key={p} value={p}>
                    {t(
                      p === "none"
                        ? "priorityNone"
                        : p === "low"
                          ? "priorityLow"
                          : p === "medium"
                            ? "priorityMedium"
                            : "priorityHigh",
                    )}
                  </option>
                ))}
              </select>
            </div>

            <div className="flex flex-col gap-1.5">
              <label htmlFor="task-due" className="text-xs font-medium">
                {t("dueLabel")}
              </label>
              <Input
                id="task-due"
                type="datetime-local"
                value={dueLocal}
                onChange={(e) => setDueLocal(e.target.value)}
                className="text-sm"
              />
            </div>

            <div className="flex flex-col gap-1.5">
              <label htmlFor="task-recurrence" className="text-xs font-medium">
                {t("recurrenceLabel")}
              </label>
              <select
                id="task-recurrence"
                value={freq}
                onChange={(e) => setFreq(e.target.value as RecurrenceFreq | "")}
                className="h-8 w-full rounded-lg border border-input bg-transparent px-2 text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50"
              >
                <option value="">{t("recurrenceNone")}</option>
                {recurrenceFreqs.map((value) => (
                  <option key={value} value={value}>
                    {t(recurrenceFreqLabelKeys[value])}
                  </option>
                ))}
              </select>
              {freq !== "" ? (
                <div className="flex items-center gap-1.5">
                  <label htmlFor="task-recurrence-interval" className="text-xs font-medium">
                    {t("repeatEvery")}
                  </label>
                  <Input
                    id="task-recurrence-interval"
                    type="number"
                    min={1}
                    max={MAX_RECURRENCE_INTERVAL}
                    value={intervalText}
                    onChange={(e) => handleIntervalChange(e.target.value)}
                    onBlur={handleIntervalBlur}
                    className="h-7 w-16 text-sm"
                  />
                  <span className="text-muted-foreground text-xs">
                    {recurrenceUnit(freq, interval)}
                  </span>
                </div>
              ) : null}
            </div>

            {!isSubtask ? (
              <div className="flex flex-col gap-1.5">
                <label htmlFor="task-project" className="text-xs font-medium">
                  {t("projectLabel")}
                </label>
                <select
                  id="task-project"
                  value={projectId}
                  onChange={(e) => setProjectId(e.target.value)}
                  className="h-8 w-full rounded-lg border border-input bg-transparent px-2 text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50"
                >
                  <option value="">{t("projectInbox")}</option>
                  {projects?.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.name}
                    </option>
                  ))}
                </select>
              </div>
            ) : null}

            {dueLocal !== "" ? (
              <div className="flex flex-col gap-1.5">
                <label htmlFor="task-remind" className="text-xs font-medium">
                  {t("remindLabel")}
                </label>
                <select
                  id="task-remind"
                  value={remindBeforeMin}
                  onChange={(e) => setRemindBeforeMin(Number(e.target.value))}
                  className="h-8 w-full rounded-lg border border-input bg-transparent px-2 text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50"
                >
                  {remindOptions.map((value) => (
                    <option key={value} value={value}>
                      {remindOptionLabel(value)}
                    </option>
                  ))}
                </select>
              </div>
            ) : null}
          </div>

          {error ? (
            <p role="alert" className="text-destructive text-sm">
              {error}
            </p>
          ) : null}

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              {t("cancel")}
            </Button>
            <Button type="submit" disabled={saving}>
              {target?.task ? t("save") : t("addTaskButton")}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
