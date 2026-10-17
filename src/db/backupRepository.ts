import { z } from "zod";
import { getDb } from "./index";
import { projectSchema, savedFilterSchema, tagSchema, taskSchema } from "./schemas";
import { clearHistory } from "./history";
import type { Project, SavedFilter, Tag, Task } from "@/types";

/**
 * Whole-database JSON backup. The only code allowed to touch all tables at
 * once; everything is Zod-validated on the way in and out so a malformed file
 * can never corrupt the store.
 */

export const BACKUP_VERSION = 1 as const;

/** Backups written before recurring tasks existed omit `recurrence`. */
const backupTaskSchema = z.preprocess((value) => {
  if (value !== null && typeof value === "object" && !("recurrence" in value)) {
    return { ...value, recurrence: "" };
  }
  return value;
}, taskSchema);

export const backupSchema = z.object({
  version: z.literal(BACKUP_VERSION),
  exportedAt: z.number().int().nonnegative(),
  tasks: z.array(backupTaskSchema),
  projects: z.array(projectSchema),
  tags: z.array(tagSchema),
  // Added after v1 shipped; older backups omit it, so default to none.
  savedFilters: z.array(savedFilterSchema).default([]),
});

export type BackupFile = z.infer<typeof backupSchema>;

export interface ImportResult {
  tasks: number;
  projects: number;
  tags: number;
  savedFilters: number;
}

export async function exportBackup(nowMs: number = Date.now()): Promise<BackupFile> {
  const db = getDb();
  const [tasks, projects, tags, savedFilters] = await Promise.all([
    db.tasks.toArray(),
    db.projects.toArray(),
    db.tags.toArray(),
    db.savedFilters.toArray(),
  ]);
  return { version: BACKUP_VERSION, exportedAt: nowMs, tasks, projects, tags, savedFilters };
}

export function serializeBackup(backup: BackupFile): string {
  return JSON.stringify(backup, null, 2);
}

/** Parses and validates raw JSON text. Throws on invalid JSON or schema. */
export function parseBackupText(text: string): BackupFile {
  let json: unknown;
  try {
    json = JSON.parse(text);
  } catch {
    throw new Error("Backup file is not valid JSON");
  }
  return backupSchema.parse(json);
}

/**
 * Replaces the entire database with the backup contents in a single
 * transaction (so a failure leaves the existing data untouched).
 */
export async function importBackup(input: unknown): Promise<ImportResult> {
  const backup = backupSchema.parse(input);
  const db = getDb();
  await db.transaction("rw", db.tasks, db.projects, db.tags, db.savedFilters, async () => {
    await Promise.all([
      db.tasks.clear(),
      db.projects.clear(),
      db.tags.clear(),
      db.savedFilters.clear(),
    ]);
    if (backup.tasks.length > 0) await db.tasks.bulkPut(backup.tasks);
    if (backup.projects.length > 0) await db.projects.bulkPut(backup.projects);
    if (backup.tags.length > 0) await db.tags.bulkPut(backup.tags);
    if (backup.savedFilters.length > 0) await db.savedFilters.bulkPut(backup.savedFilters);
  });
  // Import replaced every row; prior undo entries reference stale data.
  clearHistory();
  return {
    tasks: backup.tasks.length,
    projects: backup.projects.length,
    tags: backup.tags.length,
    savedFilters: backup.savedFilters.length,
  };
}

/** Convenience type-only re-exports for callers building fixtures. */
export type { Project, SavedFilter, Tag, Task };
