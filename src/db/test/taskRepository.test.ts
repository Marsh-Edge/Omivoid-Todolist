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
});
