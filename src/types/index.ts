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
