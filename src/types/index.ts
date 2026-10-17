/**
 * Domain types for the local database.
 *
 * Optional numeric fields use `0` as the "absent" sentinel instead of `null`
 * so that every common query can use an IndexedDB index (nulls are not
 * valid IndexedDB keys, so null-valued rows silently disappear from an
 * index). Same idea for optional references: `""` means "none".
 */

export type TaskStatus = "todo" | "in_progress" | "done";

export type TaskPriority = "none" | "low" | "medium" | "high";

export type RecurrenceFreq = "daily" | "weekly" | "monthly" | "yearly";

/** A repeating schedule; `interval` is how many `freq` units between repeats. */
export interface RecurrenceRule {
  freq: RecurrenceFreq;
  interval: number;
}

/** Smart views (list scopes) shared by the store, queries and UI. */
export type SmartView =
  | "inbox"
  | "today"
  | "upcoming"
  | "overdue"
  | "completed"
  | "important"
  | "trash";

export interface Task {
  id: string;
  title: string;
  notes: string;
  status: TaskStatus;
  priority: TaskPriority;
  /** "" when the task is not in any project (Inbox). */
  projectId: string;
  /** "" when the task is top-level. */
  parentId: string;
  tagIds: string[];
  /** Epoch ms; 0 when the task has no due date. */
  dueAt: number;
  /**
   * "" when the task does not repeat; otherwise a compact rule such as
   * "weekly" or "daily:3" (see `src/lib/recurrence.ts`).
   */
  recurrence: string;
  /** Epoch ms; 0 when the task is not completed. */
  completedAt: number;
  /** Epoch ms; 0 when the task is not deleted (trash uses a real timestamp). */
  deletedAt: number;
  /** Manual sort key (ascending). */
  order: number;
  createdAt: number;
  updatedAt: number;
}

export interface Project {
  id: string;
  name: string;
  /** lucide-react icon name; "" when unset. */
  icon: string;
  /** CSS color token/value; "" when unset. */
  color: string;
  /** "" when the project is top-level. */
  parentId: string;
  order: number;
  createdAt: number;
  updatedAt: number;
}

export interface Tag {
  id: string;
  name: string;
  /** CSS color token/value; "" when unset. */
  color: string;
  createdAt: number;
}

/**
 * Criteria that narrow the active view's task list. Every field is optional;
 * an absent field means "no constraint". Shared by the store (live UI state)
 * and saved filters (a named, reusable snapshot of the same shape).
 */
export interface TaskFilterCriteria {
  status?: TaskStatus[];
  priority?: TaskPriority[];
  projectId?: string;
  /** A task matches when it carries any of the selected tags (OR). */
  tagIds?: string[];
}

/** A named, reusable set of filter criteria (stored in IndexedDB). */
export interface SavedFilter {
  id: string;
  name: string;
  filters: TaskFilterCriteria;
  createdAt: number;
}

/** Lightweight metadata for a rolling local backup (no payload). */
export interface SnapshotMeta {
  id: string;
  createdAt: number;
  taskCount: number;
  projectCount: number;
  tagCount: number;
}

/** The payload of a rolling local backup (kept in a separate table). */
export interface SnapshotData {
  id: string;
  tasks: Task[];
  projects: Project[];
  tags: Tag[];
}
