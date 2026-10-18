import { describe, it, expect } from "vitest";
import {
  applyTaskSearchAndFilters,
  dateBucket,
  groupTasks,
  matchesFilters,
  matchesSearch,
  type GroupLabelResolver,
} from "../taskFilters";
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

const labels: GroupLabelResolver = {
  project: (id) => (id === "" ? "No project" : `Project ${id}`),
  tag: (id) => (id === "" ? "No tag" : `Tag ${id}`),
  date: {
    overdue: "Overdue",
    today: "Today",
    tomorrow: "Tomorrow",
    thisWeek: "This week",
    later: "Later",
    noDue: "No due date",
  },
};

describe("matchesSearch", () => {
  it("matches title and notes case-insensitively", () => {
    const task = makeTask({ title: "Buy Milk", notes: "from the shop" });
    expect(matchesSearch(task, "milk")).toBe(true);
    expect(matchesSearch(task, "SHOP")).toBe(true);
    expect(matchesSearch(task, "bread")).toBe(false);
  });

  it("treats blank query as match-all", () => {
    expect(matchesSearch(makeTask(), "   ")).toBe(true);
  });
});

describe("matchesFilters", () => {
  it("filters by status, priority and project", () => {
    const task = makeTask({ status: "done", priority: "high", projectId: "p1" });
    expect(matchesFilters(task, { status: ["done"] })).toBe(true);
    expect(matchesFilters(task, { status: ["todo"] })).toBe(false);
    expect(matchesFilters(task, { priority: ["high", "low"] })).toBe(true);
    expect(matchesFilters(task, { projectId: "p1" })).toBe(true);
    expect(matchesFilters(task, { projectId: "p2" })).toBe(false);
  });

  it("matches any selected tag (OR semantics)", () => {
    const task = makeTask({ tagIds: ["a", "b"] });
    expect(matchesFilters(task, { tagIds: ["b"] })).toBe(true);
    expect(matchesFilters(task, { tagIds: ["c"] })).toBe(false);
    expect(matchesFilters(task, { tagIds: [] })).toBe(true);
  });
});

describe("applyTaskSearchAndFilters", () => {
  it("combines search and filters", () => {
    const tasks = [
      makeTask({ id: "a", title: "Call mum", status: "todo" }),
      makeTask({ id: "b", title: "Call plumber", status: "done" }),
    ];
    const result = applyTaskSearchAndFilters(tasks, "call", { status: ["done"] });
    expect(result.map((t) => t.id)).toEqual(["b"]);
  });
});

describe("dateBucket", () => {
  const now = new Date("2026-10-17T12:00:00").getTime();
  const at = (iso: string) => new Date(iso).getTime();

  it("classifies due dates", () => {
    expect(dateBucket(0, now)).toBe("noDue");
    expect(dateBucket(at("2026-10-16T09:00:00"), now)).toBe("overdue");
    expect(dateBucket(at("2026-10-17T18:00:00"), now)).toBe("today");
    expect(dateBucket(at("2026-10-18T09:00:00"), now)).toBe("tomorrow");
    expect(dateBucket(at("2026-10-21T09:00:00"), now)).toBe("thisWeek");
    expect(dateBucket(at("2026-11-01T09:00:00"), now)).toBe("later");
  });
});

describe("groupTasks", () => {
  const now = new Date("2026-10-17T12:00:00").getTime();
  const at = (iso: string) => new Date(iso).getTime();

  it("returns no groups when groupBy is none", () => {
    expect(groupTasks([makeTask()], "none", labels, now)).toEqual([]);
  });

  it("groups by project in first-appearance order", () => {
    const tasks = [
      makeTask({ id: "a", projectId: "p1" }),
      makeTask({ id: "b", projectId: "" }),
      makeTask({ id: "c", projectId: "p1" }),
    ];
    const groups = groupTasks(tasks, "project", labels, now);
    expect(groups.map((g) => g.label)).toEqual(["Project p1", "No project"]);
    expect(groups[0]?.tasks.map((t) => t.id)).toEqual(["a", "c"]);
    expect(groups[1]?.tasks.map((t) => t.id)).toEqual(["b"]);
  });

  it("groups by the first tag", () => {
    const tasks = [
      makeTask({ id: "a", tagIds: ["x", "y"] }),
      makeTask({ id: "b", tagIds: [] }),
      makeTask({ id: "c", tagIds: ["x"] }),
    ];
    const groups = groupTasks(tasks, "tag", labels, now);
    expect(groups.map((g) => g.label)).toEqual(["Tag x", "No tag"]);
    expect(groups[0]?.tasks.map((t) => t.id)).toEqual(["a", "c"]);
  });

  it("groups by date chronologically and skips empty buckets", () => {
    const tasks = [
      makeTask({ id: "a", dueAt: at("2026-10-17T18:00:00") }),
      makeTask({ id: "b", dueAt: 0 }),
      makeTask({ id: "c", dueAt: at("2026-10-16T09:00:00") }),
    ];
    const groups = groupTasks(tasks, "date", labels, now);
    expect(groups.map((g) => g.label)).toEqual(["Overdue", "Today", "No due date"]);
    expect(groups[0]?.tasks.map((t) => t.id)).toEqual(["c"]);
  });
});
