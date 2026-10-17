/**
 * Pure helpers for rolling local backups. Side-effect-free so the pruning rule
 * can be unit tested without IndexedDB.
 */

export interface SnapshotRef {
  id: string;
  createdAt: number;
}

/**
 * Returns the ids of backups to delete so that only the `keep` most recent
 * remain. Newest-first by `createdAt` (ties broken deterministically by id).
 */
export function selectSnapshotIdsToPrune(
  snapshots: readonly SnapshotRef[],
  keep: number,
): string[] {
  if (keep < 0) return [];
  const newestFirst = [...snapshots].sort((a, b) => {
    if (b.createdAt !== a.createdAt) return b.createdAt - a.createdAt;
    return a.id < b.id ? -1 : a.id > b.id ? 1 : 0;
  });
  return newestFirst.slice(keep).map((snapshot) => snapshot.id);
}

/**
 * Whether a new automatic backup should be taken, ie. there is no backup yet or
 * the newest one is older than `minIntervalMs`.
 */
export function shouldTakeSnapshot(
  snapshots: readonly SnapshotRef[],
  nowMs: number,
  minIntervalMs: number,
): boolean {
  if (snapshots.length === 0) return true;
  const newest = snapshots.reduce((a, b) => (b.createdAt > a.createdAt ? b : a));
  return nowMs - newest.createdAt >= minIntervalMs;
}
