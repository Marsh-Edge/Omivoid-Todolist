import {
  exportBackup,
  importBackup,
  parseBackupText,
  serializeBackup,
  type ImportResult,
} from "@/db/backupRepository";

/**
 * UI-facing helpers around the backup repository. Kept free of React so the
 * command palette and any future settings screen can share them.
 */

function timestampSlug(ms: number): string {
  return new Date(ms).toISOString().slice(0, 19).replace(/[:T]/g, "-");
}

/** Serializes the DB and triggers a local file download. Returns task count. */
export async function downloadBackup(): Promise<number> {
  const backup = await exportBackup();
  const blob = new Blob([serializeBackup(backup)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  try {
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = `omivoid-backup-${timestampSlug(backup.exportedAt)}.json`;
    document.body.appendChild(anchor);
    anchor.click();
    anchor.remove();
  } finally {
    URL.revokeObjectURL(url);
  }
  return backup.tasks.length;
}

/** Reads a user-selected file and imports it (replacing current data). */
export async function importBackupFile(file: File): Promise<ImportResult> {
  const text = await file.text();
  const parsed = parseBackupText(text);
  return importBackup(parsed);
}
