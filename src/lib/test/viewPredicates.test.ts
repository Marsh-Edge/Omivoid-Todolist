import { describe, it, expect } from "vitest";
import { isToday, isOverdue, isUpcoming } from "../viewPredicates";
import { startOfDay, addDays, subDays, endOfDay } from "date-fns";

describe("viewPredicates", () => {
  const now = new Date("2026-10-16T12:00:00.000Z");
  const nowMs = now.getTime();

  it("isToday checks start/end of day", () => {
    expect(isToday(startOfDay(now).getTime(), nowMs)).toBe(true);
    expect(isToday(endOfDay(now).getTime(), nowMs)).toBe(true);
    expect(isToday(subDays(now, 1).getTime(), nowMs)).toBe(false);
    expect(isToday(addDays(now, 1).getTime(), nowMs)).toBe(false);
  });

  it("isOverdue only if not today and before now", () => {
    expect(isOverdue(subDays(now, 1).getTime(), nowMs)).toBe(true);
    expect(isOverdue(startOfDay(now).getTime(), nowMs)).toBe(false);
    expect(isOverdue(addDays(now, 1).getTime(), nowMs)).toBe(false);
  });

  it("isUpcoming is in future and not today", () => {
    expect(isUpcoming(addDays(now, 1).getTime(), nowMs)).toBe(true);
    expect(isUpcoming(addDays(now, 5).getTime(), nowMs)).toBe(true);
    expect(isUpcoming(startOfDay(now).getTime(), nowMs)).toBe(false);
    expect(isUpcoming(subDays(now, 1).getTime(), nowMs)).toBe(false);
  });
});
