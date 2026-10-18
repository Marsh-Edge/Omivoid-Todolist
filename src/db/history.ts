import { getDb } from "./index";
import { projectSchema, tagSchema, taskSchema } from "./schemas";
import { reconcileNoteLinks } from "./noteLinkRepository";
import {
  pushEntry,
  popRedo,
  popUndo,
  emptyStack,
  type HistoryStack,
} from "@/lib/undoStack";
import type { Project, Tag, Task } from "@/types";

/**
 * App-wide undo/redo history.
 *
 * Every mutating repository call records a `RowChange` per affected row (its
 * before/after snapshot). Undo writes the "before" images back, redo writes the
 * "after" images. Because we store snapshots rather than inverse operations,
 * cascade operations (trash, permanent delete, reorder) are undone correctly
 * without special cases.
 *
 * This module is the only place that applies history to IndexedDB, keeping the
 * "repository layer owns Dexie" rule intact. React subscribes through
 * `useSyncExternalStore` (see `src/features/history/useHistory.ts`).
 */

export type HistoryTable = "tasks" | "projects" | "tags";

export interface RowChange {
  table: HistoryTable;
  id: string;
  /** Row image before the operation, or null if the row was created. */
  before: Task | Project | Tag | null;
  /** Row image after the operation, or null if the row was deleted. */
  after: Task | Project | Tag | null;
}

export interface HistoryEntry {
  /** i18n message key describing the action, for button tooltips. */
  label: string;
  changes: RowChange[];
}

export function taskRow(before: Task | null, after: Task | null): RowChange {
  return { table: "tasks", id: (before ?? after)!.id, before, after };
}

export function projectRow(before: Project | null, after: Project | null): RowChange {
  return { table: "projects", id: (before ?? after)!.id, before, after };
}

export function tagRow(before: Tag | null, after: Tag | null): RowChange {
  return { table: "tags", id: (before ?? after)!.id, before, after };
}

async function writeRow(
  table: HistoryTable,
  image: Task | Project | Tag,
): Promise<void> {
  const db = getDb();
  switch (table) {
    case "tasks":
      await db.tasks.put(taskSchema.parse(image));
      break;
    case "projects":
      await db.projects.put(projectSchema.parse(image));
      break;
    case "tags":
      await db.tags.put(tagSchema.parse(image));
      break;
  }
}

async function removeRow(table: HistoryTable, id: string): Promise<void> {
  const db = getDb();
  switch (table) {
    case "tasks":
      await db.tasks.delete(id);
      break;
    case "projects":
      await db.projects.delete(id);
      break;
    case "tags":
      await db.tags.delete(id);
      break;
  }
}

/**
 * Keeps the derived `noteLinks` table in step after task rows were written
 * directly: rows owned by a re-created or note-edited task are rebuilt, and
 * incoming rows are repaired or blanked as the target appears/disappears.
 */
async function reconcileLinksAfterReplay(
  changes: readonly RowChange[],
  side: "before" | "after",
): Promise<void> {
  const taskChanges = changes.filter((change) => change.table === "tasks");
  if (taskChanges.length === 0) return;

  const syncSourceIds: string[] = [];
  const repairTargets: Task[] = [];
  const clearTargetIds: string[] = [];
  for (const change of taskChanges) {
    const image = (side === "before" ? change.before : change.after) as Task | null;
    const other = (side === "before" ? change.after : change.before) as Task | null;
    if (image === null) {
      clearTargetIds.push(change.id);
      continue;
    }
    if (other === null || image.notes !== other.notes) syncSourceIds.push(image.id);
    if (other === null || image.title !== other.title) repairTargets.push(image);
  }
  await reconcileNoteLinks({ syncSourceIds, repairTargets, clearTargetIds });
}

/** Applies every "before" image (removing rows that were created). */
export async function revertChanges(changes: readonly RowChange[]): Promise<void> {
  const db = getDb();
  await db.transaction("rw", db.tasks, db.projects, db.tags, db.noteLinks, async () => {
    for (const change of changes) {
      if (change.before === null) await removeRow(change.table, change.id);
      else await writeRow(change.table, change.before);
    }
    await reconcileLinksAfterReplay(changes, "before");
  });
}

/** Applies every "after" image (removing rows that were deleted). */
export async function reapplyChanges(changes: readonly RowChange[]): Promise<void> {
  const db = getDb();
  await db.transaction("rw", db.tasks, db.projects, db.tags, db.noteLinks, async () => {
    for (const change of changes) {
      if (change.after === null) await removeRow(change.table, change.id);
      else await writeRow(change.table, change.after);
    }
    await reconcileLinksAfterReplay(changes, "after");
  });
}

export interface HistoryState {
  canUndo: boolean;
  canRedo: boolean;
  /** Message key of the action the next undo would revert, or null. */
  undoLabel: string | null;
  /** Message key of the action the next redo would reapply, or null. */
  redoLabel: string | null;
}

let stack: HistoryStack<HistoryEntry> = emptyStack<HistoryEntry>();
let snapshot: HistoryState = {
  canUndo: false,
  canRedo: false,
  undoLabel: null,
  redoLabel: null,
};
const listeners = new Set<() => void>();

function refresh(): void {
  snapshot = {
    canUndo: stack.past.length > 0,
    canRedo: stack.future.length > 0,
    undoLabel: stack.past[stack.past.length - 1]?.label ?? null,
    redoLabel: stack.future[0]?.label ?? null,
  };
  for (const listener of listeners) listener();
}

export function subscribeHistory(listener: () => void): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

export function getHistorySnapshot(): HistoryState {
  return snapshot;
}

/** Records one undoable action. No-op when it didn't change anything. */
export function recordHistory(entry: HistoryEntry): void {
  if (entry.changes.length === 0) return;
  stack = pushEntry(stack, entry);
  refresh();
}

/**
 * Serializes undo/redo so concurrent calls (e.g. two fast Ctrl+Z presses)
 * never read the same stack, and so the awaited DB write can't be clobbered.
 */
let operationQueue: Promise<void> = Promise.resolve();

async function runOperation<T>(fn: () => Promise<T>): Promise<T> {
  const result = operationQueue.then(() => fn());
  operationQueue = result.then(
    () => undefined,
    () => undefined,
  );
  return result;
}

/**
 * Bumped by `clearHistory` so an in-flight undo/redo that raced a full-data
 * replace (import/restore) notices it and leaves the fresh stack alone.
 */
let generation = 0;

/** Undoes the most recent action. Returns false when there is nothing to undo. */
export async function undo(): Promise<boolean> {
  return runOperation(async () => {
    const before = stack;
    const gen = generation;
    const step = popUndo(before);
    if (!step) return false;
    await revertChanges(step.entry.changes);
    if (generation === gen) {
      // A recordHistory landing during the await kept `entry` in `past` (and
      // cleared the redo branch); rebase instead of discarding it.
      stack =
        stack === before
          ? step.stack
          : { past: stack.past.filter((e) => e !== step.entry), future: [] };
      refresh();
    }
    return true;
  });
}

/** Redoes the most recently undone action. Returns false when unavailable. */
export async function redo(): Promise<boolean> {
  return runOperation(async () => {
    const before = stack;
    const gen = generation;
    const step = popRedo(before);
    if (!step) return false;
    await reapplyChanges(step.entry.changes);
    if (generation === gen) {
      // If a recordHistory landed during the await it cleared the redo branch,
      // dropping `entry`; re-insert it (the write already happened) so the
      // redone action stays undoable.
      stack =
        stack === before
          ? step.stack
          : { past: [...stack.past, step.entry], future: [] };
      refresh();
    }
    return true;
  });
}

/** Drops all history (used after a full-data replace/restore). */
export function clearHistory(): void {
  generation += 1;
  stack = emptyStack<HistoryEntry>();
  refresh();
}
