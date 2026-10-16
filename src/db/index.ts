import Dexie, { type Table } from "dexie";
import type { Project, Tag, Task } from "@/types";

export const DATABASE_NAME = "omivoid";

/**
 * Dexie schema + migrations.
 *
 * Rules:
 * - Existing `.version(n)` blocks are immutable once shipped. Any schema
 *   change must be added as a new `.version(n + 1).stores(...).upgrade(...)`.
 * - Optional values use sentinels (`0` for timestamps, `""` for references)
 *   so every common query hits an index instead of scanning the table.
 */
export class OmivoidDatabase extends Dexie {
  tasks!: Table<Task, string>;
  projects!: Table<Project, string>;
  tags!: Table<Tag, string>;

  constructor() {
    super(DATABASE_NAME);

    this.version(1).stores({
      tasks:
        "id, status, dueAt, projectId, parentId, createdAt, updatedAt, deletedAt, [status+deletedAt], [projectId+deletedAt], [parentId+order], [deletedAt+order]",
      projects: "id, parentId, order, createdAt",
      tags: "id, name, createdAt",
    });

    this.version(2).stores({
      tasks:
        "id, status, priority, dueAt, projectId, parentId, createdAt, updatedAt, deletedAt, [status+deletedAt], [projectId+deletedAt], [parentId+order], [deletedAt+order], [priority+deletedAt]",
    });

    // v3: multi-entry index so tag filters use `where("tagIds").anyOf(...)`
    // instead of scanning.
    this.version(3).stores({
      tasks:
        "id, status, priority, dueAt, projectId, parentId, createdAt, updatedAt, deletedAt, [status+deletedAt], [projectId+deletedAt], [parentId+order], [deletedAt+order], [priority+deletedAt], *tagIds",
    });
  }
}

let instance: OmivoidDatabase | null = null;

/** Lazily create the singleton so importing this module never opens a DB. */
export function getDb(): OmivoidDatabase {
  if (!instance) {
    instance = new OmivoidDatabase();
  }
  return instance;
}

export type { Project, Tag, Task };
