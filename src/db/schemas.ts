import { z } from "zod";
import { isValidRecurrence } from "@/lib/recurrence";
import type {
  NoteLink,
  Project,
  SavedFilter,
  SnapshotData,
  SnapshotMeta,
  Tag,
  Task,
} from "@/types";

/**
 * Zod schemas are the single validation gate for everything entering
 * IndexedDB. They are annotated with the domain types so a mismatch between
 * a schema and `src/types` is a compile error.
 *
 * `0` means "absent" for timestamp fields; `""` means "absent" for
 * references (see `src/types/index.ts`).
 */

export const taskStatusSchema = z.enum(["todo", "in_progress", "done"]);
export const taskPrioritySchema = z.enum(["none", "low", "medium", "high"]);

const idSchema = z.string().min(1);
const timestampSchema = z.number().int().nonnegative();

/** "" (never repeats) or a compact rule like "weekly" / "daily:3". */
export const recurrenceSchema = z
  .string()
  .max(20)
  .refine(isValidRecurrence, { message: "Invalid recurrence rule" });

/** Upper bound for a per-task reminder lead time (30 days). */
export const MAX_REMIND_BEFORE_MIN = 43_200;

const remindBeforeSchema = z.number().int().nonnegative().max(MAX_REMIND_BEFORE_MIN);

export const taskSchema: z.ZodType<Task> = z.object({
  id: idSchema,
  title: z.string().trim().min(1).max(500),
  notes: z.string().max(100_000),
  status: taskStatusSchema,
  priority: taskPrioritySchema,
  projectId: z.string(),
  parentId: z.string(),
  tagIds: z.array(idSchema).max(200),
  dueAt: timestampSchema,
  recurrence: recurrenceSchema,
  remindBeforeMin: remindBeforeSchema,
  completedAt: timestampSchema,
  deletedAt: timestampSchema,
  order: z.number(),
  createdAt: timestampSchema,
  updatedAt: timestampSchema,
});

/**
 * Accepts task rows written before a field existed (older JSON backups and
 * stored snapshots), filling the sentinel defaults so they still load.
 */
export const legacyTaskSchema: z.ZodType<Task, unknown> = z.preprocess(
  (value) => {
    if (value === null || typeof value !== "object") return value;
    const row: Record<string, unknown> = { ...(value as Record<string, unknown>) };
    if (!("recurrence" in row)) row.recurrence = "";
    if (!("remindBeforeMin" in row)) row.remindBeforeMin = 0;
    return row;
  },
  taskSchema,
);

export const projectSchema: z.ZodType<Project> = z.object({
  id: idSchema,
  name: z.string().trim().min(1).max(200),
  icon: z.string().max(100),
  color: z.string().max(100),
  parentId: z.string(),
  order: z.number(),
  createdAt: timestampSchema,
  updatedAt: timestampSchema,
});

export const tagSchema: z.ZodType<Tag> = z.object({
  id: idSchema,
  name: z.string().trim().min(1).max(100),
  color: z.string().max(100),
  createdAt: timestampSchema,
});

export const noteLinkSchema: z.ZodType<NoteLink> = z.object({
  id: idSchema,
  sourceTaskId: idSchema,
  targetTaskId: z.string(),
  targetTitle: z.string().trim().min(1).max(500),
});

export const snapshotMetaSchema: z.ZodType<SnapshotMeta> = z.object({
  id: idSchema,
  createdAt: timestampSchema,
  taskCount: z.number().int().nonnegative(),
  projectCount: z.number().int().nonnegative(),
  tagCount: z.number().int().nonnegative(),
});

export const snapshotDataSchema: z.ZodType<SnapshotData> = z.object({
  id: idSchema,
  tasks: z.array(legacyTaskSchema),
  projects: z.array(projectSchema),
  tags: z.array(tagSchema),
});

export const savedFilterSchema: z.ZodType<SavedFilter> = z.object({
  id: idSchema,
  name: z.string().trim().min(1).max(100),
  filters: z.object({
    status: z.array(taskStatusSchema).max(3).optional(),
    priority: z.array(taskPrioritySchema).max(4).optional(),
    projectId: z.string().max(200).optional(),
    tagIds: z.array(idSchema).max(200).optional(),
  }),
  createdAt: timestampSchema,
});

export const taskCreateInputSchema = z.object({
  title: z.string().trim().min(1).max(500),
  notes: z.string().max(100_000).optional(),
  status: taskStatusSchema.optional(),
  priority: taskPrioritySchema.optional(),
  projectId: z.string().optional(),
  parentId: z.string().optional(),
  tagIds: z.array(idSchema).max(200).optional(),
  dueAt: timestampSchema.optional(),
  recurrence: recurrenceSchema.optional(),
  remindBeforeMin: remindBeforeSchema.optional(),
});

export const taskUpdateInputSchema = taskCreateInputSchema
  .partial()
  .extend({
    completedAt: timestampSchema.optional(),
    deletedAt: timestampSchema.optional(),
    order: z.number().optional(),
  });

export type TaskCreateInput = z.infer<typeof taskCreateInputSchema>;
export type TaskUpdateInput = z.infer<typeof taskUpdateInputSchema>;
