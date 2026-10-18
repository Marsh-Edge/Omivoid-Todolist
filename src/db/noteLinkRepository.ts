import { getDb } from "./index";
import { noteLinkSchema } from "./schemas";
import { buildNoteLinks, buildTitleIndex } from "@/lib/noteLinks";
import { extractWikiLinks, normalizeTitle } from "@/lib/wikiLinks";
import type { NoteLink, Task } from "@/types";

/**
 * Maintenance and reads for the derived `noteLinks` table.
 *
 * Rows are always re-derived from the owning task's current notes, never
 * hand-edited, so the table cannot drift: `sourceTaskId` rows follow note
 * edits, and unresolved rows (`targetTaskId: ""`) are filled in when a task
 * with that title appears. Resolution uses the `title` index, so no caller
 * ever scans the task table.
 */

/** Title → id for the titles that currently exist (first match wins). */
async function resolveTitles(titles: readonly string[]): Promise<Map<string, string>> {
  const db = getDb();
  const found = new Map<string, string>();
  const seen = new Set<string>();
  for (const title of titles) {
    const key = normalizeTitle(title);
    if (!key || seen.has(key)) continue;
    seen.add(key);
    const match = await db.tasks.where("title").equalsIgnoreCase(key).first();
    if (match) found.set(key, match.id);
  }
  return found;
}

/** Deletes and rebuilds the link rows owned by `taskIds`. */
async function syncSources(taskIds: readonly string[]): Promise<void> {
  const db = getDb();
  await db.noteLinks.where("sourceTaskId").anyOf([...taskIds]).delete();
  const rows = await db.tasks.where("id").anyOf([...taskIds]).toArray();
  const sources = rows.filter((row) => row.notes !== "");
  if (sources.length === 0) return;

  const titles = sources.flatMap((row) => extractWikiLinks(row.notes));
  const index = await resolveTitles(titles);
  const links = buildNoteLinks(sources, index).map((row) => noteLinkSchema.parse(row));
  if (links.length > 0) await db.noteLinks.bulkPut(links);
}

export interface NoteLinkReconciliation {
  /** Tasks whose notes changed — their outgoing rows are rebuilt. */
  syncSourceIds: readonly string[];
  /** Tasks that (re)appeared — unresolved rows with their title are filled. */
  repairTargets: readonly Task[];
  /** Tasks that no longer exist — incoming rows are blanked. */
  clearTargetIds: readonly string[];
}

/**
 * Brings the link table back in sync with the given work. Called by the
 * repository after note edits and by history replay after rows are written
 * directly. Safe to call inside an open Dexie transaction that includes
 * `noteLinks`.
 */
export async function reconcileNoteLinks(work: NoteLinkReconciliation): Promise<void> {
  const db = getDb();
  if (work.syncSourceIds.length > 0) await syncSources(work.syncSourceIds);
  if (work.clearTargetIds.length > 0) {
    await db.noteLinks.where("targetTaskId").anyOf([...work.clearTargetIds]).modify({ targetTaskId: "" });
  }
  for (const target of work.repairTargets) {
    await db.noteLinks
      .where("targetTitle")
      .equalsIgnoreCase(target.title)
      .and((row) => row.targetTaskId === "")
      .modify({ targetTaskId: target.id });
  }
}

/** Incoming links for a task (who links *to* it). */
export async function listNoteLinksTo(targetTaskId: string): Promise<NoteLink[]> {
  return getDb().noteLinks.where("targetTaskId").equals(targetTaskId).toArray();
}

/**
 * Rebuilds the whole table from current tasks. Only for operations that replace
 * every task at once (backup import, snapshot restore), where a scan is already
 * happening.
 */
export async function rebuildNoteLinks(): Promise<void> {
  const db = getDb();
  await db.noteLinks.clear();
  const tasks = await db.tasks.toArray();
  const links = buildNoteLinks(tasks, buildTitleIndex(tasks)).map((row) =>
    noteLinkSchema.parse(row),
  );
  if (links.length > 0) await db.noteLinks.bulkAdd(links);
}
