/**
 * Generates a synthetic Omivoid data set as a valid backup JSON file.
 *
 * Why a backup file instead of writing IndexedDB directly? IndexedDB only
 * exists in the renderer (browser / Electron), not in Node, and Dexie needs
 * that origin-bound database. Producing the app's own export format instead
 * means the data flows through the *same* Zod-validated import path the user
 * already has — no schema drift is possible.
 *
 * Usage (Node 20+):
 *   node scripts/seed.mjs                 # 100 tasks (default)
 *   node scripts/seed.mjs --count 1000    # 1000 tasks
 *   node scripts/seed.mjs --out my.json
 *
 * Then, in the app: Command palette (Ctrl/Cmd+K) → "Import data (JSON)" and
 * pick the generated file. Import replaces all current data.
 */

import { randomUUID } from "node:crypto";
import { writeFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const BACKUP_VERSION = 1;
const HOUR = 3600 * 1000;
const DAY = 24 * HOUR;

const PRESET_COLORS = [
  "#ef4444",
  "#f97316",
  "#f59e0b",
  "#22c55e",
  "#14b8a6",
  "#06b6d4",
  "#3b82f6",
  "#6366f1",
  "#8b5cf6",
  "#ec4899",
];

const PRIORITIES = ["none", "low", "medium", "high"];
const VERBS = [
  "Draft",
  "Review",
  "Ship",
  "Plan",
  "Fix",
  "Research",
  "Write",
  "Call",
  "Email",
  "Test",
  "Prepare",
  "Book",
  "Update",
  "Send",
  "Migrate",
];
const NOUNS = [
  "the report",
  "the launch",
  "the design",
  "the budget",
  "the roadmap",
  "the release notes",
  "the docs",
  "the migration",
  "the session",
  "the invoice",
  "the onboarding flow",
  "the sprint board",
  "the changelog",
  "the retro notes",
  "the support inbox",
];

/**
 * Builds a readable, varied task title. The verb and the noun are picked with
 * a coprime stride so consecutive tasks never read like a numbered list.
 */
function buildTitle(i) {
  const verb = VERBS[i % VERBS.length];
  const noun = NOUNS[(i * 7 + Math.floor(i / NOUNS.length)) % NOUNS.length];
  return `${verb} ${noun}`;
}

function parseArgs(argv) {
  const options = { count: 100, out: "omivoid-seed.json" };
  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    if (arg === "--count" || arg === "-n") {
      options.count = Number.parseInt(argv[++i], 10);
    } else if (arg.startsWith("--count=")) {
      options.count = Number.parseInt(arg.slice("--count=".length), 10);
    } else if (arg === "--out" || arg === "-o") {
      options.out = argv[++i];
    } else if (arg.startsWith("--out=")) {
      options.out = arg.slice("--out=".length);
    } else if (arg === "--help" || arg === "-h") {
      options.help = true;
    }
  }
  return options;
}

function buildTags(now) {
  const names = ["work", "home", "urgent", "idea", "health", "finance", "reading", "travel"];
  return names.map((name, i) => ({
    id: randomUUID(),
    name,
    color: PRESET_COLORS[i % PRESET_COLORS.length],
    createdAt: now - (names.length - i) * DAY,
  }));
}

function buildProjects(now) {
  const defs = [
    { name: "Work", icon: "Briefcase" },
    { name: "Personal", icon: "Home" },
    { name: "Learning", icon: "BookOpen" },
    { name: "Side project", icon: "Code" },
    { name: "Errands", icon: "ShoppingCart" },
    { name: "Health", icon: "Dumbbell" },
  ];
  return defs.map((def, i) => ({
    id: randomUUID(),
    name: def.name,
    icon: def.icon,
    color: PRESET_COLORS[i % PRESET_COLORS.length],
    parentId: "",
    order: now + i,
    createdAt: now - (defs.length - i) * DAY,
    updatedAt: now - (defs.length - i) * DAY,
  }));
}

function buildTasks(count, projects, tags, now) {
  const base = now - 90 * DAY;
  const tasks = [];
  const topLevelIds = [];

  for (let i = 0; i < count; i++) {
    const isSubtask = topLevelIds.length > 0 && i % 9 === 8;
    const done = i % 5 === 0;
    const status = done ? "done" : i % 3 === 0 ? "in_progress" : "todo";

    let dueAt = 0;
    if (!isSubtask) {
      if (i % 7 === 0) dueAt = now - (i % 6) * DAY; // some overdue / recent
      else if (i % 5 === 0) dueAt = now + (i % 4) * HOUR; // later today-ish
      else if (i % 11 === 0) dueAt = now + (i % 14) * DAY; // upcoming
    }

    let recurrence = "";
    if (i % 17 === 0) recurrence = "weekly";
    else if (i % 23 === 0) recurrence = "daily";

    const tagIds = tags
      .filter((_, ti) => (i + ti) % 3 === 0)
      .slice(0, 3)
      .map((tag) => tag.id);

    const createdAt = base + i * HOUR;
    const title = buildTitle(i);
    tasks.push({
      id: randomUUID(),
      title,
      notes: i % 6 === 0 ? `Notes for **${title}**.\n\n- first point\n- second point` : "",
      status,
      priority: PRIORITIES[i % PRIORITIES.length],
      projectId: isSubtask ? "" : i % 4 === 0 ? "" : projects[i % projects.length].id,
      parentId: isSubtask ? topLevelIds[topLevelIds.length - 1] : "",
      tagIds,
      dueAt,
      recurrence,
      completedAt: done ? createdAt + 2 * HOUR : 0,
      deletedAt: i % 33 === 0 ? now - DAY : 0,
      order: now + i,
      createdAt,
      updatedAt: createdAt,
    });

    if (!isSubtask) topLevelIds.push(tasks[tasks.length - 1].id);
  }

  return tasks;
}

function main() {
  const options = parseArgs(process.argv.slice(2));
  if (options.help) {
    console.log("Usage: node scripts/seed.mjs [--count N] [--out file.json]");
    return;
  }
  if (!Number.isInteger(options.count) || options.count < 1) {
    console.error("[seed] --count must be a positive integer");
    process.exitCode = 1;
    return;
  }

  const now = Date.now();
  const tags = buildTags(now);
  const projects = buildProjects(now);
  const tasks = buildTasks(options.count, projects, tags, now);

  const backup = { version: BACKUP_VERSION, exportedAt: now, tasks, projects, tags };
  const outPath = path.isAbsolute(options.out)
    ? options.out
    : path.join(path.dirname(fileURLToPath(import.meta.url)), "..", options.out);

  writeFileSync(outPath, JSON.stringify(backup, null, 2), "utf8");

  console.log(
    `[seed] wrote ${outPath}\n` +
      `[seed] ${tasks.length} tasks, ${projects.length} projects, ${tags.length} tags\n` +
      `[seed] import it in the app: Ctrl/Cmd+K → "Import data (JSON)"`,
  );
}

main();
