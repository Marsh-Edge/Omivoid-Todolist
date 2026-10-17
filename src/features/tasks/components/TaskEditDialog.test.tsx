import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { act, render, screen, fireEvent, waitFor } from "@testing-library/react";
import { getDb, type OmivoidDatabase } from "@/db/index";
import { createTask, getTask, listActiveTasks } from "@/db/taskRepository";
import { t } from "@/lib/i18n";
import { TaskEditDialog } from "./TaskEditDialog";

async function flushDialogReset() {
  await act(async () => {
    await new Promise((resolve) => setTimeout(resolve, 0));
  });
}

describe("TaskEditDialog", () => {
  let db: OmivoidDatabase;

  beforeEach(async () => {
    db = getDb();
    await db.delete();
    await db.open();
  });

  afterEach(async () => {
    if (db.isOpen()) await db.close();
  });

  it("creates a task with the entered title", async () => {
    const onOpenChange = vi.fn();
    render(<TaskEditDialog target={null} open onOpenChange={onOpenChange} />);
    await flushDialogReset();
    fireEvent.change(screen.getByLabelText(t("taskTitleLabel")), {
      target: { value: "New task" },
    });
    fireEvent.click(screen.getByRole("button", { name: t("addTaskButton") }));
    await waitFor(async () => {
      const tasks = await listActiveTasks();
      expect(tasks.map((task) => task.title)).toContain("New task");
    });
    expect(onOpenChange).toHaveBeenCalledWith(false);
  });

  it("rejects an empty title and shows an alert", async () => {
    render(<TaskEditDialog target={null} open onOpenChange={vi.fn()} />);
    await flushDialogReset();
    fireEvent.click(screen.getByRole("button", { name: t("addTaskButton") }));
    expect(await screen.findByRole("alert")).toBeTruthy();
    expect(await listActiveTasks()).toHaveLength(0);
  });

  it("renames an existing task", async () => {
    const existing = await createTask({ title: "Old title" });
    const onOpenChange = vi.fn();
    render(<TaskEditDialog target={{ task: existing }} open onOpenChange={onOpenChange} />);
    await flushDialogReset();
    const input = screen.getByLabelText(t("taskTitleLabel")) as HTMLInputElement;
    await waitFor(() => expect(input.value).toBe("Old title"));
    fireEvent.change(input, { target: { value: "New title" } });
    fireEvent.click(screen.getByRole("button", { name: t("save") }));
    await waitFor(async () => {
      expect((await getTask(existing.id))?.title).toBe("New title");
    });
  });
});
