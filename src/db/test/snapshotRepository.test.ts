import { describe, it, expect, beforeEach, afterEach } from "vitest";
import {
  MAX_SNAPSHOTS,
  createSnapshot,
  deleteSnapshot,
  listSnapshots,
  maybeCreateSnapshot,
  restoreSnapshot,
} from "../snapshotRepository";
import { createTask, getTask, listActiveTasks, updateTask } from "../taskRepository";
import { OmivoidDatabase, getDb } from "../index";
import { clearHistory } from "../history";

describe("snapshotRepository", () => {
  let db: OmivoidDatabase;

  beforeEach(async () => {
    db = getDb();
    await db.delete();
    await db.open();
    clearHistory();
  });

  afterEach(async () => {
    clearHistory();
    if (db.isOpen()) await db.close();
  });

  it("captures the current dataset and lists it newest first", async () => {
    await createTask({ title: "A" });
    await createTask({ title: "B" });
    await createSnapshot(1000);
    await createSnapshot(2000);

    const metas = await listSnapshots();
    expect(metas.map((m) => m.createdAt)).toEqual([2000, 1000]);
    expect(metas[0].taskCount).toBe(2);
  });

  it("prunes backups beyond the maximum", async () => {
    for (let i = 0; i < MAX_SNAPSHOTS + 3; i += 1) {
      await createSnapshot(1000 + i);
    }
    const metas = await listSnapshots();
    expect(metas).toHaveLength(MAX_SNAPSHOTS);
    expect(metas[0].createdAt).toBe(1000 + MAX_SNAPSHOTS + 2);
  });

  it("restores a backup over the current data", async () => {
    const kept = await createTask({ title: "Kept" });
    const meta = await createSnapshot(5000);

    await updateTask(kept.id, { title: "Changed" });
    await createTask({ title: "Added later" });
    expect(await listActiveTasks()).toHaveLength(2);

    await restoreSnapshot(meta.id);

    const tasks = await listActiveTasks();
    expect(tasks).toHaveLength(1);
    expect(tasks[0].title).toBe("Kept");
  });

  it("only creates automatic backups once the interval elapses", async () => {
    await createTask({ title: "Something" });
    const first = await maybeCreateSnapshot(10_000, 6 * 60 * 60 * 1000);
    expect(first).not.toBeNull();

    const tooSoon = await maybeCreateSnapshot(10_000 + 60_000, 6 * 60 * 60 * 1000);
    expect(tooSoon).toBeNull();

    const later = await maybeCreateSnapshot(10_000 + 6 * 60 * 60 * 1000, 6 * 60 * 60 * 1000);
    expect(later).not.toBeNull();
    expect(await listSnapshots()).toHaveLength(2);
  });

  it("skips an automatic backup when the database is empty", async () => {
    expect(await maybeCreateSnapshot(1000, 0)).toBeNull();
    expect(await listSnapshots()).toEqual([]);
  });

  it("deletes a backup with its payload", async () => {
    const meta = await createSnapshot(1234);
    await deleteSnapshot(meta.id);
    expect(await listSnapshots()).toEqual([]);
    expect(await db.snapshotData.get(meta.id)).toBeUndefined();
  });

  it("reports a missing snapshot id", async () => {
    await createTask({ title: "Untouched" });
    await expect(restoreSnapshot("nope")).rejects.toThrow(/Snapshot not found/);
    expect((await getTask((await listActiveTasks())[0].id))?.title).toBe("Untouched");
  });
});
