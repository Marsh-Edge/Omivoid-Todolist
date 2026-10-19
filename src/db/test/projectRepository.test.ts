import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { getDb, type OmivoidDatabase } from "../index";
import {
  createProject,
  deleteProject,
  getProject,
  listProjects,
  updateProject,
} from "../projectRepository";
import { createTask, getTask } from "../taskRepository";
import { clearHistory, getHistorySnapshot, undo, redo } from "../history";

describe("projectRepository", () => {
  let db: OmivoidDatabase;

  beforeEach(async () => {
    db = getDb();
    await db.delete();
    await db.open();
  });

  afterEach(async () => {
    if (db.isOpen()) await db.close();
  });

  it("creates a project with sane defaults and trims the name", async () => {
    const p = await createProject({ name: "  Work  " });
    expect(p.name).toBe("Work");
    expect(p.icon).toBe("");
    expect(p.color).toBe("");
    expect(p.parentId).toBe("");
    expect(p.createdAt).toBe(p.updatedAt);
  });

  it("rejects an empty name", async () => {
    await expect(createProject({ name: "   " })).rejects.toThrow(/required/i);
  });

  it("lists projects ordered by their order key", async () => {
    const a = await createProject({ name: "A" });
    const b = await createProject({ name: "B" });
    await updateProject(b.id, { order: a.order - 1 });
    const list = await listProjects();
    expect(list.map((p) => p.name)).toEqual(["B", "A"]);
  });

  it("updates name/icon/color and preserves createdAt", async () => {
    const p = await createProject({ name: "Old" });
    const next = await updateProject(p.id, { name: " New ", icon: "Briefcase", color: "#3b82f6" });
    expect(next.name).toBe("New");
    expect(next.icon).toBe("Briefcase");
    expect(next.color).toBe("#3b82f6");
    expect(next.createdAt).toBe(p.createdAt);
  });

  it("throws when updating a missing project", async () => {
    await expect(updateProject("nope", { name: "x" })).rejects.toThrow(/not found/i);
  });

  it("deletes a project", async () => {
    const p = await createProject({ name: "Gone" });
    await deleteProject(p.id);
    expect(await getProject(p.id)).toBeUndefined();
    expect(await listProjects()).toHaveLength(0);
  });

  it("unassigns the project's tasks and subtasks so they fall back to the Inbox", async () => {
    const p = await createProject({ name: "Work" });
    const parent = await createTask({ title: "Parent", projectId: p.id });
    const subtask = await createTask({ title: "Subtask", parentId: parent.id });
    const other = await createTask({ title: "Elsewhere" });

    await deleteProject(p.id);

    expect((await getTask(parent.id))?.projectId).toBe("");
    expect((await getTask(subtask.id))?.projectId).toBe("");
    expect(await getTask(parent.id)).toBeDefined();
    expect(await getTask(subtask.id)).toBeDefined();
    expect((await getTask(other.id))?.projectId).toBe("");
  });

  it("keeps child projects when their parent is deleted", async () => {
    const parent = await createProject({ name: "Parent" });
    const child = await createProject({ name: "Child", parentId: parent.id });

    await deleteProject(parent.id);

    const remaining = await listProjects();
    expect(remaining.map((p) => p.id)).toEqual([child.id]);
    expect(remaining[0]?.parentId).toBe(parent.id);
  });

  it("restores the project and its task memberships with a single undo", async () => {
    const p = await createProject({ name: "Work" });
    const task = await createTask({ title: "Do it", projectId: p.id });
    clearHistory();

    await deleteProject(p.id);
    expect(await getProject(p.id)).toBeUndefined();
    expect((await getTask(task.id))?.projectId).toBe("");
    expect(getHistorySnapshot().canUndo).toBe(true);

    await undo();
    expect(await getProject(p.id)).toBeDefined();
    expect((await getTask(task.id))?.projectId).toBe(p.id);

    await redo();
    expect(await getProject(p.id)).toBeUndefined();
    expect((await getTask(task.id))?.projectId).toBe("");
  });
});
