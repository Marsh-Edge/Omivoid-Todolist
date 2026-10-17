import {
  exportBackup,
  importBackup,
  parseBackupText,
  serializeBackup,
  type ImportResult,
} from "@/db/backupRepository";
import { downloadText, timestampSlug } from "./download";

/**
 * UI-facing helpers around the backup repository. Kept free of React so the
 * command palette and any future settings screen can share them.
 */

/** Serializes the DB and triggers a local file download. Returns task count. */
export async function downloadBackup(): Promise<number> {
  const backup = await exportBackup();
  downloadText(
    `omivoid-backup-${timestampSlug(backup.exportedAt)}.json`,
    serializeBackup(backup),
    "application/json",
  );
  return backup.tasks.length;
}

/** Reads a user-selected file and imports it (replacing current data). */
export async function importBackupFile(file: File): Promise<ImportResult> {
  const text = await file.text();
  const parsed = parseBackupText(text);
  return importBackup(parsed);
}
