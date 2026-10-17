import { getDb } from "./index";
import { savedFilterSchema } from "./schemas";
import type { SavedFilter, TaskFilterCriteria } from "@/types";

/**
 * Named, reusable filter presets. Deliberately *not* wired into undo/redo:
 * they are lightweight UI state, not task data, and a stray Ctrl+Z should
 * never silently re-add or remove a preset.
 */

function now(): number {
  return Date.now();
}

function newId(): string {
  return crypto.randomUUID();
}

/** Drops empty arrays / empty strings so a preset never stores a no-op clause. */
export function normalizeFilters(filters: TaskFilterCriteria): TaskFilterCriteria {
  const next: TaskFilterCriteria = {};
  if (filters.status && filters.status.length > 0) next.status = [...filters.status];
  if (filters.priority && filters.priority.length > 0) next.priority = [...filters.priority];
  if (filters.projectId) next.projectId = filters.projectId;
  if (filters.tagIds && filters.tagIds.length > 0) next.tagIds = [...filters.tagIds];
  return next;
}

export async function createSavedFilter(input: {
  name: string;
  filters: TaskFilterCriteria;
}): Promise<SavedFilter> {
  const name = input.name.trim();
  if (!name) {
    throw new Error("Filter name is required");
  }
  const view: SavedFilter = savedFilterSchema.parse({
    id: newId(),
    name,
    filters: normalizeFilters(input.filters),
    createdAt: now(),
  } satisfies SavedFilter);
  await getDb().savedFilters.add(view);
  return view;
}

export async function listSavedFilters(): Promise<SavedFilter[]> {
  return getDb().savedFilters.orderBy("createdAt").toArray();
}

export async function getSavedFilter(id: string): Promise<SavedFilter | undefined> {
  return getDb().savedFilters.get(id);
}

export async function renameSavedFilter(id: string, name: string): Promise<SavedFilter> {
  const trimmed = name.trim();
  if (!trimmed) {
    throw new Error("Filter name is required");
  }
  const db = getDb();
  return db.transaction("rw", db.savedFilters, async () => {
    const existing = await db.savedFilters.get(id);
    if (!existing) {
      throw new Error(`Saved filter not found: ${id}`);
    }
    const next = savedFilterSchema.parse({
      ...existing,
      name: trimmed,
      createdAt: existing.createdAt,
    } satisfies SavedFilter);
    await db.savedFilters.put(next);
    return next;
  });
}

export async function deleteSavedFilter(id: string): Promise<void> {
  await getDb().savedFilters.delete(id);
}
