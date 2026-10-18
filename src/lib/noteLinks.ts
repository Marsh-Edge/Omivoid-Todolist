import { extractWikiLinks, normalizeTitle } from "@/lib/wikiLinks";
import type { NoteLink } from "@/types";

/**
 * Derivation of the `noteLinks` table from task notes.
 *
 * Links are stored resolved (source id → target id) so backlinks are a single
 * index lookup instead of a scan of every note. Everything here is pure and
 * deterministic: ids are derived from the source id plus the normalized title,
 * so re-deriving the same notes is idempotent and never duplicates a row.
 */

/** The fields the builder needs from a task; keeps it usable outside Dexie. */
export interface LinkSource {
  id: string;
  title: string;
  notes: string;
}

export interface LinkTarget {
  id: string;
  title: string;
}

/** Case-insensitive title → id. First task wins, matching `findBacklinks`. */
export function buildTitleIndex(targets: readonly LinkTarget[]): Map<string, string> {
  const index = new Map<string, string>();
  for (const target of targets) {
    const key = normalizeTitle(target.title);
    if (key && !index.has(key)) index.set(key, target.id);
  }
  return index;
}

/** Stable id for one link row, so rebuilds replace instead of duplicate. */
export function noteLinkId(sourceTaskId: string, targetTitle: string): string {
  return `${sourceTaskId}:${normalizeTitle(targetTitle)}`;
}

/**
 * Derives the link rows for `sources`, resolving titles through `titleIndex`.
 * Unresolved links keep `targetTaskId: ""` so creating the target later can
 * repair them with one indexed title lookup.
 */
export function buildNoteLinks(
  sources: readonly LinkSource[],
  titleIndex: ReadonlyMap<string, string>,
): NoteLink[] {
  const rows: NoteLink[] = [];
  for (const source of sources) {
    if (!source.notes) continue;
    for (const title of extractWikiLinks(source.notes)) {
      rows.push({
        id: noteLinkId(source.id, title),
        sourceTaskId: source.id,
        targetTaskId: titleIndex.get(normalizeTitle(title)) ?? "",
        targetTitle: title,
      });
    }
  }
  return rows;
}
