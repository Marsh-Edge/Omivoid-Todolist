import { describe, it, expect } from "vitest";
import { parseQuickAdd } from "../naturalLanguage";

// Saturday, 17 Oct 2026, 10:00 local time.
const NOW = new Date(2026, 9, 17, 10, 0, 0).getTime();
const at = (y: number, mo: number, d: number, h = 9, mi = 0) =>
  new Date(y, mo, d, h, mi, 0, 0).getTime();

describe("parseQuickAdd — title", () => {
  it("keeps a plain title untouched", () => {
    const parsed = parseQuickAdd("Buy milk", NOW);
    expect(parsed.title).toBe("Buy milk");
    expect(parsed.dueAt).toBe(0);
    expect(parsed.priority).toBe("none");
    expect(parsed.tagNames).toEqual([]);
  });

  it("falls back to the raw input when everything is a token", () => {
    expect(parseQuickAdd("tomorrow", NOW).title).toBe("tomorrow");
  });
});

describe("parseQuickAdd — priority", () => {
  it("parses and strips priority flags", () => {
    expect(parseQuickAdd("Fix bug !high", NOW)).toMatchObject({
      title: "Fix bug",
      priority: "high",
    });
    expect(parseQuickAdd("Ship it !m", NOW).priority).toBe("medium");
    expect(parseQuickAdd("Later !L", NOW).priority).toBe("low");
  });
});

describe("parseQuickAdd — tags", () => {
  it("collects #tags, dedupes case-insensitively, preserves case", () => {
    const parsed = parseQuickAdd("Pay rent #home #Home #finance", NOW);
    expect(parsed.title).toBe("Pay rent");
    expect(parsed.tagNames).toEqual(["home", "finance"]);
  });
});

describe("parseQuickAdd — dates", () => {
  it("parses today / tomorrow with the default hour", () => {
    expect(parseQuickAdd("Standup today", NOW).dueAt).toBe(at(2026, 9, 17, 9));
    expect(parseQuickAdd("Standup tomorrow", NOW).dueAt).toBe(at(2026, 9, 18, 9));
  });

  it("parses weekdays to the next occurrence (strictly future)", () => {
    // Today is Saturday the 17th.
    expect(parseQuickAdd("Review monday", NOW).dueAt).toBe(at(2026, 9, 19, 9));
    expect(parseQuickAdd("Review fri", NOW).dueAt).toBe(at(2026, 9, 23, 9));
    // "saturday" equals today → next week.
    expect(parseQuickAdd("Review saturday", NOW).dueAt).toBe(at(2026, 9, 24, 9));
  });

  it("parses next week / next month / in N units", () => {
    expect(parseQuickAdd("Sync next week", NOW).dueAt).toBe(at(2026, 9, 24, 9));
    expect(parseQuickAdd("Renew next month", NOW).dueAt).toBe(at(2026, 10, 17, 9));
    expect(parseQuickAdd("Follow up in 3 days", NOW).dueAt).toBe(at(2026, 9, 20, 9));
    expect(parseQuickAdd("Follow up in 2 weeks", NOW).dueAt).toBe(at(2026, 9, 31, 9));
  });

  it("parses explicit dates (ISO, M/D, month name)", () => {
    expect(parseQuickAdd("Trip 2026-11-01", NOW).dueAt).toBe(at(2026, 10, 1, 9));
    expect(parseQuickAdd("Trip 11/1", NOW).dueAt).toBe(at(2026, 10, 1, 9));
    // A date already passed this year rolls to next year.
    expect(parseQuickAdd("Trip 10/5", NOW).dueAt).toBe(at(2027, 9, 5, 9));
    expect(parseQuickAdd("Trip november 1", NOW).dueAt).toBe(at(2026, 10, 1, 9));
    expect(parseQuickAdd("Trip january 5", NOW).dueAt).toBe(at(2027, 0, 5, 9));
  });
});

describe("parseQuickAdd — times", () => {
  it("parses 12h and 24h clock times", () => {
    expect(parseQuickAdd("Call 5pm", NOW)).toMatchObject({
      title: "Call",
      dueAt: at(2026, 9, 17, 17),
      hasTime: true,
    });
    expect(parseQuickAdd("Call 9:30am", NOW).dueAt).toBe(at(2026, 9, 17, 9, 30));
    expect(parseQuickAdd("Call 17:00", NOW).dueAt).toBe(at(2026, 9, 17, 17));
    expect(parseQuickAdd("Call at 8am", NOW).dueAt).toBe(at(2026, 9, 17, 8));
  });

  it("parses noon, midnight and tonight", () => {
    expect(parseQuickAdd("Lunch noon", NOW).dueAt).toBe(at(2026, 9, 17, 12));
    expect(parseQuickAdd("Reset midnight", NOW).dueAt).toBe(at(2026, 9, 17, 0));
    expect(parseQuickAdd("Party tonight", NOW).dueAt).toBe(at(2026, 9, 17, 21));
  });

  it("combines a date with a time in any order", () => {
    expect(parseQuickAdd("Meeting tomorrow 5pm", NOW).dueAt).toBe(at(2026, 9, 18, 17));
    expect(parseQuickAdd("Meeting at 5pm tomorrow", NOW).dueAt).toBe(at(2026, 9, 18, 17));
    expect(parseQuickAdd("Meeting 2026-11-01 3pm", NOW).dueAt).toBe(at(2026, 10, 1, 15));
  });

  it("does not treat bare numbers or years as times", () => {
    const parsed = parseQuickAdd("Buy 2026 apples", NOW);
    expect(parsed.dueAt).toBe(0);
    expect(parsed.title).toBe("Buy 2026 apples");
  });
});

describe("parseQuickAdd — recurrence", () => {
  it("parses single-word frequencies", () => {
    expect(parseQuickAdd("Water plants daily", NOW)).toMatchObject({
      title: "Water plants",
      recurrence: "daily",
    });
    expect(parseQuickAdd("Review weekly", NOW).recurrence).toBe("weekly");
    expect(parseQuickAdd("Pay rent monthly", NOW).recurrence).toBe("monthly");
    expect(parseQuickAdd("Renew yearly", NOW).recurrence).toBe("yearly");
  });

  it("parses 'every <unit>' phrases", () => {
    expect(parseQuickAdd("Standup every day", NOW)).toMatchObject({
      title: "Standup",
      recurrence: "daily",
    });
    expect(parseQuickAdd("Retro every week", NOW).recurrence).toBe("weekly");
    expect(parseQuickAdd("Clean every month", NOW).recurrence).toBe("monthly");
    expect(parseQuickAdd("Service every year", NOW).recurrence).toBe("yearly");
  });

  it("parses intervals ('every N units')", () => {
    expect(parseQuickAdd("Sprint review every 2 weeks", NOW)).toMatchObject({
      title: "Sprint review",
      recurrence: "weekly:2",
    });
    expect(parseQuickAdd("Deep clean every 3 days", NOW).recurrence).toBe("daily:3");
  });

  it("defaults to no recurrence and keeps stray 'every' in the title", () => {
    expect(parseQuickAdd("Buy milk", NOW).recurrence).toBe("");
    const parsed = parseQuickAdd("Every cloud has a silver lining", NOW);
    expect(parsed.recurrence).toBe("");
    expect(parsed.title).toBe("Every cloud has a silver lining");
  });
});

describe("parseQuickAdd — combined", () => {
  it("handles title + tag + priority + date together", () => {
    const parsed = parseQuickAdd("Submit report !high #work tomorrow 5pm", NOW);
    expect(parsed.title).toBe("Submit report");
    expect(parsed.priority).toBe("high");
    expect(parsed.tagNames).toEqual(["work"]);
    expect(parsed.dueAt).toBe(at(2026, 9, 18, 17));
  });
});
