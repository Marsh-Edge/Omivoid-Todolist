import { describe, it, expect } from "vitest";
import { DUE_NOTIFY_WINDOW_MS, selectDueNotifications } from "../dueNotifications";
import type { Task } from "@/types";

const HOUR = 60 * 60 * 1000;
const NOW = new Date(2026, 9, 17, 10, 0, 0).getTime();

function makeTask(overrides: Partial<Task> = {}): Task {
  return {
    id: overrides.id ?? "t1",
    title: "Task",
    notes: "",
    status: "todo",
    priority: "none",
    projectId: "",
    parentId: "",
    tagIds: [],
    dueAt: 0,
    recurrence: "",
    remindBeforeMin: 0,
    completedAt: 0,
    deletedAt: 0,
    order: 0,
    createdAt: 0,
    updatedAt: 0,
    ...overrides,
  };
}

describe("selectDueNotifications", () => {
  it("notifies a task that just became due", () => {
    const task = makeTask({ id: "a", dueAt: NOW - HOUR });
    const { notify, notified } = selectDueNotifications([task], NOW, {});
    expect(notify.map((t) => t.id)).toEqual(["a"]);
    expect(notified).toEqual({ a: task.dueAt });
  });

  it("does not notify a task that is not due yet", () => {
    const task = makeTask({ id: "a", dueAt: NOW + HOUR });
    const result = selectDueNotifications([task], NOW, {});
    expect(result.notify).toEqual([]);
    expect(result.notified).toEqual({});
  });

  it("does not repeat a notification for the same due time", () => {
    const task = makeTask({ id: "a", dueAt: NOW - HOUR });
    const result = selectDueNotifications([task], NOW, { a: task.dueAt });
    expect(result.notify).toEqual([]);
    expect(result.notified).toEqual({ a: task.dueAt });
  });

  it("notifies again when a recurring task advances to a new due time", () => {
    const advanced = makeTask({ id: "a", dueAt: NOW - HOUR });
    // Stored memory is from the *previous* occurrence (e.g. a week earlier).
    const result = selectDueNotifications([advanced], NOW, { a: NOW - 8 * 24 * HOUR });
    expect(result.notify.map((t) => t.id)).toEqual(["a"]);
  });

  it("ignores tasks overdue beyond the window", () => {
    const task = makeTask({ id: "a", dueAt: NOW - DUE_NOTIFY_WINDOW_MS - HOUR });
    expect(selectDueNotifications([task], NOW, {}).notify).toEqual([]);
  });

  it("skips done, trashed and undated tasks", () => {
    const tasks = [
      makeTask({ id: "done", status: "done", dueAt: NOW - HOUR }),
      makeTask({ id: "trashed", deletedAt: NOW - HOUR, dueAt: NOW - HOUR }),
      makeTask({ id: "undated", dueAt: 0 }),
    ];
    const result = selectDueNotifications(tasks, NOW, {});
    expect(result.notify).toEqual([]);
    expect(result.notified).toEqual({});
  });

  it("drops memory for tasks that leave the window (completed/rescheduled)", () => {
    const result = selectDueNotifications([], NOW, { gone: NOW - HOUR });
    expect(result.notified).toEqual({});
  });

  it("honors a custom window", () => {
    const task = makeTask({ id: "a", dueAt: NOW - 2 * HOUR });
    expect(selectDueNotifications([task], NOW, {}, HOUR).notify).toEqual([]);
    expect(selectDueNotifications([task], NOW, {}, 3 * HOUR).notify.map((t) => t.id)).toEqual(["a"]);
  });

  it("fires a lead-time reminder before the task is due", () => {
    const task = makeTask({ id: "a", dueAt: NOW + HOUR, remindBeforeMin: 60 });
    expect(selectDueNotifications([task], NOW, {}).notify.map((t) => t.id)).toEqual(["a"]);
    // Still keyed on the due time, so it never repeats.
    expect(selectDueNotifications([task], NOW, { a: task.dueAt }).notify).toEqual([]);
  });

  it("waits for a lead time that has not elapsed yet", () => {
    const task = makeTask({ id: "a", dueAt: NOW + 3 * HOUR, remindBeforeMin: 60 });
    expect(selectDueNotifications([task], NOW, {}).notify).toEqual([]);
  });

  it("does not fire a lead time that was missed beyond the window", () => {
    const task = makeTask({ id: "a", dueAt: NOW + HOUR, remindBeforeMin: 5 * 24 * 60 });
    expect(selectDueNotifications([task], NOW, {}).notify).toEqual([]);
  });
});
