import { beforeEach, describe, expect, it } from "vitest";
import {
  VIEW_PREFS_STORAGE_KEY,
  pickViewPrefs,
  readViewPrefs,
  writeViewPrefs,
} from "../viewPrefs";

const full = {
  viewMode: "board" as const,
  sortBy: "dueAt" as const,
  sortDir: "desc" as const,
  groupBy: "project" as const,
  filters: { status: ["todo" as const], tagIds: ["t1"] },
  searchQuery: "hello",
};

describe("viewPrefs", () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it("round-trips the full prefs blob", () => {
    writeViewPrefs(full);
    expect(readViewPrefs()).toEqual(full);
  });

  it("returns null when nothing is stored", () => {
    expect(readViewPrefs()).toBeNull();
  });

  it("returns null for corrupt JSON", () => {
    localStorage.setItem(VIEW_PREFS_STORAGE_KEY, "{not json");
    expect(readViewPrefs()).toBeNull();
  });

  it("returns null for invalid values instead of applying them", () => {
    localStorage.setItem(
      VIEW_PREFS_STORAGE_KEY,
      JSON.stringify({ ...full, viewMode: "grid", sortBy: "magic" }),
    );
    expect(readViewPrefs()).toBeNull();
  });

  it("accepts a partial blob (older/newer app versions)", () => {
    localStorage.setItem(VIEW_PREFS_STORAGE_KEY, JSON.stringify({ sortBy: "createdAt" }));
    expect(readViewPrefs()).toEqual({ sortBy: "createdAt" });
  });

  it("rejects a wrong-typed nested filter", () => {
    localStorage.setItem(
      VIEW_PREFS_STORAGE_KEY,
      JSON.stringify({ ...full, filters: { status: "todo" } }),
    );
    expect(readViewPrefs()).toBeNull();
  });

  it("picks exactly the persistable slice", () => {
    const state = {
      ...full,
      activeView: "today",
      selectedProjectId: "p1",
      paletteOpen: true,
    };
    expect(pickViewPrefs(state)).toEqual(full);
  });
});
