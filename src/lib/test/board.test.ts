import { describe, it, expect } from "vitest";
import { BOARD_COLUMNS, groupTasksByStatus } from "../board";
import type { Task } from "@/types";

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

describe("BOARD_COLUMNS", () => {
  it("is todo, in_progress, done", () => {
    expect(BOARD_COLUMNS).toEqual(["todo", "in_progress", "done"]);
  });
});

describe("groupTasksByStatus", () => {
  it("always returns the three columns in order, even when empty", () => {
    const groups = groupTasksByStatus([]);
    expect(groups.map((g) => g.status)).toEqual(["todo", "in_progress", "done"]);
    expect(groups.every((g) => g.tasks.length === 0)).toBe(true);
  });

  it("buckets tasks by status preserving input order", () => {
    const tasks = [
      makeTask({ id: "a", status: "todo" }),
      makeTask({ id: "b", status: "done" }),
      makeTask({ id: "c", status: "todo" }),
      makeTask({ id: "d", status: "in_progress" }),
    ];
    const groups = groupTasksByStatus(tasks);
    expect(groups[0]?.tasks.map((t) => t.id)).toEqual(["a", "c"]);
    expect(groups[1]?.tasks.map((t) => t.id)).toEqual(["d"]);
    expect(groups[2]?.tasks.map((t) => t.id)).toEqual(["b"]);
  });
});
