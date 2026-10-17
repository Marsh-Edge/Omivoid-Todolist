/**
 * Wiki-style `[[Task title]]` links stored inside a task's Markdown notes.
 *
 * Links point at a task *title* (human-friendly) rather than an id. Matching is
 * trimmed and case-insensitive; duplicate titles resolve to the first task that
 * carries that title. Renames are therefore not tracked — this is a deliberate
 * Group 1 tradeoff (see PLAN.md).
 *
 * All functions here are pure so they can be unit tested.
 */

/** Matches `[[...]]`; the inner text cannot contain brackets. */
const WIKI_LINK_PATTERN = /\[\[([^[\]]+)\]\]/g;

/** Custom URL scheme prefix used to mark internal task links in Markdown. */
export const TASK_LINK_PREFIX = "#omivoid-task/";

export function normalizeTitle(title: string): string {
  return title.trim().toLowerCase();
}

/** Unique `[[...]]` targets in first-seen order (original casing preserved). */
export function extractWikiLinks(notes: string): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const match of notes.matchAll(WIKI_LINK_PATTERN)) {
    const raw = match[1];
    if (raw === undefined) continue;
    const title = raw.trim();
    if (!title) continue;
    const key = normalizeTitle(title);
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(title);
  }
  return out;
}

/**
 * Rewrites resolvable `[[Title]]` into a Markdown link whose href encodes the
 * target id. Unresolved references are left verbatim (`[[Title]]`) so they show
 * as a visible "broken link".
 */
export function replaceWikiLinks(
  notes: string,
  resolve: (title: string) => string | null,
): string {
  return notes.replace(WIKI_LINK_PATTERN, (whole, rawTitle: string) => {
    const title = rawTitle.trim();
    const id = resolve(title);
    if (!id) return whole;
    return `[${title}](${TASK_LINK_PREFIX}${encodeURIComponent(id)})`;
  });
}

/** Extracts the task id from a rendered link href, or `null` if not internal. */
export function taskIdFromHref(href: string | undefined): string | null {
  if (!href || !href.startsWith(TASK_LINK_PREFIX)) return null;
  try {
    return decodeURIComponent(href.slice(TASK_LINK_PREFIX.length));
  } catch {
    return null;
  }
}

export interface BacklinkSource {
  id: string;
  title: string;
  notes: string;
}

/** Tasks (from `tasks`) whose notes link to `targetTitle`. */
export function findBacklinks(
  tasks: readonly BacklinkSource[],
  targetTitle: string,
): BacklinkSource[] {
  const key = normalizeTitle(targetTitle);
  if (!key) return [];
  const out: BacklinkSource[] = [];
  for (const task of tasks) {
    if (!task.notes) continue;
    const targets = extractWikiLinks(task.notes);
    if (targets.some((title) => normalizeTitle(title) === key)) {
      out.push(task);
    }
  }
  return out;
}
