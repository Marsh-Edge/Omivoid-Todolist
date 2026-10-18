import Dexie, { type Table } from "dexie";
import { buildNoteLinks, buildTitleIndex } from "@/lib/noteLinks";
import { noteLinkSchema } from "./schemas";
import type {
  NoteLink,
  Project,
  SavedFilter,
  SnapshotData,
  SnapshotMeta,
  Tag,
  Task,
} from "@/types";

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
  snapshots!: Table<SnapshotMeta, string>;
  snapshotData!: Table<SnapshotData, string>;
  savedFilters!: Table<SavedFilter, string>;
  noteLinks!: Table<NoteLink, string>;

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

    // v4: `recurrence` replaces the "absent" value "" (no index needed). The
    // indexes are unchanged, so the store string is repeated for clarity.
    this.version(4)
      .stores({
        tasks:
          "id, status, priority, dueAt, projectId, parentId, createdAt, updatedAt, deletedAt, [status+deletedAt], [projectId+deletedAt], [parentId+order], [deletedAt+order], [priority+deletedAt], *tagIds",
      })
      .upgrade((tx) =>
        tx
          .table("tasks")
          .toCollection()
          .modify((task: Task & { recurrence?: string }) => {
            if (task.recurrence === undefined) task.recurrence = "";
          }),
      );

    // v5: rolling local backups. Metadata and payload live in separate tables
    // so listing backups never loads the (potentially large) task arrays.
    this.version(5).stores({
      tasks:
        "id, status, priority, dueAt, projectId, parentId, createdAt, updatedAt, deletedAt, [status+deletedAt], [projectId+deletedAt], [parentId+order], [deletedAt+order], [priority+deletedAt], *tagIds",
      snapshots: "id, createdAt",
      snapshotData: "id",
    });

    // v6: named, reusable filter presets. Tiny table, no upgrade callback.
    this.version(6).stores({
      tasks:
        "id, status, priority, dueAt, projectId, parentId, createdAt, updatedAt, deletedAt, [status+deletedAt], [projectId+deletedAt], [parentId+order], [deletedAt+order], [priority+deletedAt], *tagIds",
      snapshots: "id, createdAt",
      snapshotData: "id",
      savedFilters: "id, name, createdAt",
    });

    // v7: per-task reminder lead time (`remindBeforeMin`) plus the derived
    // `noteLinks` table. `tasks.title` becomes an index so note links can be
    // resolved/repairs without scanning. The upgrade backfills both: the new
    // column onto every row, and the link table from existing notes.
    this.version(7)
      .stores({
        tasks:
          "id, status, priority, dueAt, projectId, parentId, createdAt, updatedAt, deletedAt, [status+deletedAt], [projectId+deletedAt], [parentId+order], [deletedAt+order], [priority+deletedAt], *tagIds, title",
        snapshots: "id, createdAt",
        snapshotData: "id",
        savedFilters: "id, name, createdAt",
        noteLinks: "id, sourceTaskId, targetTaskId, targetTitle",
      })
      .upgrade(async (tx) => {
        await tx
          .table("tasks")
          .toCollection()
          .modify((task: Task & { remindBeforeMin?: number }) => {
            if (task.remindBeforeMin === undefined) task.remindBeforeMin = 0;
          });

        const tasks = (await tx.table("tasks").toArray()) as Task[];
        const links = buildNoteLinks(tasks, buildTitleIndex(tasks)).map((row) =>
          noteLinkSchema.parse(row),
        );
        if (links.length > 0) await tx.table("noteLinks").bulkAdd(links);
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

export type { NoteLink, Project, Tag, Task };
