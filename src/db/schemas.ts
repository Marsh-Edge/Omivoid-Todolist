import { z } from "zod";
import { isValidRecurrence } from "@/lib/recurrence";
import type { Project, SavedFilter, SnapshotData, SnapshotMeta, Tag, Task } from "@/types";

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
  completedAt: timestampSchema,
  deletedAt: timestampSchema,
  order: z.number(),
  createdAt: timestampSchema,
  updatedAt: timestampSchema,
});

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

export const snapshotMetaSchema: z.ZodType<SnapshotMeta> = z.object({
  id: idSchema,
  createdAt: timestampSchema,
  taskCount: z.number().int().nonnegative(),
  projectCount: z.number().int().nonnegative(),
  tagCount: z.number().int().nonnegative(),
});

export const snapshotDataSchema: z.ZodType<SnapshotData> = z.object({
  id: idSchema,
  tasks: z.array(taskSchema),
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
