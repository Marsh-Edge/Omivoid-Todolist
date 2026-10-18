import { addDays, addMonths, setHours, setMinutes, setSeconds, startOfDay } from "date-fns";
import { formatRecurrence } from "@/lib/recurrence";
import type { RecurrenceFreq, TaskPriority } from "@/types";

/**
 * Tiny, dependency-light natural-language quick-add parser.
 *
 * Pure and deterministic: it takes the raw input plus a `nowMs` reference so it
 * can be unit tested without mocking the clock. It recognizes — and strips from
 * the title — a one-shot subset of English:
 *
 *   priority  !high !medium !low (!h !m !l)
 *   tags      #work #home-work
 *   projects  @work @"deep work" (matched against existing projects only)
 *   dates     today, tomorrow, tonight, a weekday, "next week/month",
 *             "in N days/weeks/months", YYYY-MM-DD, M/D[/YYYY], "november 1"
 *   times     5pm, 9:30am, 17:00, noon, midnight, "at 8am"
 *   repeats   daily/weekly/monthly/yearly, "every day/week/month/year",
 *             "every N days/weeks/months/years"
 *
 * Everything it doesn't understand stays in the title, and the parser never
 * throws — the caller is always free to ignore the result.
 */

export interface ParsedTask {
  /** Remaining text with recognized tokens removed (never empty). */
  title: string;
  /** Epoch ms for the due date, or 0 when none was found. */
  dueAt: number;
  /** True when an explicit clock time was found (vs. the default hour). */
  hasTime: boolean;
  priority: TaskPriority;
  /** Distinct tag names in first-seen order (case preserved, deduped). */
  tagNames: string[];
  /** Compact recurrence rule, or "" when the task does not repeat. */
  recurrence: string;
  /**
   * Project named by an `@token` (last one wins), or "" when none. The parser
   * cannot look up projects, so the caller resolves the name (case-insensitive)
   * and re-adds `projectToken` to the title when nothing matches.
   */
  projectName: string;
  /** The `@token` exactly as typed, for handing back an unresolved name. */
  projectToken: string;
}

const WEEKDAYS: Record<string, number> = {
  sunday: 0,
  sun: 0,
  monday: 1,
  mon: 1,
  tuesday: 2,
  tue: 2,
  tues: 2,
  wednesday: 3,
  wed: 3,
  thursday: 4,
  thu: 4,
  thur: 4,
  thurs: 4,
  friday: 5,
  fri: 5,
  saturday: 6,
  sat: 6,
};

const MONTHS: Record<string, number> = {
  january: 0,
  jan: 0,
  february: 1,
  feb: 1,
  march: 2,
  mar: 2,
  april: 3,
  apr: 3,
  may: 4,
  june: 5,
  jun: 5,
  july: 6,
  jul: 6,
  august: 7,
  aug: 7,
  september: 8,
  sep: 8,
  sept: 8,
  october: 9,
  oct: 9,
  november: 10,
  nov: 10,
  december: 11,
  dec: 11,
};

const UNIT_TO_FREQ: Record<string, RecurrenceFreq> = {
  day: "daily",
  week: "weekly",
  month: "monthly",
  year: "yearly",
};

const FREQ_WORDS: Record<string, RecurrenceFreq> = {
  daily: "daily",
  weekly: "weekly",
  monthly: "monthly",
  yearly: "yearly",
};

const PRIORITY_TOKENS: Record<string, TaskPriority> = {
  "!high": "high",
  "!h": "high",
  "!medium": "medium",
  "!med": "medium",
  "!m": "medium",
  "!low": "low",
  "!l": "low",
};

/** Hour used when a date is given without a time (keeps it within that day). */
const DEFAULT_HOUR = 9;

/** Strips trailing punctuation used for matching but not for the title. */
function clean(token: string): string {
  return token.replace(/[.,;:]+$/, "").toLowerCase();
}

function parseTime(token: string): { h: number; m: number } | null {
  let match = /^(\d{1,2})(?::(\d{2}))?(am|pm)$/.exec(token);
  if (match) {
    let hours = Number(match[1]);
    const minutes = match[2] ? Number(match[2]) : 0;
    if (hours < 1 || hours > 12 || minutes > 59) return null;
    if (match[3] === "pm" && hours !== 12) hours += 12;
    if (match[3] === "am" && hours === 12) hours = 0;
    return { h: hours, m: minutes };
  }
  match = /^(\d{1,2}):(\d{2})$/.exec(token);
  if (match) {
    const hours = Number(match[1]);
    const minutes = Number(match[2]);
    if (hours > 23 || minutes > 59) return null;
    return { h: hours, m: minutes };
  }
  return null;
}

/** Next occurrence of `target` weekday, strictly after `todayStartMs`. */
function nextWeekday(todayStartMs: number, target: number): number {
  const current = new Date(todayStartMs).getDay();
  let delta = (target - current + 7) % 7;
  if (delta === 0) delta = 7;
  return addDays(new Date(todayStartMs), delta).getTime();
}

function startOfDayMs(ms: number): number {
  return startOfDay(new Date(ms)).getTime();
}

/** "days" → "day", "week" → "week". */
function singularize(token: string): string {
  return token.endsWith("s") ? token.slice(0, -1) : token;
}

export function parseQuickAdd(input: string, nowMs: number): ParsedTask {
  // `@"deep work"` must survive the split, so quoted tokens are matched first.
  const tokens = input.trim().match(/@"[^"]*"|\S+/g) ?? [];
  const titleWords: string[] = [];
  const tagNames: string[] = [];
  const seenTags = new Set<string>();
  let priority: TaskPriority = "none";
  let recurrence = "";
  let projectName = "";
  let projectToken = "";
  let dateMs = 0;
  let hours: number | null = null;
  let minutes = 0;
  let hasTime = false;

  const now = new Date(nowMs);
  const todayStart = startOfDayMs(nowMs);

  const setDate = (ms: number) => {
    dateMs = startOfDayMs(ms);
  };
  const setTime = (h: number, m: number) => {
    hours = h;
    minutes = m;
    hasTime = true;
  };

  for (let i = 0; i < tokens.length; i++) {
    const raw = tokens[i];
    if (raw === undefined) continue;
    const token = clean(raw);

    const priorityToken = PRIORITY_TOKENS[token];
    if (priorityToken) {
      priority = priorityToken;
      continue;
    }

    const tagCandidate = raw.replace(/[.,;:]+$/, "");
    if (/^#[A-Za-z0-9_-]+$/.test(tagCandidate)) {
      const name = tagCandidate.slice(1);
      const key = name.toLowerCase();
      if (!seenTags.has(key)) {
        seenTags.add(key);
        tagNames.push(name);
      }
      continue;
    }

    // @project or @"multi word project" (last one wins)
    const projectCandidate = raw.replace(/[.,;:]+$/, "");
    if (projectCandidate.startsWith("@")) {
      const quoted = /^@"([^"]+)"$/.exec(projectCandidate);
      if (quoted) {
        projectName = quoted[1]?.trim() ?? "";
        projectToken = projectCandidate;
        continue;
      }
      if (/^@[A-Za-z0-9_-]+$/.test(projectCandidate)) {
        projectName = projectCandidate.slice(1);
        projectToken = projectCandidate;
        continue;
      }
    }

    // "every [N] day|week|month|year"
    if ((token === "every" || token === "each") && i + 1 < tokens.length) {
      let j = i + 1;
      let count = 1;
      const maybeCount = clean(tokens[j] ?? "");
      if (/^\d+$/.test(maybeCount)) {
        count = Number(maybeCount);
        j++;
      }
      if (count >= 1 && count <= 999 && j < tokens.length) {
        const unit = singularize(clean(tokens[j] ?? ""));
        const freq = UNIT_TO_FREQ[unit];
        if (freq) {
          recurrence = formatRecurrence({ freq, interval: count });
          i = j;
          continue;
        }
      }
    }

    // "daily" / "weekly" / "monthly" / "yearly"
    const freqWord = FREQ_WORDS[token];
    if (freqWord !== undefined) {
      recurrence = formatRecurrence({ freq: freqWord, interval: 1 });
      continue;
    }

    // "next <weekday|week|month>"
    if (token === "next" && i + 1 < tokens.length) {
      const nextToken = clean(tokens[i + 1] ?? "");
      const weekday = WEEKDAYS[nextToken];
      if (weekday !== undefined) {
        setDate(nextWeekday(todayStart, weekday));
        i++;
        continue;
      }
      if (nextToken === "week") {
        setDate(addDays(new Date(todayStart), 7).getTime());
        i++;
        continue;
      }
      if (nextToken === "month") {
        setDate(addMonths(new Date(todayStart), 1).getTime());
        i++;
        continue;
      }
    }

    // "in N days|weeks|months"
    if (token === "in" && i + 2 < tokens.length) {
      const amount = Number(tokens[i + 1]);
      const unitRaw = clean(tokens[i + 2] ?? "");
      const unit = unitRaw.endsWith("s") ? unitRaw.slice(0, -1) : unitRaw;
      if (Number.isInteger(amount) && amount > 0) {
        if (unit === "day") {
          setDate(addDays(new Date(todayStart), amount).getTime());
          i += 2;
          continue;
        }
        if (unit === "week") {
          setDate(addDays(new Date(todayStart), amount * 7).getTime());
          i += 2;
          continue;
        }
        if (unit === "month") {
          setDate(addMonths(new Date(todayStart), amount).getTime());
          i += 2;
          continue;
        }
      }
    }

    const weekday = WEEKDAYS[token];
    if (weekday !== undefined) {
      setDate(nextWeekday(todayStart, weekday));
      continue;
    }

    if (token === "today") {
      setDate(todayStart);
      continue;
    }
    if (token === "tomorrow" || token === "tmr" || token === "tmrw") {
      setDate(addDays(new Date(todayStart), 1).getTime());
      continue;
    }
    if (token === "tonight") {
      setDate(todayStart);
      setTime(21, 0);
      continue;
    }
    if (token === "noon") {
      setDate(dateMs > 0 ? dateMs : todayStart);
      setTime(12, 0);
      continue;
    }
    if (token === "midnight") {
      setDate(dateMs > 0 ? dateMs : todayStart);
      setTime(0, 0);
      continue;
    }

    // ISO date: YYYY-MM-DD
    let match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(token);
    if (match) {
      const candidate = new Date(Number(match[1]), Number(match[2]) - 1, Number(match[3]));
      if (!Number.isNaN(candidate.getTime())) setDate(candidate.getTime());
      continue;
    }

    // M/D or M/D/YYYY
    match = /^(\d{1,2})\/(\d{1,2})(?:\/(\d{4}))?$/.exec(token);
    if (match) {
      const month = Number(match[1]);
      const day = Number(match[2]);
      if (month >= 1 && month <= 12 && day >= 1 && day <= 31) {
        const year = match[3] ? Number(match[3]) : now.getFullYear();
        let candidate = new Date(year, month - 1, day);
        if (!match[3] && candidate.getTime() < todayStart) {
          candidate = new Date(year + 1, month - 1, day);
        }
        setDate(candidate.getTime());
      }
      continue;
    }

    // "november 1"
    const month = MONTHS[token];
    if (month !== undefined && i + 1 < tokens.length) {
      const day = Number(clean(tokens[i + 1] ?? ""));
      if (Number.isInteger(day) && day >= 1 && day <= 31) {
        let candidate = new Date(now.getFullYear(), month, day);
        if (candidate.getTime() < todayStart) {
          candidate = new Date(now.getFullYear() + 1, month, day);
        }
        setDate(candidate.getTime());
        i++;
        continue;
      }
    }

    const time = parseTime(token);
    if (time) {
      setTime(time.h, time.m);
      continue;
    }
    if (token === "at" && i + 1 < tokens.length) {
      const nextTime = parseTime(clean(tokens[i + 1] ?? ""));
      if (nextTime) {
        setTime(nextTime.h, nextTime.m);
        i++;
        continue;
      }
    }

    titleWords.push(raw);
  }

  let dueAt = 0;
  if (dateMs > 0 || hasTime) {
    const base = new Date(dateMs > 0 ? dateMs : todayStart);
    const combined = setSeconds(
      setMinutes(setHours(base, hours ?? DEFAULT_HOUR), minutes),
      0,
    );
    dueAt = combined.getTime();
  }

  const title = titleWords.join(" ").trim();
  return {
    title: title || input.trim(),
    dueAt,
    hasTime,
    priority,
    tagNames,
    recurrence,
    projectName,
    projectToken,
  };
}
