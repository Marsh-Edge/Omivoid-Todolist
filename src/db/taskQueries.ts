import Dexie from "dexie";
import { getDb } from "./index";
import { NONE } from "./taskRepository";
import { matchesView } from "@/lib/viewPredicates";
import { applyTaskSearchAndFilters, type TaskFilterCriteria } from "@/lib/taskFilters";
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

/**
 * Tasks matching a smart view (optionally scoped to a project), index-ordered.
 *
 * `search` and `filters` are applied *after* the index query has narrowed the
 * candidate set, so text search never scans the whole table.
 */
export async function queryTasksForView(
  view: SmartView,
  opts: {
    projectId?: string;
    nowMs?: number;
    search?: string;
    filters?: TaskFilterCriteria;
  } = {},
): Promise<Task[]> {
  const db = getDb();
  const nowMs = opts.nowMs ?? Date.now();
  let tasks: Task[];

  if (view === "trash") {
    // `deletedAt > NONE` (a real timestamp). `.above([NONE, Dexie.maxKey])`
    // excludes every non-deleted row without relying on a compound
    // `Dexie.maxKey` lower bound, which fake-indexeddb rejects.
    tasks = await db.tasks
      .where("[deletedAt+order]")
      .above([NONE, Dexie.maxKey])
      .toArray();
  } else if (opts.projectId) {
    // Project scope: active (non-trashed) tasks in that project; done is
    // hidden below, the same way every other view hides it.
    tasks = await db.tasks
      .where("[projectId+deletedAt]")
      .equals([opts.projectId, NONE])
      .toArray();
  } else {
    switch (view) {
      case "inbox":
        tasks = await db.tasks
          .where("[projectId+deletedAt]")
          .equals(["", NONE])
          .toArray();
        break;
      case "completed":
        tasks = await db.tasks
          .where("[status+deletedAt]")
          .equals(["done", NONE])
          .toArray();
        break;
      case "important":
        tasks = await db.tasks
          .where("[priority+deletedAt]")
          .equals(["high", NONE])
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

  const inView = opts.projectId
    ? // A project view lists that project's active tasks (non-done; the index
      // range already excludes trashed rows) regardless of the highlighted
      // smart view — `matchesView` would otherwise demand `projectId === ""`.
      tasks.filter((t) => t.status !== "done")
    : tasks.filter((t) => matchesView(t, view, nowMs));
  return applyTaskSearchAndFilters(inView, opts.search ?? "", opts.filters ?? {});
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
 * Drives the expand chevron from a single index range over `parentId`.
 */
export async function queryParentIdsWithChildren(): Promise<ReadonlySet<string>> {
  // `.above("")` is a plain index-range scan on `parentId` (fast, ~1111 rows at
  // 10k tasks). `.notEqual("")` and a chained Dexie `.filter()` both fall into
  // pathological full-collection paths on large tables (seconds, measured), so
  // the "still active" check is done in JS after the range read.
  const rows = await getDb().tasks.where("parentId").above("").toArray();
  const parents = new Set<string>();
  for (const row of rows) {
    if (row.deletedAt === NONE) parents.add(row.parentId);
  }
  return parents;
}
