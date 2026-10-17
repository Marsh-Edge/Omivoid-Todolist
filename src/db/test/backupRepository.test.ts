import { describe, it, expect, beforeEach, afterEach } from "vitest";
import {
  exportBackup,
  importBackup,
  parseBackupText,
  serializeBackup,
  BACKUP_VERSION,
} from "../backupRepository";
import { createTask, listActiveTasks } from "../taskRepository";
import { createProject, listProjects } from "../projectRepository";
import { createTag, listTags } from "../tagRepository";
import { createSavedFilter, listSavedFilters } from "../savedFilterRepository";
import { OmivoidDatabase, getDb } from "../index";

describe("backupRepository", () => {
  let db: OmivoidDatabase;

  beforeEach(async () => {
    db = getDb();
    await db.delete();
    await db.open();
  });

  afterEach(async () => {
    if (db.isOpen()) await db.close();
  });

  it("round-trips all data through JSON", async () => {
    const project = await createProject({ name: "Work" });
    const tag = await createTag({ name: "urgent" });
    await createTask({ title: "Ship it", projectId: project.id, tagIds: [tag.id] });
    await createSavedFilter({ name: "High + urgent", filters: { priority: ["high"], tagIds: [tag.id] } });

    const backup = await exportBackup();
    expect(backup.version).toBe(BACKUP_VERSION);
    expect(backup.tasks).toHaveLength(1);
    expect(backup.savedFilters).toHaveLength(1);

    const text = serializeBackup(backup);
    const parsed = parseBackupText(text);

    await db.tasks.clear();
    await db.projects.clear();
    await db.tags.clear();
    await db.savedFilters.clear();
    const result = await importBackup(parsed);

    expect(result).toEqual({ tasks: 1, projects: 1, tags: 1, savedFilters: 1 });
    expect(await listActiveTasks()).toHaveLength(1);
    expect(await listProjects()).toHaveLength(1);
    expect(await listTags()).toHaveLength(1);
    expect(await listSavedFilters()).toHaveLength(1);
  });

  it("imports a legacy backup that has no savedFilters field", async () => {
    await createTask({ title: "Keep" });
    const parsed = parseBackupText(
      JSON.stringify({
        version: BACKUP_VERSION,
        exportedAt: 1,
        tasks: [],
        projects: [],
        tags: [],
      }),
    );
    expect(parsed.savedFilters).toEqual([]);
    const result = await importBackup(parsed);
    expect(result.savedFilters).toBe(0);
  });

  it("imports legacy tasks that predate the recurrence field", async () => {
    const task = await createTask({ title: "Legacy" });
    // Simulate a pre-v4 backup by dropping the field entirely.
    const legacyTask: Record<string, unknown> = { ...task };
    delete legacyTask.recurrence;
    const parsed = parseBackupText(
      JSON.stringify({
        version: BACKUP_VERSION,
        exportedAt: 1,
        tasks: [legacyTask],
        projects: [],
        tags: [],
      }),
    );
    expect(parsed.tasks[0]?.recurrence).toBe("");
  });

  it("rejects invalid JSON text", () => {
    expect(() => parseBackupText("not json")).toThrow();
  });

  it("rejects a payload with the wrong shape", () => {
    expect(() => parseBackupText(JSON.stringify({ version: 1, tasks: "nope" }))).toThrow();
  });

  it("replaces existing data on import", async () => {
    await createTask({ title: "Old task" });
    const backup = {
      version: BACKUP_VERSION,
      exportedAt: 1,
      tasks: [],
      projects: [],
      tags: [],
    };
    await importBackup(backup);
    expect(await listActiveTasks()).toHaveLength(0);
  });
});
