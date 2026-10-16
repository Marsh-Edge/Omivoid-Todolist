import Dexie from "dexie";
import { getDb } from "./index";
import {
  taskCreateInputSchema,
  taskSchema,
  taskUpdateInputSchema,
  type TaskCreateInput,
  type TaskUpdateInput,
} from "./schemas";
import type { Task } from "@/types";

/** Sentinel for "no value" on indexed timestamp/reference fields. */
export const NONE = 0;

function now(): number {
  return Date.now();
}

function newId(): string {
  return crypto.randomUUID();
}

export async function createTask(input: TaskCreateInput): Promise<Task> {
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
    completedAt: NONE,
    deletedAt: NONE,
    order: timestamp,
    createdAt: timestamp,
    updatedAt: timestamp,
  } satisfies Task);

  await getDb().tasks.add(task);
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

export async function countActiveTasks(): Promise<number> {
  return getDb()
    .tasks.where("[deletedAt+order]")
    .between([NONE, Dexie.minKey], [NONE, Dexie.maxKey])
    .count();
}

export async function updateTask(
  id: string,
  patch: TaskUpdateInput,
): Promise<Task> {
  const parsed = taskUpdateInputSchema.parse(patch);
  const db = getDb();

  return db.transaction("rw", db.tasks, async () => {
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
    return next;
  });
}

export async function setTaskCompleted(
  id: string,
  completed: boolean,
): Promise<Task> {
  return updateTask(id, {
    status: completed ? "done" : "todo",
    completedAt: completed ? now() : NONE,
  });
}

/** Trash: soft-delete, restorable. Cascades to all descendants. */
export async function trashTask(id: string): Promise<Task> {
  const db = getDb();
  return db.transaction("rw", db.tasks, async () => {
    const ts = now();
    const ids = [id, ...(await collectDescendantIds(id, true))];
    await db.tasks
      .where("id")
      .anyOf(ids)
      .modify({ deletedAt: ts, updatedAt: ts });
    const task = await db.tasks.get(id);
    if (!task) {
      throw new Error(`Task not found: ${id}`);
    }
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
    for (const descendantId of ids) {
      const row = await db.tasks.get(descendantId);
      if (row && (row.deletedAt === ts || row.id === id)) {
        await db.tasks.put(taskSchema.parse({ ...row, deletedAt: NONE, updatedAt: now() } satisfies Task));
      }
    }
    return (await db.tasks.get(id)) as Task;
  });
}

/** Permanent removal (used from the trash view). Cascades to descendants. */
export async function deleteTaskPermanently(id: string): Promise<void> {
  const db = getDb();
  await db.transaction("rw", db.tasks, async () => {
    const ids = [id, ...(await collectDescendantIds(id))];
    await db.tasks.where("id").anyOf(ids).delete();
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

    let order: number;
    if (before && after) {
      order = (before.order + after.order) / 2;
      // Orders collided (adjacent floats) — renumber the whole sibling group.
      if (!Number.isFinite(order) || order === before.order || order === after.order) {
        const group = [...siblings];
        group.splice(insertAt, 0, task);
        for (let i = 0; i < group.length; i++) {
          await db.tasks.put(
            taskSchema.parse({ ...group[i], order: (i + 1) * 1000, updatedAt: now() } satisfies Task),
          );
        }
        return;
      }
    } else if (before) {
      order = before.order + 1;
    } else if (after) {
      order = after.order - 1;
    } else {
      order = now();
    }
    await db.tasks.put(taskSchema.parse({ ...task, order, updatedAt: now() } satisfies Task));
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

/** Persists a manual reorder (drag & drop) in one transaction. */
export async function reorderTasks(
  updates: ReadonlyArray<{ id: string; order: number }>,
): Promise<void> {
  if (updates.length === 0) return;
  const db = getDb();
  await db.transaction("rw", db.tasks, async () => {
    for (const { id, order } of updates) {
      const existing = await db.tasks.get(id);
      if (!existing) continue;
      await db.tasks.put(taskSchema.parse({ ...existing, order, updatedAt: now() } satisfies Task));
    }
  });
}
