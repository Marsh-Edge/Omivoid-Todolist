import { describe, it, expect } from "vitest";
import {
  taskCreateInputSchema,
  taskSchema,
  projectSchema,
  tagSchema,
} from "../schemas";
import type { Task } from "@/types";

describe("schemas", () => {
  it("accepts a valid task", () => {
    const task: Task = {
      id: "t1",
      title: "Example",
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
      order: 123,
      createdAt: 123,
      updatedAt: 123,
    };
    expect(taskSchema.safeParse(task).success).toBe(true);
  });

  it("rejects empty title", () => {
    expect(taskCreateInputSchema.safeParse({ title: "   " }).success).toBe(false);
  });

  it("trims title on create", () => {
    const res = taskCreateInputSchema.safeParse({ title: "  Do it  " });
    expect(res.success && res.data.title).toBe("Do it");
  });

  it("validates project/tag basics", () => {
    expect(projectSchema.safeParse({ id: "p1", name: "Inbox", icon: "", color: "", parentId: "", order: 0, createdAt: 1, updatedAt: 1 }).success).toBe(true);
    expect(tagSchema.safeParse({ id: "tag1", name: "work", color: "", createdAt: 1 }).success).toBe(true);
  });
});
