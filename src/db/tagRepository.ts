import { getDb } from "./index";
import { tagSchema } from "./schemas";
import type { Tag } from "@/types";

function now(): number {
  return Date.now();
}

function newId(): string {
  return crypto.randomUUID();
}

export async function createTag(input: { name: string; color?: string }): Promise<Tag> {
  const name = input.name.trim();
  if (!name) {
    throw new Error("Tag name is required");
  }
  const timestamp = now();
  const tag: Tag = tagSchema.parse({
    id: newId(),
    name,
    color: input.color ?? "",
    createdAt: timestamp,
  } satisfies Tag);
  await getDb().tags.add(tag);
  return tag;
}

export async function listTags(): Promise<Tag[]> {
  return getDb().tags.orderBy("name").toArray();
}

export async function getTag(id: string): Promise<Tag | undefined> {
  return getDb().tags.get(id);
}

export async function updateTag(id: string, patch: Partial<Pick<Tag, "name" | "color">>): Promise<Tag> {
  const db = getDb();
  return db.transaction("rw", db.tags, async () => {
    const existing = await db.tags.get(id);
    if (!existing) {
      throw new Error(`Tag not found: ${id}`);
    }
    const next = tagSchema.parse({
      ...existing,
      ...patch,
      name: patch.name !== undefined ? patch.name.trim() : existing.name,
      createdAt: existing.createdAt,
    } satisfies Tag);
    await db.tags.put(next);
    return next;
  });
}

export async function deleteTag(id: string): Promise<void> {
  await getDb().tags.delete(id);
}
