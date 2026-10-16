"use client";

import { useState, type FormEvent } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { createTask } from "@/db/taskRepository";
import { toUserMessage } from "@/lib/errors";
import { t } from "@/lib/i18n";
import useAppStore from "@/store/appStore";

/** Quick-add: title only; new tasks land in the selected project (or Inbox). */
export function TaskForm() {
  const selectedProjectId = useAppStore((s) => s.selectedProjectId);
  const [title, setTitle] = useState("");
  const [isAdding, setIsAdding] = useState(false);

  async function handleSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const value = title.trim();
    if (!value) return;
    setIsAdding(true);
    try {
      await createTask({ title: value, projectId: selectedProjectId ?? "" });
      setTitle("");
    } catch (err) {
      toUserMessage(err);
    } finally {
      setIsAdding(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="flex items-center gap-2">
      <Input
        value={title}
        onChange={(e) => setTitle(e.target.value)}
        placeholder={t("addTaskPlaceholder")}
        aria-label={t("taskTitleLabel")}
        autoFocus
        className="h-10"
      />
      <Button type="submit" size="lg" disabled={isAdding} className="h-10">
        {t("addTaskButton")}
      </Button>
    </form>
  );
}
