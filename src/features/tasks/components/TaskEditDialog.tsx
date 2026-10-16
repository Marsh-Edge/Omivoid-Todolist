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
import { t } from "@/lib/i18n";
import type { Task, TaskPriority, TaskStatus } from "@/types";

export interface TaskEditTarget {
  /** undefined = create a new task */
  task?: Task;
  /** parent id when creating a subtask */
  parentId?: string;
}

const priorities: readonly TaskPriority[] = ["none", "low", "medium", "high"];
const statuses: readonly TaskStatus[] = ["todo", "in_progress", "done"];

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
  const [projectId, setProjectId] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!open) return;
    setTimeout(() => {
      if (target?.task) {
        setTitle(target.task.title);
        setPriority(target.task.priority);
        setStatus(target.task.status);
        setDueLocal(toLocalInput(target.task.dueAt));
        setProjectId(target.task.projectId);
        setError(null);
      } else {
        setTitle("");
        setPriority("none");
        setStatus("todo");
        setDueLocal("");
        setProjectId("");
        setError(null);
      }
    }, 0);
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
      if (target?.task) {
        await updateTask(target.task.id, {
          title: trimmed,
          priority,
          status,
          dueAt: Number.isFinite(dueAt) ? dueAt : 0,
          projectId,
        });
      } else {
        await createTask({
          title: trimmed,
          priority,
          status,
          dueAt: Number.isFinite(dueAt) ? dueAt : 0,
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
