import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { getDb, type OmivoidDatabase } from "../index";
import {
  createSavedFilter,
  deleteSavedFilter,
  getSavedFilter,
  listSavedFilters,
  normalizeFilters,
  renameSavedFilter,
} from "../savedFilterRepository";

describe("savedFilterRepository", () => {
  let db: OmivoidDatabase;

  beforeEach(async () => {
    db = getDb();
    await db.delete();
    await db.open();
  });

  afterEach(async () => {
    if (db.isOpen()) await db.close();
  });

  it("creates a saved filter with a trimmed name", async () => {
    const filter = await createSavedFilter({ name: "  Today  ", filters: { status: ["todo"] } });
    expect(filter.name).toBe("Today");
    expect(filter.filters).toEqual({ status: ["todo"] });
    expect(filter.createdAt).toBeGreaterThan(0);
  });

  it("rejects an empty name", async () => {
    await expect(createSavedFilter({ name: "   ", filters: {} })).rejects.toThrow(/required/i);
  });

  it("drops empty filter clauses on save", async () => {
    const filter = await createSavedFilter({
      name: "Empty-ish",
      filters: { status: [], priority: [], tagIds: [], projectId: "" },
    });
    expect(filter.filters).toEqual({});
  });

  it("lists saved filters ordered by creation time", async () => {
    const nowSpy = vi.spyOn(Date, "now").mockReturnValueOnce(1_000).mockReturnValueOnce(2_000);
    const a = await createSavedFilter({ name: "A", filters: {} });
    const b = await createSavedFilter({ name: "B", filters: {} });
    nowSpy.mockRestore();
    const list = await listSavedFilters();
    expect(list.map((f) => f.id)).toEqual([a.id, b.id]);
    expect(list.map((f) => f.name)).toEqual(["A", "B"]);
  });

  it("renames a saved filter and preserves createdAt", async () => {
    const filter = await createSavedFilter({ name: "Old", filters: { priority: ["high"] } });
    const next = await renameSavedFilter(filter.id, " New ");
    expect(next.name).toBe("New");
    expect(next.createdAt).toBe(filter.createdAt);
    expect(next.filters).toEqual({ priority: ["high"] });
  });

  it("throws when renaming a missing saved filter", async () => {
    await expect(renameSavedFilter("nope", "x")).rejects.toThrow(/not found/i);
  });

  it("deletes a saved filter", async () => {
    const filter = await createSavedFilter({ name: "Gone", filters: {} });
    await deleteSavedFilter(filter.id);
    expect(await getSavedFilter(filter.id)).toBeUndefined();
    expect(await listSavedFilters()).toHaveLength(0);
  });

  it("normalizeFilters copies non-empty clauses only", () => {
    expect(normalizeFilters({ status: ["todo"], projectId: "", tagIds: [] })).toEqual({
      status: ["todo"],
    });
  });
});
