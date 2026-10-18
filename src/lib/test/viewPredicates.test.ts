import { describe, it, expect } from "vitest";
import { isToday, isOverdue, isUpcoming, visibleInFlatList } from "../viewPredicates";
import { startOfDay, addDays, subDays, endOfDay } from "date-fns";
import type { SmartView, Task } from "@/types";

function makeTask(parentId = ""): Task {
  return {
    id: "t1",
    title: "Task",
    notes: "",
    status: "todo",
    priority: "none",
    projectId: "",
    parentId,
    tagIds: [],
    dueAt: 0,
    recurrence: "",
    remindBeforeMin: 0,
    completedAt: 0,
    deletedAt: 0,
    order: 0,
    createdAt: 0,
    updatedAt: 0,
  };
}

describe("viewPredicates", () => {
  const now = new Date("2026-10-16T12:00:00.000Z");
  const nowMs = now.getTime();

  it("isToday checks start/end of day", () => {
    expect(isToday(startOfDay(now).getTime(), nowMs)).toBe(true);
    expect(isToday(endOfDay(now).getTime(), nowMs)).toBe(true);
    expect(isToday(subDays(now, 1).getTime(), nowMs)).toBe(false);
    expect(isToday(addDays(now, 1).getTime(), nowMs)).toBe(false);
  });

  it("isOverdue only if not today and before now", () => {
    expect(isOverdue(subDays(now, 1).getTime(), nowMs)).toBe(true);
    expect(isOverdue(startOfDay(now).getTime(), nowMs)).toBe(false);
    expect(isOverdue(addDays(now, 1).getTime(), nowMs)).toBe(false);
  });

  it("isUpcoming is in future and not today", () => {
    expect(isUpcoming(addDays(now, 1).getTime(), nowMs)).toBe(true);
    expect(isUpcoming(addDays(now, 5).getTime(), nowMs)).toBe(true);
    expect(isUpcoming(startOfDay(now).getTime(), nowMs)).toBe(false);
    expect(isUpcoming(subDays(now, 1).getTime(), nowMs)).toBe(false);
  });

  describe("visibleInFlatList", () => {
    const views: SmartView[] = ["inbox", "today", "upcoming", "overdue", "important", "trash"];

    it("keeps top-level tasks in every view", () => {
      for (const view of views) {
        expect(visibleInFlatList(makeTask(), view)).toBe(true);
      }
      expect(visibleInFlatList(makeTask(), "completed")).toBe(true);
    });

    it("hides subtasks everywhere except the Completed view", () => {
      for (const view of views) {
        expect(visibleInFlatList(makeTask("p1"), view)).toBe(false);
      }
      expect(visibleInFlatList(makeTask("p1"), "completed")).toBe(true);
    });
  });
});
