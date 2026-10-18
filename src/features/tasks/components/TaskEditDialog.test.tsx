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
    await waitFor(() => expect(onOpenChange).toHaveBeenCalledWith(false));
  });

  it("rejects an empty title and shows an alert", async () => {
    render(<TaskEditDialog target={null} open onOpenChange={vi.fn()} />);
    await flushDialogReset();
    fireEvent.click(screen.getByRole("button", { name: t("addTaskButton") }));
    expect(await screen.findByRole("alert")).toBeTruthy();
    expect(await listActiveTasks()).toHaveLength(0);
  });

  it("saves a reminder lead time once a due date is set", async () => {
    render(<TaskEditDialog target={null} open onOpenChange={vi.fn()} />);
    await flushDialogReset();
    fireEvent.change(screen.getByLabelText(t("taskTitleLabel")), {
      target: { value: "Remind me" },
    });
    fireEvent.change(screen.getByLabelText(t("dueLabel")), {
      target: { value: "2026-10-20T09:00" },
    });
    fireEvent.change(screen.getByLabelText(t("remindLabel")), { target: { value: "30" } });
    fireEvent.click(screen.getByRole("button", { name: t("addTaskButton") }));
    await waitFor(async () => {
      const tasks = await listActiveTasks();
      const created = tasks.find((task) => task.title === "Remind me");
      expect(created?.dueAt).toBeGreaterThan(0);
      expect(created?.remindBeforeMin).toBe(30);
    });
  });

  it("shows the stored lead time and clears it when the due date is removed", async () => {
    const existing = await createTask({
      title: "Existing",
      dueAt: Date.now() + 3_600_000,
      remindBeforeMin: 120,
    });
    render(<TaskEditDialog target={{ task: existing }} open onOpenChange={vi.fn()} />);
    await flushDialogReset();
    const remind = (await screen.findByLabelText(t("remindLabel"))) as HTMLSelectElement;
    await waitFor(() => expect(remind.value).toBe("120"));
    fireEvent.change(screen.getByLabelText(t("dueLabel")), { target: { value: "" } });
    fireEvent.click(screen.getByRole("button", { name: t("save") }));
    await waitFor(async () => {
      const row = await getTask(existing.id);
      expect(row?.dueAt).toBe(0);
      expect(row?.remindBeforeMin).toBe(0);
    });
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

  it("saves a recurrence interval chosen in the dialog", async () => {
    const onOpenChange = vi.fn();
    render(<TaskEditDialog target={null} open onOpenChange={onOpenChange} />);
    await flushDialogReset();
    fireEvent.change(screen.getByLabelText(t("taskTitleLabel")), {
      target: { value: "Repeat task" },
    });
    fireEvent.change(screen.getByLabelText(t("recurrenceLabel")), { target: { value: "weekly" } });
    fireEvent.change(screen.getByLabelText(t("repeatEvery")), { target: { value: "3" } });
    fireEvent.click(screen.getByRole("button", { name: t("addTaskButton") }));
    await waitFor(async () => {
      const tasks = await listActiveTasks();
      expect(tasks.find((task) => task.title === "Repeat task")?.recurrence).toBe("weekly:3");
    });
  });

  it("round-trips an existing interval rule through the dialog", async () => {
    const existing = await createTask({ title: "Biweekly", recurrence: "monthly:5" });
    const onOpenChange = vi.fn();
    render(<TaskEditDialog target={{ task: existing }} open onOpenChange={onOpenChange} />);
    await flushDialogReset();
    const select = screen.getByLabelText(t("recurrenceLabel")) as HTMLSelectElement;
    const intervalInput = screen.getByLabelText(t("repeatEvery")) as HTMLInputElement;
    await waitFor(() => {
      expect(select.value).toBe("monthly");
      expect(intervalInput.value).toBe("5");
    });
    fireEvent.change(intervalInput, { target: { value: "2" } });
    fireEvent.click(screen.getByRole("button", { name: t("save") }));
    await waitFor(async () => {
      expect((await getTask(existing.id))?.recurrence).toBe("monthly:2");
    });
  });
});
