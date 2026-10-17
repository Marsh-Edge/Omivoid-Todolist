import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { getDb, type OmivoidDatabase } from "../index";
import { createTask, setTaskCompleted, trashTask } from "../taskRepository";
import { createProject } from "../projectRepository";
import { queryTasksForView } from "../taskQueries";

/**
 * Regression tests for `queryTasksForView`.
 *
 * These guard the compound-index `equals([key, NONE])` lookups: an earlier
 * `between([key, NONE], [key, NONE])` compiled to an *empty* range because
 * Dexie's `between` excludes the upper bound by default, silently breaking the
 * Inbox / Completed / Important / project-scoped views.
 */
describe("queryTasksForView", () => {
  let db: OmivoidDatabase;

  beforeEach(async () => {
    db = getDb();
    await db.delete();
    await db.open();
  });

  afterEach(async () => {
    if (db.isOpen()) await db.close();
  });

  it("inbox returns active tasks with no project (including done-excluded)", async () => {
    await createTask({ title: "Inbox A" });
    await createTask({ title: "Inbox B" });
    const done = await createTask({ title: "Inbox done" });
    await setTaskCompleted(done.id, true);
    const project = await createProject({ name: "Work" });
    await createTask({ title: "Project task", projectId: project.id });

    const inbox = await queryTasksForView("inbox");
    expect(inbox.map((t) => t.title).sort()).toEqual(["Inbox A", "Inbox B"]);
  });

  it("completed returns undone-nothing: only done, non-trashed tasks", async () => {
    const a = await createTask({ title: "Done A" });
    const b = await createTask({ title: "Done B" });
    await setTaskCompleted(a.id, true);
    await setTaskCompleted(b.id, true);
    await createTask({ title: "Still todo" });

    const completed = await queryTasksForView("completed");
    expect(completed.map((t) => t.title).sort()).toEqual(["Done A", "Done B"]);
  });

  it("important returns high-priority, non-done, non-trashed tasks", async () => {
    await createTask({ title: "High active", priority: "high" });
    const highDone = await createTask({ title: "High done", priority: "high" });
    await setTaskCompleted(highDone.id, true);
    await createTask({ title: "Low", priority: "low" });

    const important = await queryTasksForView("important");
    expect(important.map((t) => t.title)).toEqual(["High active"]);
  });

  it("project scope returns that project's active (non-done) tasks", async () => {
    const work = await createProject({ name: "Work" });
    const other = await createProject({ name: "Other" });
    await createTask({ title: "W todo", projectId: work.id });
    const wDone = await createTask({ title: "W done", projectId: work.id });
    await setTaskCompleted(wDone.id, true);
    await createTask({ title: "O todo", projectId: other.id });

    const scoped = await queryTasksForView("inbox", { projectId: work.id });
    expect(scoped.map((t) => t.title)).toEqual(["W todo"]);
  });

  it("trash returns trashed tasks only", async () => {
    await createTask({ title: "Keep" });
    const gone = await createTask({ title: "Gone" });
    await trashTask(gone.id);

    const trash = await queryTasksForView("trash");
    expect(trash.map((t) => t.title)).toEqual(["Gone"]);
  });

  it("due-date views bucket strictly by now", async () => {
    const nowMs = new Date("2026-06-15T12:00:00").getTime();
    const day = 86_400_000;
    await createTask({ title: "Today", dueAt: nowMs });
    await createTask({ title: "Overdue", dueAt: nowMs - day });
    await createTask({ title: "Upcoming", dueAt: nowMs + 5 * day });
    await createTask({ title: "No due" });

    expect((await queryTasksForView("today", { nowMs })).map((t) => t.title)).toEqual(["Today"]);
    expect((await queryTasksForView("overdue", { nowMs })).map((t) => t.title)).toEqual(["Overdue"]);
    expect((await queryTasksForView("upcoming", { nowMs })).map((t) => t.title)).toEqual(["Upcoming"]);
  });

  it("applies search after the index query", async () => {
    await createTask({ title: "Draft the report" });
    await createTask({ title: "Call the client" });

    const found = await queryTasksForView("inbox", { search: "report" });
    expect(found.map((t) => t.title)).toEqual(["Draft the report"]);
  });
});
