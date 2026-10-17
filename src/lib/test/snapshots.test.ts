import { describe, it, expect } from "vitest";
import { selectSnapshotIdsToPrune, shouldTakeSnapshot } from "../snapshots";

describe("selectSnapshotIdsToPrune", () => {
  const snaps = [
    { id: "a", createdAt: 100 },
    { id: "b", createdAt: 300 },
    { id: "c", createdAt: 200 },
  ];

  it("keeps the newest entries and returns the rest", () => {
    expect(selectSnapshotIdsToPrune(snaps, 2)).toEqual(["a"]);
  });

  it("returns nothing when there is room", () => {
    expect(selectSnapshotIdsToPrune(snaps, 5)).toEqual([]);
    expect(selectSnapshotIdsToPrune(snaps, 3)).toEqual([]);
  });

  it("returns everything when keep is zero", () => {
    expect(selectSnapshotIdsToPrune(snaps, 0).sort()).toEqual(["a", "b", "c"]);
  });

  it("is a no-op for a negative keep", () => {
    expect(selectSnapshotIdsToPrune(snaps, -1)).toEqual([]);
  });

  it("breaks createdAt ties deterministically by id", () => {
    const tied = [
      { id: "z", createdAt: 50 },
      { id: "a", createdAt: 50 },
    ];
    expect(selectSnapshotIdsToPrune(tied, 1)).toEqual(["z"]);
  });
});

describe("shouldTakeSnapshot", () => {
  it("is true when there are no backups", () => {
    expect(shouldTakeSnapshot([], 1000, 500)).toBe(true);
  });

  it("is false before the interval elapses", () => {
    expect(shouldTakeSnapshot([{ id: "a", createdAt: 900 }], 1000, 500)).toBe(false);
  });

  it("is true once the interval elapses", () => {
    expect(shouldTakeSnapshot([{ id: "a", createdAt: 500 }], 1000, 500)).toBe(true);
  });

  it("measures from the newest backup", () => {
    const snaps = [
      { id: "old", createdAt: 100 },
      { id: "new", createdAt: 900 },
    ];
    expect(shouldTakeSnapshot(snaps, 1000, 500)).toBe(false);
  });
});
