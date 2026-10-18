import { describe, it, expect, vi } from "vitest";
import { tasksToMarkdown } from "./markdownExport";
import type { Project, Tag, Task } from "@/types";

vi.mock("@/lib/i18n", () => ({
  t: (id: string, params?: Record<string, string | number>) => {
    const map: Record<string, string> = {
      priorityHigh: "High",
      priorityMedium: "Medium",
      priorityLow: "Low",
      viewInbox: "Inbox",
      groupNoProject: "No project",
      exportMarkdownTitle: "Omivoid tasks",
      exportMarkdownTitleView: "Omivoid tasks — current view",
      exportMarkdownTitleAll: "Omivoid tasks — all",
      exportMarkdownExported: "Exported {date} · {count} tasks",
      exportMarkdownDue: "due {date}",
      exportMarkdownRepeats: "repeats {rule}",
    };
    let value = map[id] ?? id;
    if (params) {
      for (const [name, replacement] of Object.entries(params)) {
        value = value.replaceAll(`{${name}}`, String(replacement));
      }
    }
    return value;
  },
  recurrenceLabel: (r: string) => (r === "weekly" ? "weekly" : r),
}));

describe("tasksToMarkdown", () => {
  const baseTask: Task = {
    id: "1",
    title: "T1",
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
    createdAt: 1,
    updatedAt: 1,
  };

  it("exports inbox tasks", () => {
    const tasks: Task[] = [{ ...baseTask, id: "t1", title: "Buy milk", priority: "high", dueAt: Date.parse("2026-10-20") }];
    const md = tasksToMarkdown(tasks, [], []);
    expect(md).toContain("# Omivoid tasks");
    expect(md).toContain("## Inbox");
    expect(md).toContain("- [ ] Buy milk");
    expect(md).toContain("High");
    expect(md).toContain("2026-10-20");
  });

  it("exports subtasks nested under parent", () => {
    const tasks: Task[] = [
      { ...baseTask, id: "p", title: "Parent" },
      { ...baseTask, id: "c", title: "Child", parentId: "p" },
    ];
    const md = tasksToMarkdown(tasks, [], []);
    expect(md.indexOf("Parent")).toBeLessThan(md.indexOf("Child"));
    expect(md).toMatch(/Parent[\s\S]*- \[ \] Child/);
  });

  it("groups by project", () => {
    const projects: Project[] = [{ id: "w", name: "Work", icon: "", color: "", parentId: "", order: 0, createdAt: 1, updatedAt: 1 }];
    const tasks: Task[] = [{ ...baseTask, id: "t", title: "Ship", projectId: "w" }];
    const md = tasksToMarkdown(tasks, projects, []);
    expect(md).toContain("## Work");
    expect(md).toContain("- [ ] Ship");
  });

  it("includes notes indented", () => {
    const tasks: Task[] = [{ ...baseTask, id: "t", title: "X", notes: "line1\nline2" }];
    const md = tasksToMarkdown(tasks, [], []);
    expect(md).toMatch(/    line1/);
    expect(md).toMatch(/    line2/);
  });

  it("includes tags and recurrence", () => {
    const tags: Tag[] = [{ id: "tag1", name: "errands", color: "", createdAt: 1 }];
    const tasks: Task[] = [{ ...baseTask, id: "t", title: "Y", tagIds: ["tag1"], recurrence: "weekly" }];
    const md = tasksToMarkdown(tasks, [], tags);
    expect(md).toContain("#errands");
    expect(md).toContain("weekly");
  });
});



