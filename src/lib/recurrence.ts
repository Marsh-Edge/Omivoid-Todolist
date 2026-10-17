import { addDays, addMonths, addWeeks, addYears } from "date-fns";
import type { RecurrenceFreq, RecurrenceRule } from "@/types";

/**
 * Recurrence is stored as a compact string on `Task.recurrence`:
 *
 * - `""`            → does not repeat
 * - `"daily"`       → every day (interval 1; the `:1` is omitted)
 * - `"weekly:2"`    → every 2 weeks
 *
 * Keeping it a flat string matches the rest of the schema (no nested objects,
 * easy to Zod-validate) and never needs an index.
 */

const FREQUENCIES: readonly RecurrenceFreq[] = ["daily", "weekly", "monthly", "yearly"];

const FREQ_PATTERN = /^$|^(?:daily|weekly|monthly|yearly)(?::[1-9]\d*)?$/;

export function isValidRecurrence(value: string): boolean {
  return FREQ_PATTERN.test(value);
}

/** Parses a stored rule; returns null for "" or anything malformed. */
export function parseRecurrence(value: string | undefined): RecurrenceRule | null {
  if (!value) return null;
  const [freqPart, intervalPart] = value.split(":");
  if (!freqPart || !FREQUENCIES.includes(freqPart as RecurrenceFreq)) return null;
  const interval = intervalPart === undefined ? 1 : Number(intervalPart);
  if (!Number.isInteger(interval) || interval < 1) return null;
  return { freq: freqPart as RecurrenceFreq, interval };
}

/** Serializes a rule; `interval <= 1` drops the explicit `:1` suffix. */
export function formatRecurrence(rule: RecurrenceRule | null): string {
  if (!rule) return "";
  return rule.interval <= 1 ? rule.freq : `${rule.freq}:${rule.interval}`;
}

/** Advances an epoch-ms instant by `interval` units of the rule's frequency. */
export function addInterval(ms: number, rule: RecurrenceRule): number {
  const date = new Date(ms);
  switch (rule.freq) {
    case "daily":
      return addDays(date, rule.interval).getTime();
    case "weekly":
      return addWeeks(date, rule.interval).getTime();
    case "monthly":
      return addMonths(date, rule.interval).getTime();
    case "yearly":
      return addYears(date, rule.interval).getTime();
  }
}

/**
 * Next due date strictly after `nowMs`.
 *
 * Starts from the previous due date (so the schedule keeps its original time
 * of day), or from `nowMs` when the task has no due date. A long-overdue task
 * skips forward past `nowMs` in one call instead of only one interval, so
 * completing it never leaves it still overdue.
 */
export function nextDueDate(prevDueMs: number, rule: RecurrenceRule, nowMs: number): number {
  let next = addInterval(prevDueMs > 0 ? prevDueMs : nowMs, rule);
  // Safety bound so a zero-gap rule can't spin forever.
  for (let guard = 0; next <= nowMs && guard < 10_000; guard += 1) {
    next = addInterval(next, rule);
  }
  return next;
}
