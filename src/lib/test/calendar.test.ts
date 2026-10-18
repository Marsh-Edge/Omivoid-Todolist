import { describe, it, expect } from "vitest";
import { buildMonthMatrix, countWithoutDue, dayKey, groupTasksByDay } from "../calendar";
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

describe("dayKey", () => {
  it("zero-pads month and day in local time", () => {
    expect(dayKey(new Date(2026, 0, 5, 23, 30).getTime())).toBe("2026-01-05");
    expect(dayKey(new Date(2026, 11, 31, 0, 0).getTime())).toBe("2026-12-31");
  });
});

describe("groupTasksByDay", () => {
  it("groups by due day and skips tasks without a due date", () => {
    const a = makeTask({ id: "a", dueAt: new Date(2026, 4, 3, 9).getTime() });
    const b = makeTask({ id: "b", dueAt: new Date(2026, 4, 3, 18).getTime() });
    const c = makeTask({ id: "c", dueAt: 0 });
    const map = groupTasksByDay([a, b, c]);

    expect(map.size).toBe(1);
    expect(map.get("2026-05-03")?.map((t) => t.id)).toEqual(["a", "b"]);
    expect(map.has("1970-01-01")).toBe(false);
  });
});

describe("countWithoutDue", () => {
  it("counts only tasks with no due date", () => {
    expect(countWithoutDue([makeTask({ dueAt: 0 }), makeTask({ dueAt: 1 }), makeTask()])).toBe(2);
  });
});

describe("buildMonthMatrix", () => {
  it("covers the whole month in full weeks (Sunday start)", () => {
    // Jan 2024: Jan 1 is a Monday; grid runs Sun Dec 31 2023 → Sat Feb 3 2024.
    const weeks = buildMonthMatrix(new Date(2024, 0, 15).getTime(), 0);
    expect(weeks.length).toBe(5);
    expect(weeks.every((w) => w.length === 7)).toBe(true);
    expect(weeks[0]?.[0]).toEqual(new Date(2023, 11, 31));
    expect(weeks[4]?.[6]).toEqual(new Date(2024, 1, 3));
  });

  it("honors Monday start", () => {
    const weeks = buildMonthMatrix(new Date(2024, 0, 15).getTime(), 1);
    expect(weeks.length).toBe(5);
    expect(weeks[0]?.[0]).toEqual(new Date(2024, 0, 1));
    expect(weeks[4]?.[6]).toEqual(new Date(2024, 1, 4));
  });
});
