import { getDb } from "./index";
import { projectSchema, tagSchema, taskSchema } from "./schemas";
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

/** Applies every "before" image (removing rows that were created). */
export async function revertChanges(changes: readonly RowChange[]): Promise<void> {
  const db = getDb();
  await db.transaction("rw", db.tasks, db.projects, db.tags, async () => {
    for (const change of changes) {
      if (change.before === null) await removeRow(change.table, change.id);
      else await writeRow(change.table, change.before);
    }
  });
}

/** Applies every "after" image (removing rows that were deleted). */
export async function reapplyChanges(changes: readonly RowChange[]): Promise<void> {
  const db = getDb();
  await db.transaction("rw", db.tasks, db.projects, db.tags, async () => {
    for (const change of changes) {
      if (change.after === null) await removeRow(change.table, change.id);
      else await writeRow(change.table, change.after);
    }
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
    undoLabel: stack.past.length > 0 ? stack.past[stack.past.length - 1].label : null,
    redoLabel: stack.future.length > 0 ? stack.future[0].label : null,
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

/** Undoes the most recent action. Returns false when there is nothing to undo. */
export async function undo(): Promise<boolean> {
  const step = popUndo(stack);
  if (!step) return false;
  await revertChanges(step.entry.changes);
  stack = step.stack;
  refresh();
  return true;
}

/** Redoes the most recently undone action. Returns false when unavailable. */
export async function redo(): Promise<boolean> {
  const step = popRedo(stack);
  if (!step) return false;
  await reapplyChanges(step.entry.changes);
  stack = step.stack;
  refresh();
  return true;
}

/** Drops all history (used after a full-data replace/restore). */
export function clearHistory(): void {
  stack = emptyStack<HistoryEntry>();
  refresh();
}
