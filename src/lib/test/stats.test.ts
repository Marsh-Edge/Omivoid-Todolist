import { describe, it, expect } from "vitest";
import { addDays, startOfDay, subDays } from "date-fns";
import {
  completionTrend,
  countByPriority,
  countByStatus,
  summarizeTasks,
  topProjects,
} from "../stats";
import type { Project, Task } from "@/types";

const NOW = new Date(2024, 4, 15, 12, 0, 0).getTime(); // 2024-05-15 12:00 local
const DAY = 24 * 60 * 60 * 1000;

let seq = 0;
function task(overrides: Partial<Task> = {}): Task {
  seq += 1;
  return {
    id: `t${seq}`,
    title: `Task ${seq}`,
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
    order: seq,
    createdAt: NOW,
    updatedAt: NOW,
    ...overrides,
  };
}

describe("summarizeTasks", () => {
  it("counts active vs completed and ignores trashed rows", () => {
    const tasks = [
      task({ status: "todo" }),
      task({ status: "in_progress" }),
      task({ status: "done", completedAt: NOW }),
      task({ status: "done", completedAt: NOW, deletedAt: NOW }),
      task({ deletedAt: NOW }),
    ];
    const s = summarizeTasks(tasks, NOW);
    expect(s.active).toBe(2);
    expect(s.completed).toBe(1);
  });

  it("computes completion rate (rounded) and guards division by zero", () => {
    expect(summarizeTasks([], NOW).completionRate).toBe(0);
    const s = summarizeTasks(
      [task({ status: "done", completedAt: NOW }), task({ status: "todo" }), task({ status: "todo" })],
      NOW,
    );
    expect(s.completionRate).toBe(33);
  });

  it("counts overdue (before today) and dueToday separately", () => {
    const tasks = [
      task({ dueAt: NOW - 3 * DAY }), // overdue (yesterday or earlier)
      task({ dueAt: startOfDay(new Date(NOW)).getTime() + 60 * 60 * 1000 }), // today
      task({ dueAt: addDays(new Date(NOW), 2).getTime() }), // future, neither
      task({ status: "done", completedAt: NOW, dueAt: NOW - DAY }), // done: excluded
    ];
    const s = summarizeTasks(tasks, NOW);
    expect(s.overdue).toBe(1);
    expect(s.dueToday).toBe(1);
  });

  it("treats a today-start due time as due today, not overdue", () => {
    const dueAt = startOfDay(new Date(NOW)).getTime();
    const s = summarizeTasks([task({ dueAt })], NOW);
    expect(s.overdue).toBe(0);
    expect(s.dueToday).toBe(1);
  });
});

describe("completionTrend", () => {
  it("buckets completions per day and zero-fills the window", () => {
    const today = startOfDay(new Date(NOW)).getTime();
    const tasks = [
      task({ status: "done", completedAt: today }),
      task({ status: "done", completedAt: today }),
      task({ status: "done", completedAt: subDays(new Date(today), 2).getTime() }),
    ];
    const trend = completionTrend(tasks, NOW, 3);
    expect(trend).toHaveLength(3);
    expect(trend.map((p) => p.dayStart)).toEqual([
      subDays(new Date(today), 2).getTime(),
      subDays(new Date(today), 1).getTime(),
      today,
    ]);
    expect(trend.map((p) => p.count)).toEqual([1, 0, 2]);
  });

  it("ignores completions outside the window and trashed rows", () => {
    const today = startOfDay(new Date(NOW)).getTime();
    const tasks = [
      task({ status: "done", completedAt: subDays(new Date(today), 10).getTime() }),
      task({ status: "done", completedAt: addDays(new Date(today), 1).getTime() }),
      task({ status: "done", completedAt: today, deletedAt: NOW }),
    ];
    const trend = completionTrend(tasks, NOW, 3);
    expect(trend.every((p) => p.count === 0)).toBe(true);
  });

  it("clamps the window to at least one day", () => {
    const trend = completionTrend([task({ status: "done", completedAt: NOW })], NOW, 0);
    expect(trend).toHaveLength(1);
    expect(trend[0].count).toBe(1);
  });
});

describe("countByStatus", () => {
  it("counts non-trashed tasks in a stable order", () => {
    const tasks = [
      task({ status: "todo" }),
      task({ status: "todo" }),
      task({ status: "in_progress" }),
      task({ status: "done", completedAt: NOW }),
      task({ status: "done", completedAt: NOW, deletedAt: NOW }),
    ];
    expect(countByStatus(tasks)).toEqual([
      { status: "todo", count: 2 },
      { status: "in_progress", count: 1 },
      { status: "done", count: 1 },
    ]);
  });
});

describe("countByPriority", () => {
  it("counts non-trashed tasks high → none", () => {
    const tasks = [
      task({ priority: "high" }),
      task({ priority: "medium" }),
      task({ priority: "medium" }),
      task({ priority: "none" }),
      task({ priority: "high", deletedAt: NOW }),
    ];
    expect(countByPriority(tasks)).toEqual([
      { priority: "high", count: 1 },
      { priority: "medium", count: 2 },
      { priority: "low", count: 0 },
      { priority: "none", count: 1 },
    ]);
  });
});

describe("topProjects", () => {
  const projects: Project[] = [
    { id: "p1", name: "Work", icon: "", color: "#f00", parentId: "", order: 1, createdAt: NOW, updatedAt: NOW },
    { id: "p2", name: "Home", icon: "", color: "#0f0", parentId: "", order: 2, createdAt: NOW, updatedAt: NOW },
  ];

  it("counts per project, includes Inbox, and sorts descending", () => {
    const tasks = [
      task({ projectId: "p1" }),
      task({ projectId: "p1" }),
      task({ projectId: "p2" }),
      task({ projectId: "" }),
      task({ projectId: "p1", deletedAt: NOW }),
    ];
    const result = topProjects(tasks, projects, 10);
    expect(result[0]).toEqual({ id: "p1", name: "Work", color: "#f00", count: 2 });
    expect(result.find((p) => p.id === "")?.count).toBe(1);
    expect(result.find((p) => p.id === "p2")?.count).toBe(1);
  });

  it("honors the limit and tolerates orphaned project ids", () => {
    const tasks = [
      task({ projectId: "p1" }),
      task({ projectId: "p1" }),
      task({ projectId: "ghost" }),
    ];
    const result = topProjects(tasks, projects, 1);
    expect(result).toHaveLength(1);
    expect(result[0].id).toBe("p1");

    const full = topProjects(tasks, projects, 10).find((p) => p.id === "ghost");
    expect(full).toMatchObject({ name: "ghost", color: "" });
  });
});
