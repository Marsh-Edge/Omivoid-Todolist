import { z } from "zod";
import { getDb } from "./index";
import { projectSchema, tagSchema, taskSchema } from "./schemas";
import { clearHistory } from "./history";
import type { Project, Tag, Task } from "@/types";

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
});

export type BackupFile = z.infer<typeof backupSchema>;

export interface ImportResult {
  tasks: number;
  projects: number;
  tags: number;
}

export async function exportBackup(nowMs: number = Date.now()): Promise<BackupFile> {
  const db = getDb();
  const [tasks, projects, tags] = await Promise.all([
    db.tasks.toArray(),
    db.projects.toArray(),
    db.tags.toArray(),
  ]);
  return { version: BACKUP_VERSION, exportedAt: nowMs, tasks, projects, tags };
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
  await db.transaction("rw", db.tasks, db.projects, db.tags, async () => {
    await Promise.all([db.tasks.clear(), db.projects.clear(), db.tags.clear()]);
    if (backup.tasks.length > 0) await db.tasks.bulkPut(backup.tasks);
    if (backup.projects.length > 0) await db.projects.bulkPut(backup.projects);
    if (backup.tags.length > 0) await db.tags.bulkPut(backup.tags);
  });
  // Import replaced every row; prior undo entries reference stale data.
  clearHistory();
  return {
    tasks: backup.tasks.length,
    projects: backup.projects.length,
    tags: backup.tags.length,
  };
}

/** Convenience type-only re-exports for callers building fixtures. */
export type { Project, Tag, Task };
