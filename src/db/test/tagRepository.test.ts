import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { getDb, type OmivoidDatabase } from "../index";
import { createTag, deleteTag, getTag, listTags, updateTag } from "../tagRepository";

describe("tagRepository", () => {
  let db: OmivoidDatabase;

  beforeEach(async () => {
    db = getDb();
    await db.delete();
    await db.open();
  });

  afterEach(async () => {
    if (db.isOpen()) await db.close();
  });

  it("creates a tag and trims the name", async () => {
    const tag = await createTag({ name: "  urgent  ", color: "#ef4444" });
    expect(tag.name).toBe("urgent");
    expect(tag.color).toBe("#ef4444");
  });

  it("rejects an empty name", async () => {
    await expect(createTag({ name: "  " })).rejects.toThrow(/required/i);
  });

  it("lists tags alphabetically by name", async () => {
    await createTag({ name: "zebra" });
    await createTag({ name: "alpha" });
    await createTag({ name: "mango" });
    const list = await listTags();
    expect(list.map((t) => t.name)).toEqual(["alpha", "mango", "zebra"]);
  });

  it("updates name and color, preserving createdAt", async () => {
    const tag = await createTag({ name: "home" });
    const next = await updateTag(tag.id, { name: " house ", color: "#22c55e" });
    expect(next.name).toBe("house");
    expect(next.color).toBe("#22c55e");
    expect(next.createdAt).toBe(tag.createdAt);
  });

  it("throws when updating a missing tag", async () => {
    await expect(updateTag("nope", { name: "x" })).rejects.toThrow(/not found/i);
  });

  it("deletes a tag", async () => {
    const tag = await createTag({ name: "temp" });
    await deleteTag(tag.id);
    expect(await getTag(tag.id)).toBeUndefined();
    expect(await listTags()).toHaveLength(0);
  });
});
