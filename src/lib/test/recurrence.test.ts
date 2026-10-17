import { describe, it, expect } from "vitest";
import {
  addInterval,
  formatRecurrence,
  isValidRecurrence,
  nextDueDate,
  parseRecurrence,
} from "../recurrence";

function at(y: number, m: number, d: number, h = 0, min = 0): number {
  return new Date(y, m - 1, d, h, min).getTime();
}

describe("isValidRecurrence", () => {
  it("accepts empty and known frequencies", () => {
    expect(isValidRecurrence("")).toBe(true);
    expect(isValidRecurrence("daily")).toBe(true);
    expect(isValidRecurrence("weekly")).toBe(true);
    expect(isValidRecurrence("monthly")).toBe(true);
    expect(isValidRecurrence("yearly")).toBe(true);
    expect(isValidRecurrence("daily:3")).toBe(true);
  });

  it("rejects malformed rules", () => {
    expect(isValidRecurrence("hourly")).toBe(false);
    expect(isValidRecurrence("daily:0")).toBe(false);
    expect(isValidRecurrence("daily:-1")).toBe(false);
    expect(isValidRecurrence("daily:x")).toBe(false);
    expect(isValidRecurrence("daily:2:3")).toBe(false);
  });
});

describe("parseRecurrence", () => {
  it("returns null for empty or invalid input", () => {
    expect(parseRecurrence("")).toBeNull();
    expect(parseRecurrence(undefined)).toBeNull();
    expect(parseRecurrence("nope")).toBeNull();
    expect(parseRecurrence("daily:0")).toBeNull();
  });

  it("defaults the interval to 1 and reads explicit intervals", () => {
    expect(parseRecurrence("weekly")).toEqual({ freq: "weekly", interval: 1 });
    expect(parseRecurrence("daily:3")).toEqual({ freq: "daily", interval: 3 });
  });
});

describe("formatRecurrence", () => {
  it("omits the interval when it is 1", () => {
    expect(formatRecurrence({ freq: "daily", interval: 1 })).toBe("daily");
    expect(formatRecurrence({ freq: "weekly", interval: 2 })).toBe("weekly:2");
  });

  it("is the inverse of parseRecurrence", () => {
    for (const value of ["daily", "weekly:2", "monthly:6", "yearly"]) {
      expect(formatRecurrence(parseRecurrence(value))).toBe(value);
    }
  });

  it("returns empty for null", () => {
    expect(formatRecurrence(null)).toBe("");
  });
});

describe("addInterval", () => {
  it("advances whole units", () => {
    expect(addInterval(at(2026, 1, 1, 9), { freq: "daily", interval: 2 })).toBe(
      at(2026, 1, 3, 9),
    );
    expect(addInterval(at(2026, 1, 1, 9), { freq: "weekly", interval: 1 })).toBe(
      at(2026, 1, 8, 9),
    );
    expect(addInterval(at(2026, 1, 31, 9), { freq: "monthly", interval: 1 })).toBe(
      at(2026, 2, 28, 9),
    );
    expect(addInterval(at(2026, 1, 1, 9), { freq: "yearly", interval: 1 })).toBe(
      at(2027, 1, 1, 9),
    );
  });
});

describe("nextDueDate", () => {
  it("advances one interval when the previous due is still in the future", () => {
    const prev = at(2026, 10, 20, 9);
    const now = at(2026, 10, 17, 10);
    expect(nextDueDate(prev, { freq: "daily", interval: 1 }, now)).toBe(
      at(2026, 10, 21, 9),
    );
  });

  it("skips a long overdue task past now in one call", () => {
    const prev = at(2026, 10, 10, 9);
    const now = at(2026, 10, 17, 10);
    expect(nextDueDate(prev, { freq: "daily", interval: 1 }, now)).toBe(
      at(2026, 10, 18, 9),
    );
  });

  it("keeps the original time of day", () => {
    const prev = at(2026, 10, 10, 14, 30);
    const now = at(2026, 10, 17, 10);
    const next = new Date(nextDueDate(prev, { freq: "monthly", interval: 1 }, now));
    expect(next.getHours()).toBe(14);
    expect(next.getMinutes()).toBe(30);
  });

  it("falls back to now when the task has no due date", () => {
    const now = at(2026, 10, 17, 10);
    expect(nextDueDate(0, { freq: "daily", interval: 1 }, now)).toBe(
      at(2026, 10, 18, 10),
    );
  });
});
