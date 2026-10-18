import Dexie from "dexie";
import { getDb } from "./index";
import {
  taskCreateInputSchema,
  taskSchema,
  taskUpdateInputSchema,
  type TaskCreateInput,
  type TaskUpdateInput,
} from "./schemas";
import { recordHistory, taskRow, type RowChange } from "./history";
import { reconcileNoteLinks } from "./noteLinkRepository";
import { nextDueDate, parseRecurrence } from "@/lib/recurrence";
import type { Task, TaskStatus } from "@/types";

/** Sentinel for "no value" on indexed timestamp/reference fields. */
export const NONE = 0;

/** Options accepted by mutating repository calls. */
export interface MutationOptions {
  /**
   * Set to false to skip the undo/redo history entry (e.g. debounced note
   * autosave, which would otherwise flood the stack).
   */
  recordHistory?: boolean;
}

function recordRows(label: string, changes: RowChange[], options?: MutationOptions): void {
  if (options?.recordHistory === false) return;
  recordHistory({ label, changes });
}

function now(): number {
  return Date.now();
}

function newId(): string {
  return crypto.randomUUID();
}

export async function createTask(
  input: TaskCreateInput,
  options?: MutationOptions,
): Promise<Task> {
  const parsed = taskCreateInputSchema.parse(input);
  const timestamp = now();

  // A subtask always lives in its parent's project (and inherits nothing else).
  let projectId = parsed.projectId ?? "";
  if (parsed.parentId) {
    const parent = await getDb().tasks.get(parsed.parentId);
    if (!parent) {
      throw new Error(`Parent task not found: ${parsed.parentId}`);
    }
    projectId = parent.projectId;
  }

  const task = taskSchema.parse({
    id: newId(),
    title: parsed.title,
    notes: parsed.notes ?? "",
    status: parsed.status ?? "todo",
    priority: parsed.priority ?? "none",
    projectId,
    parentId: parsed.parentId ?? "",
    tagIds: parsed.tagIds ?? [],
    dueAt: parsed.dueAt ?? NONE,
    recurrence: parsed.recurrence ?? "",
    remindBeforeMin: parsed.remindBeforeMin ?? NONE,
    completedAt: NONE,
    deletedAt: NONE,
    order: timestamp,
    createdAt: timestamp,
    updatedAt: timestamp,
  } satisfies Task);

  await getDb().tasks.add(task);
  // A new title may satisfy links other notes already point at.
  await reconcileNoteLinks({ syncSourceIds: [], repairTargets: [task], clearTargetIds: [] });
  recordRows("undoCreateTask", [taskRow(null, task)], options);
  return task;
}

export async function getTask(id: string): Promise<Task | undefined> {
  return getDb().tasks.get(id);
}

/** Active (non-deleted) tasks, index-ordered by `order`. */
export async function listActiveTasks(): Promise<Task[]> {
  return getDb()
    .tasks.where("[deletedAt+order]")
    .between([NONE, Dexie.minKey], [NONE, Dexie.maxKey])
    .toArray();
}


export async function updateTask(
  id: string,
  patch: TaskUpdateInput,
  options?: MutationOptions,
): Promise<Task> {
  const parsed = taskUpdateInputSchema.parse(patch);
  const db = getDb();

  return db.transaction("rw", db.tasks, db.noteLinks, async () => {
    const existing = await db.tasks.get(id);
    if (!existing) {
      throw new Error(`Task not found: ${id}`);
    }

    const next = taskSchema.parse({
      ...existing,
      ...parsed,
      id: existing.id,
      createdAt: existing.createdAt,
      updatedAt: now(),
    } satisfies Task);

    await db.tasks.put(next);

    // Keep the derived link table in step: notes rebuild this task's outgoing
    // links, a new title can satisfy links other notes already point at.
    const notesChanged = next.notes !== existing.notes;
    const titleChanged = next.title !== existing.title;
    if (notesChanged || titleChanged) {
      await reconcileNoteLinks({
        syncSourceIds: notesChanged ? [next.id] : [],
        repairTargets: titleChanged ? [next] : [],
        clearTargetIds: [],
      });
    }

    recordRows("undoEditTask", [taskRow(existing, next)], options);
    return next;
  });
}

/**
 * Changes a task's status in one transaction.
 *
 * Completing a *recurring* task does not mark it done: its due date advances
 * to the next occurrence and it stays active, so it reappears on schedule.
 * Every other transition just stamps `completedAt` (or clears it).
 */
export async function setTaskStatus(id: string, status: TaskStatus): Promise<Task> {
  const db = getDb();
  return db.transaction("rw", db.tasks, async () => {
    const existing = await db.tasks.get(id);
    if (!existing) {
      throw new Error(`Task not found: ${id}`);
    }

    const rule = parseRecurrence(existing.recurrence);
    if (status === "done" && rule) {
      const next = taskSchema.parse({
        ...existing,
        dueAt: nextDueDate(existing.dueAt, rule, now()),
        status: "todo",
        completedAt: NONE,
        updatedAt: now(),
      } satisfies Task);
      await db.tasks.put(next);
      recordRows("undoEditTask", [taskRow(existing, next)]);
      return next;
    }

    const next = taskSchema.parse({
      ...existing,
      status,
      completedAt: status === "done" ? now() : NONE,
      updatedAt: now(),
    } satisfies Task);
    await db.tasks.put(next);
    recordRows("undoEditTask", [taskRow(existing, next)]);
    return next;
  });
}

export async function setTaskCompleted(
  id: string,
  completed: boolean,
): Promise<Task> {
  return setTaskStatus(id, completed ? "done" : "todo");
}

/** Trash: soft-delete, restorable. Cascades to all descendants. */
export async function trashTask(id: string): Promise<Task> {
  const db = getDb();
  return db.transaction("rw", db.tasks, async () => {
    const ts = now();
    const ids = [id, ...(await collectDescendantIds(id, true))];
    const before = await db.tasks.where("id").anyOf(ids).toArray();
    await db.tasks
      .where("id")
      .anyOf(ids)
      .modify({ deletedAt: ts, updatedAt: ts });
    const task = await db.tasks.get(id);
    if (!task) {
      throw new Error(`Task not found: ${id}`);
    }
    recordRows(
      "undoTrashTask",
      before.map((row) => taskRow(row, { ...row, deletedAt: ts, updatedAt: ts })),
    );
    return task;
  });
}

/**
 * Restore a trashed task. Descendants trashed in the *same* batch (same
 * `deletedAt`) are restored too; descendants trashed earlier stay in trash.
 */
export async function restoreTask(id: string): Promise<Task> {
  const db = getDb();
  return db.transaction("rw", db.tasks, async () => {
    const task = await db.tasks.get(id);
    if (!task) {
      throw new Error(`Task not found: ${id}`);
    }
    const ts = task.deletedAt;
    const ids = [id, ...(await collectDescendantIds(id))];
    const changes: RowChange[] = [];
    for (const descendantId of ids) {
      const row = await db.tasks.get(descendantId);
      if (row && (row.deletedAt === ts || row.id === id)) {
        const restored = taskSchema.parse({ ...row, deletedAt: NONE, updatedAt: now() } satisfies Task);
        await db.tasks.put(restored);
        changes.push(taskRow(row, restored));
      }
    }
    recordRows("undoRestoreTask", changes);
    return (await db.tasks.get(id)) as Task;
  });
}

/** Permanent removal (used from the trash view). Cascades to descendants. */
export async function deleteTaskPermanently(id: string): Promise<void> {
  const db = getDb();
  await db.transaction("rw", db.tasks, db.noteLinks, async () => {
    const ids = [id, ...(await collectDescendantIds(id))];
    const rows = await db.tasks.where("id").anyOf(ids).toArray();
    await db.tasks.where("id").anyOf(ids).delete();
    // Drop the links these tasks owned and blank links pointing at them.
    await reconcileNoteLinks({ syncSourceIds: ids, repairTargets: [], clearTargetIds: ids });
    recordRows("undoDeleteTask", rows.map((row) => taskRow(row, null)));
  });
}

/** Moves a task before/after a sibling (same parentId). Persists new orders. */
export async function moveTask(
  id: string,
  position: { beforeId?: string; afterId?: string },
): Promise<void> {
  const db = getDb();
  await db.transaction("rw", db.tasks, async () => {
    const task = await db.tasks.get(id);
    if (!task) {
      throw new Error(`Task not found: ${id}`);
    }
    const siblings = await db.tasks
      .where("[parentId+order]")
      .between([task.parentId, Dexie.minKey], [task.parentId, Dexie.maxKey])
      .filter((t) => t.deletedAt === NONE && t.id !== id)
      .toArray();

    let insertAt = siblings.length;
    if (position.beforeId) {
      const idx = siblings.findIndex((s) => s.id === position.beforeId);
      if (idx >= 0) insertAt = idx;
    } else if (position.afterId) {
      const idx = siblings.findIndex((s) => s.id === position.afterId);
      if (idx >= 0) insertAt = idx + 1;
    }

    const before = insertAt > 0 ? siblings[insertAt - 1] : undefined;
    const after = insertAt < siblings.length ? siblings[insertAt] : undefined;

    const changes: RowChange[] = [];
    const ts = now();

    let order: number;
    if (before && after) {
      order = (before.order + after.order) / 2;
      // Orders collided (adjacent floats) — renumber the whole sibling group.
      if (!Number.isFinite(order) || order === before.order || order === after.order) {
        const group = [...siblings];
        group.splice(insertAt, 0, task);
        for (const [i, current] of group.entries()) {
          const updated = taskSchema.parse({ ...current, order: (i + 1) * 1000, updatedAt: ts } satisfies Task);
          await db.tasks.put(updated);
          changes.push(taskRow(current, updated));
        }
        recordRows("undoMoveTask", changes);
        return;
      }
    } else if (before) {
      order = before.order + 1;
    } else if (after) {
      order = after.order - 1;
    } else {
      order = now();
    }
    const moved = taskSchema.parse({ ...task, order, updatedAt: ts } satisfies Task);
    await db.tasks.put(moved);
    recordRows("undoMoveTask", [taskRow(task, moved)]);
  });
}

/** Collects ids of all descendants; `activeOnly` skips already-trashed rows. */
async function collectDescendantIds(rootId: string, activeOnly = false): Promise<string[]> {
  const db = getDb();
  const out: string[] = [];
  let frontier = [rootId];
  while (frontier.length > 0) {
    let children = await db.tasks.where("parentId").anyOf(frontier).toArray();
    if (activeOnly) {
      children = children.filter((t) => t.deletedAt === NONE);
    }
    frontier = children.map((c) => c.id);
    out.push(...frontier);
  }
  return out;
}
