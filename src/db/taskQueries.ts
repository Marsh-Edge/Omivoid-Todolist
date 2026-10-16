import Dexie from "dexie";
import { getDb } from "./index";
import { NONE } from "./taskRepository";
import { matchesView } from "@/lib/viewPredicates";
import { startOfDay, endOfDay } from "date-fns";
import type { SmartView, Task } from "@/types";

/**
 * Index-backed read queries.
 *
 * Every smart view maps to a Dexie range query on a dedicated index so a
 * view never scans the whole table. `matchesView` is applied afterwards as a
 * cheap correctness guard (the index can't encode "done tasks are hidden in
 * every view except Completed/Trash"), operating on the already-narrowed set.
 *
 * The UI never calls Dexie directly — hooks in `src/features` call these.
 */

/** Tasks matching a smart view (optionally scoped to a project), index-ordered. */
export async function queryTasksForView(
  view: SmartView,
  opts: { projectId?: string; nowMs?: number } = {},
): Promise<Task[]> {
  const db = getDb();
  const nowMs = opts.nowMs ?? Date.now();
  let tasks: Task[];

  if (view === "trash") {
    tasks = await db.tasks
      .where("[deletedAt+order]")
      .between([NONE + 1, Dexie.minKey], [Dexie.maxKey, Dexie.maxKey])
      .toArray();
  } else if (opts.projectId) {
    // Project scope: active (non-trashed) tasks in that project, any status
    // (matchesView below narrows status).
    tasks = await db.tasks
      .where("[projectId+deletedAt]")
      .between([opts.projectId, NONE], [opts.projectId, NONE])
      .toArray();
  } else {
    switch (view) {
      case "inbox":
        tasks = await db.tasks
          .where("[projectId+deletedAt]")
          .between(["", NONE], ["", NONE])
          .toArray();
        break;
      case "completed":
        tasks = await db.tasks
          .where("[status+deletedAt]")
          .between(["done", NONE], ["done", NONE])
          .toArray();
        break;
      case "important":
        tasks = await db.tasks
          .where("[priority+deletedAt]")
          .between(["high", NONE], ["high", NONE])
          .toArray();
        break;
      case "today": {
        const start = startOfDay(new Date(nowMs)).getTime();
        const end = endOfDay(new Date(nowMs)).getTime();
        tasks = await db.tasks.where("dueAt").between(start, end, true, true).toArray();
        break;
      }
      case "upcoming": {
        const end = endOfDay(new Date(nowMs)).getTime();
        tasks = await db.tasks.where("dueAt").above(end).toArray();
        break;
      }
      case "overdue": {
        const start = startOfDay(new Date(nowMs)).getTime();
        tasks = await db.tasks.where("dueAt").between(NONE, start, false, false).toArray();
        break;
      }
    }
  }

  return tasks.filter((t) => matchesView(t, view, nowMs));
}

/** Direct active subtasks of `parentId`, index-ordered (`[parentId+order]`). */
export async function querySubtasks(parentId: string): Promise<Task[]> {
  return getDb()
    .tasks.where("[parentId+order]")
    .between([parentId, Dexie.minKey], [parentId, Dexie.maxKey])
    .filter((t) => t.deletedAt === NONE)
    .toArray();
}

/** Active subtasks of many parents at once, grouped by parentId. */
export async function querySubtasksByParent(
  parentIds: readonly string[],
): Promise<Map<string, Task[]>> {
  const grouped = new Map<string, Task[]>();
  if (parentIds.length === 0) return grouped;
  const rows = await getDb()
    .tasks.where("parentId")
    .anyOf([...parentIds])
    .filter((t) => t.deletedAt === NONE)
    .toArray();
  for (const row of rows) {
    const list = grouped.get(row.parentId);
    if (list) list.push(row);
    else grouped.set(row.parentId, [row]);
  }
  for (const list of grouped.values()) list.sort((a, b) => a.order - b.order);
  return grouped;
}

/**
 * Parent ids that have at least one active (non-trashed) child.
 * Drives the expand chevron without loading full child rows.
 */
export async function queryParentIdsWithChildren(): Promise<ReadonlySet<string>> {
  const rows = await getDb()
    .tasks.where("parentId")
    .notEqual("")
    .filter((t) => t.deletedAt === NONE)
    .toArray();
  return new Set(rows.map((t) => t.parentId));
}
