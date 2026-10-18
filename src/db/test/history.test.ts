import { describe, it, expect, beforeEach, afterEach } from "vitest";
import {
  clearHistory,
  getHistorySnapshot,
  redo,
  subscribeHistory,
  undo,
} from "../history";
import {
  createTask,
  deleteTaskPermanently,
  getTask,
  trashTask,
  updateTask,
} from "../taskRepository";
import { createProject } from "../projectRepository";
import { createTag } from "../tagRepository";
import { OmivoidDatabase, getDb } from "../index";

describe("history", () => {
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

  it("starts empty", async () => {
    expect(getHistorySnapshot()).toMatchObject({ canUndo: false, canRedo: false });
    expect(getHistorySnapshot().undoLabel).toBeNull();
    expect(await undo()).toBe(false);
    expect(await redo()).toBe(false);
  });

  it("undoes and redoes task creation", async () => {
    const task = await createTask({ title: "First" });
    expect(getHistorySnapshot()).toMatchObject({ canUndo: true, canRedo: false });
    expect(getHistorySnapshot().undoLabel).toBe("undoCreateTask");

    expect(await undo()).toBe(true);
    expect(await getTask(task.id)).toBeUndefined();
    expect(getHistorySnapshot()).toMatchObject({ canUndo: false, canRedo: true });
    expect(getHistorySnapshot().redoLabel).toBe("undoCreateTask");

    expect(await redo()).toBe(true);
    expect((await getTask(task.id))?.title).toBe("First");
    expect(getHistorySnapshot()).toMatchObject({ canUndo: true, canRedo: false });
  });

  it("undoes and redoes task edits", async () => {
    const task = await createTask({ title: "Before" });
    await updateTask(task.id, { title: "After" });
    expect((await getTask(task.id))?.title).toBe("After");

    await undo();
    expect((await getTask(task.id))?.title).toBe("Before");

    await redo();
    expect((await getTask(task.id))?.title).toBe("After");
  });

  it("does not record when recordHistory is false", async () => {
    const task = await createTask({ title: "Notes" });
    clearHistory();
    await updateTask(task.id, { notes: "draft" }, { recordHistory: false });
    expect(getHistorySnapshot()).toMatchObject({ canUndo: false, canRedo: false });
  });

  it("undoes a cascading trash as one step", async () => {
    const parent = await createTask({ title: "Parent" });
    const child = await createTask({ title: "Child", parentId: parent.id });
    clearHistory();

    await trashTask(parent.id);
    expect((await getTask(parent.id))?.deletedAt).toBeGreaterThan(0);
    expect((await getTask(child.id))?.deletedAt).toBeGreaterThan(0);
    expect(getHistorySnapshot().canUndo).toBe(true);

    await undo();
    expect((await getTask(parent.id))?.deletedAt).toBe(0);
    expect((await getTask(child.id))?.deletedAt).toBe(0);

    await redo();
    expect((await getTask(parent.id))?.deletedAt).toBeGreaterThan(0);
    expect((await getTask(child.id))?.deletedAt).toBeGreaterThan(0);
  });

  it("restores permanently deleted tasks on undo", async () => {
    const task = await createTask({ title: "Gone" });
    clearHistory();
    await deleteTaskPermanently(task.id);
    expect(await getTask(task.id)).toBeUndefined();

    await undo();
    expect((await getTask(task.id))?.title).toBe("Gone");
  });

  it("records project and tag mutations", async () => {
    const project = await createProject({ name: "Work" });
    const tag = await createTag({ name: "urgent" });
    expect(getHistorySnapshot().canUndo).toBe(true);

    await undo(); // delete tag
    expect(await db.tags.get(tag.id)).toBeUndefined();
    await undo(); // delete project
    expect(await db.projects.get(project.id)).toBeUndefined();
    expect(getHistorySnapshot().canUndo).toBe(false);

    await redo();
    await redo();
    expect(await db.projects.get(project.id)).toBeDefined();
    expect(await db.tags.get(tag.id)).toBeDefined();
  });

  it("notifies subscribers when the stack changes", async () => {
    let calls = 0;
    const unsubscribe = subscribeHistory(() => {
      calls += 1;
    });
    await createTask({ title: "Ping" });
    expect(calls).toBe(1);
    await undo();
    expect(calls).toBe(2);
    unsubscribe();
    await createTask({ title: "Pong" });
    expect(calls).toBe(2);
  });

  it("drops the redo branch after a new action", async () => {
    await createTask({ title: "A" });
    await undo();
    expect(getHistorySnapshot().canRedo).toBe(true);
    await createTask({ title: "B" });
    expect(getHistorySnapshot().canRedo).toBe(false);
  });

  it("serializes concurrent undos so each pops a distinct entry", async () => {
    const a = await createTask({ title: "A" });
    const b = await createTask({ title: "B" });
    expect(getHistorySnapshot().canUndo).toBe(true);

    const [first, second] = await Promise.all([undo(), undo()]);
    expect(first).toBe(true);
    expect(second).toBe(true);
    expect(await getTask(a.id)).toBeUndefined();
    expect(await getTask(b.id)).toBeUndefined();
    expect(getHistorySnapshot()).toMatchObject({ canUndo: false, canRedo: true });

    await redo();
    await redo();
    expect(await getTask(a.id)).toBeDefined();
    expect(await getTask(b.id)).toBeDefined();
  });

  it("keeps a record that lands while an undo is in flight", async () => {
    const a = await createTask({ title: "A" });
    const inFlight = undo();
    // Starts while revertChanges' await is pending: must not be discarded when
    // the undo assigns its pre-computed stack.
    const b = await createTask({ title: "B" });
    expect(await inFlight).toBe(true);

    expect(await getTask(a.id)).toBeUndefined();
    expect(getHistorySnapshot()).toMatchObject({ canUndo: true, canRedo: false });
    expect(getHistorySnapshot().undoLabel).toBe("undoCreateTask");

    await undo();
    expect(await getTask(b.id)).toBeUndefined();
    expect(getHistorySnapshot()).toMatchObject({ canUndo: false, canRedo: true });
  });

  it("keeps a record that lands while a redo is in flight", async () => {
    const a = await createTask({ title: "A" });
    await undo();
    expect(getHistorySnapshot().canRedo).toBe(true);

    const inFlight = redo();
    const b = await createTask({ title: "B" });
    expect(await inFlight).toBe(true);
    expect((await getTask(a.id))?.title).toBe("A");
    expect((await getTask(b.id))?.title).toBe("B");
    // The interleaved record is not discarded: both entries remain undoable.
    expect(getHistorySnapshot()).toMatchObject({ canUndo: true, canRedo: false });

    await undo();
    await undo();
    expect(await getTask(a.id)).toBeUndefined();
    expect(await getTask(b.id)).toBeUndefined();
    expect(getHistorySnapshot()).toMatchObject({ canUndo: false, canRedo: true });
  });

  it("leaves a cleared stack alone when clearHistory races an undo", async () => {
    await createTask({ title: "A" });
    const inFlight = undo();
    // Let the queued operation start (popUndo runs, revertChanges is awaiting),
    // then clear history mid-flight as an import/restore would.
    await Promise.resolve();
    clearHistory();
    expect(await inFlight).toBe(true);
    expect(getHistorySnapshot()).toMatchObject({ canUndo: false, canRedo: false });
  });
});
