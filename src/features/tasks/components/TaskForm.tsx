"use client";

import { useState, type FormEvent } from "react";
import { format } from "date-fns";
import { CalendarDays, Flag, Repeat, Tag as TagIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { createTask } from "@/db/taskRepository";
import { createTag } from "@/db/tagRepository";
import { useTags } from "@/features/tags/useTags";
import { toUserMessage } from "@/lib/errors";
import { parseQuickAdd, type ParsedTask } from "@/lib/naturalLanguage";
import { recurrenceLabel, t, type MessageKey } from "@/lib/i18n";
import useAppStore from "@/store/appStore";
import type { TaskPriority } from "@/types";

const priorityLabelKeys: Record<Exclude<TaskPriority, "none">, MessageKey> = {
  low: "priorityLow",
  medium: "priorityMedium",
  high: "priorityHigh",
};

/**
 * Quick-add with natural-language parsing: the title may include a due date,
 * a priority flag (`!high`) and `#tags`, which are previewed live and applied
 * on submit. New tasks land in the selected project (or Inbox).
 */
export function TaskForm() {
  const selectedProjectId = useAppStore((s) => s.selectedProjectId);
  const tags = useTags();
  const [value, setValue] = useState("");
  const [parsed, setParsed] = useState<ParsedTask | null>(null);
  const [isAdding, setIsAdding] = useState(false);

  function handleChange(next: string) {
    setValue(next);
    setParsed(next.trim() ? parseQuickAdd(next, Date.now()) : null);
  }

  /** Maps parsed tag names to ids, creating any that don't exist yet. */
  async function resolveTagIds(names: readonly string[]): Promise<string[]> {
    const ids: string[] = [];
    for (const name of names) {
      const key = name.toLowerCase();
      const existing = tags?.find((tag) => tag.name.toLowerCase() === key);
      if (existing) {
        ids.push(existing.id);
        continue;
      }
      try {
        const created = await createTag({ name });
        ids.push(created.id);
      } catch {
        // A single bad tag shouldn't block the task from being created.
      }
    }
    return ids;
  }

  async function handleSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!value.trim()) return;
    const preview = parsed ?? parseQuickAdd(value, Date.now());
    setIsAdding(true);
    try {
      const tagIds = await resolveTagIds(preview.tagNames);
      await createTask({
        title: preview.title,
        projectId: selectedProjectId ?? "",
        dueAt: preview.dueAt,
        priority: preview.priority,
        tagIds,
        recurrence: preview.recurrence,
      });
      setValue("");
      setParsed(null);
    } catch (err) {
      toUserMessage(err);
    } finally {
      setIsAdding(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-1.5">
      <div className="flex items-center gap-2">
        <Input
          id="quick-add-input"
          value={value}
          onChange={(e) => handleChange(e.target.value)}
          placeholder={t("addTaskPlaceholder")}
          aria-label={t("taskTitleLabel")}
          title={t("quickAddNlHint")}
          autoFocus
          className="h-10"
        />
        <Button type="submit" size="lg" disabled={isAdding} className="h-10">
          {t("addTaskButton")}
        </Button>
      </div>

      {parsed &&
      (parsed.dueAt > 0 ||
        parsed.priority !== "none" ||
        parsed.tagNames.length > 0 ||
        parsed.recurrence !== "") ? (
        <div
          className="text-muted-foreground flex flex-wrap items-center gap-2 pl-1 text-xs"
          aria-label={t("quickAddDetectedAria")}
        >
          {parsed.dueAt > 0 ? (
            <span className="inline-flex items-center gap-1">
              <CalendarDays className="size-3" aria-hidden="true" />
              {t("quickAddDue", {
                date: format(parsed.dueAt, parsed.hasTime ? "MMM d, h:mm a" : "MMM d"),
              })}
            </span>
          ) : null}
          {parsed.recurrence !== "" ? (
            <span className="inline-flex items-center gap-1">
              <Repeat className="size-3" aria-hidden="true" />
              {t("quickAddRepeats", { rule: recurrenceLabel(parsed.recurrence) })}
            </span>
          ) : null}
          {parsed.priority !== "none" ? (
            <span className="inline-flex items-center gap-1">
              <Flag className="size-3" aria-hidden="true" />
              {t(priorityLabelKeys[parsed.priority])}
            </span>
          ) : null}
          {parsed.tagNames.map((name) => (
            <span key={name} className="inline-flex items-center gap-1">
              <TagIcon className="size-3" aria-hidden="true" />
              {name}
            </span>
          ))}
        </div>
      ) : null}
    </form>
  );
}
