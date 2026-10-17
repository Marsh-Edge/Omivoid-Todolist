import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { createTask, listActiveTasks, trashTask, restoreTask, setTaskCompleted } from "../taskRepository";
import { OmivoidDatabase, getDb } from "../index";

describe("taskRepository", () => {
  let db: OmivoidDatabase;

  beforeEach(async () => {
    db = getDb();
    await db.delete();
    await db.open();
  });

  afterEach(async () => {
    if (db.isOpen()) {
      await db.close();
    }
  });

  it("creates and lists active tasks", async () => {
    const t = await createTask({ title: "First task" });
    expect(t.title).toBe("First task");
    expect(t.deletedAt).toBe(0);
    const list = await listActiveTasks();
    expect(list.length).toBe(1);
  });

  it("soft deletes and restores", async () => {
    const t = await createTask({ title: "Trash me" });
    await trashTask(t.id);
    let list = await listActiveTasks();
    expect(list.length).toBe(0);
    await restoreTask(t.id);
    list = await listActiveTasks();
    expect(list.length).toBe(1);
  });

  it("completes tasks", async () => {
    const t = await createTask({ title: "Done" });
    const updated = await setTaskCompleted(t.id, true);
    expect(updated.status).toBe("done");
    expect(updated.completedAt).toBeGreaterThan(0);
  });

  it("stores the recurrence rule on create", async () => {
    const t = await createTask({ title: "Weekly", recurrence: "weekly" });
    expect(t.recurrence).toBe("weekly");
  });

  it("reschedules a recurring task instead of completing it", async () => {
    const past = Date.now() - 5 * 24 * 60 * 60 * 1000;
    const t = await createTask({ title: "Standup", dueAt: past, recurrence: "daily" });
    const updated = await setTaskCompleted(t.id, true);
    expect(updated.status).toBe("todo");
    expect(updated.completedAt).toBe(0);
    expect(updated.dueAt).toBeGreaterThan(Date.now());
  });
});
