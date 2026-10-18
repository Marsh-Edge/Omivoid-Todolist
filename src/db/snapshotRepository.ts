import { getDb } from "./index";
import {
  projectSchema,
  snapshotDataSchema,
  snapshotMetaSchema,
  tagSchema,
} from "./schemas";
import { selectSnapshotIdsToPrune, shouldTakeSnapshot } from "@/lib/snapshots";
import { clearHistory } from "./history";
import { rebuildNoteLinks } from "./noteLinkRepository";
import type { SnapshotData, SnapshotMeta } from "@/types";

/** How many rolling local backups to keep. */
export const MAX_SNAPSHOTS = 5;

/** Minimum gap between automatic backups (~6 hours). */
export const AUTO_SNAPSHOT_INTERVAL_MS = 6 * 60 * 60 * 1000;

function newId(): string {
  return crypto.randomUUID();
}

/** Metadata for every backup, newest first, without loading payloads. */
export async function listSnapshots(): Promise<SnapshotMeta[]> {
  const rows = await getDb().snapshots.orderBy("createdAt").reverse().toArray();
  return rows;
}

async function getSnapshotData(id: string): Promise<SnapshotData | undefined> {
  return getDb().snapshotData.get(id);
}

/**
 * Captures the full current dataset as a new backup, then prunes old ones so at
 * most `MAX_SNAPSHOTS` remain.
 */
export async function createSnapshot(nowMs: number = Date.now()): Promise<SnapshotMeta> {
  const db = getDb();
  const id = newId();

  return db.transaction("rw", db.tasks, db.projects, db.tags, db.snapshots, db.snapshotData, async () => {
    const [tasks, projects, tags] = await Promise.all([
      db.tasks.toArray(),
      db.projects.toArray(),
      db.tags.toArray(),
    ]);

    const meta = snapshotMetaSchema.parse({
      id,
      createdAt: nowMs,
      taskCount: tasks.length,
      projectCount: projects.length,
      tagCount: tags.length,
    } satisfies SnapshotMeta);

    const data = snapshotDataSchema.parse({ id, tasks, projects, tags } satisfies SnapshotData);

    await db.snapshots.add(meta);
    await db.snapshotData.add(data);

    await pruneSnapshots(MAX_SNAPSHOTS);
    return meta;
  });
}

/** Deletes the oldest backups so only the `keep` newest remain. */
export async function pruneSnapshots(keep: number): Promise<void> {
  const db = getDb();
  const metas = await db.snapshots.toArray();
  const ids = selectSnapshotIdsToPrune(metas, keep);
  if (ids.length === 0) return;
  await db.snapshots.bulkDelete(ids);
  await db.snapshotData.bulkDelete(ids);
}

/** Takes a backup only if none exists or the newest is older than the interval. */
export async function maybeCreateSnapshot(
  nowMs: number = Date.now(),
  minIntervalMs: number = AUTO_SNAPSHOT_INTERVAL_MS,
): Promise<SnapshotMeta | null> {
  const db = getDb();
  const [taskCount, projectCount, tagCount] = await Promise.all([
    db.tasks.count(),
    db.projects.count(),
    db.tags.count(),
  ]);
  if (taskCount + projectCount + tagCount === 0) return null;

  const metas = await listSnapshots();
  if (!shouldTakeSnapshot(metas, nowMs, minIntervalMs)) return null;
  return createSnapshot(nowMs);
}

/**
 * Replaces the entire dataset with a backup's contents. Destructive: history is
 * cleared because earlier undo entries reference rows that no longer exist.
 */
export async function restoreSnapshot(id: string): Promise<void> {
  const db = getDb();
  const data = await getSnapshotData(id);
  if (!data) {
    throw new Error(`Snapshot not found: ${id}`);
  }

  await db.transaction("rw", db.tasks, db.projects, db.tags, db.noteLinks, async () => {
    await Promise.all([
      db.tasks.clear(),
      db.projects.clear(),
      db.tags.clear(),
      db.noteLinks.clear(),
    ]);
    await db.tasks.bulkPut(data.tasks);
    await db.projects.bulkPut(data.projects.map((project) => projectSchema.parse(project)));
    await db.tags.bulkPut(data.tags.map((tag) => tagSchema.parse(tag)));
  });
  await rebuildNoteLinks();
  clearHistory();
}

export async function deleteSnapshot(id: string): Promise<void> {
  const db = getDb();
  await db.transaction("rw", db.snapshots, db.snapshotData, async () => {
    await db.snapshots.delete(id);
    await db.snapshotData.delete(id);
  });
}
