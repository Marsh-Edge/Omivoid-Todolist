import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { getDb, type OmivoidDatabase } from "../index";
import {
  createProject,
  deleteProject,
  getProject,
  listProjects,
  updateProject,
} from "../projectRepository";

describe("projectRepository", () => {
  let db: OmivoidDatabase;

  beforeEach(async () => {
    db = getDb();
    await db.delete();
    await db.open();
  });

  afterEach(async () => {
    if (db.isOpen()) await db.close();
  });

  it("creates a project with sane defaults and trims the name", async () => {
    const p = await createProject({ name: "  Work  " });
    expect(p.name).toBe("Work");
    expect(p.icon).toBe("");
    expect(p.color).toBe("");
    expect(p.parentId).toBe("");
    expect(p.createdAt).toBe(p.updatedAt);
  });

  it("rejects an empty name", async () => {
    await expect(createProject({ name: "   " })).rejects.toThrow(/required/i);
  });

  it("lists projects ordered by their order key", async () => {
    const a = await createProject({ name: "A" });
    const b = await createProject({ name: "B" });
    await updateProject(b.id, { order: a.order - 1 });
    const list = await listProjects();
    expect(list.map((p) => p.name)).toEqual(["B", "A"]);
  });

  it("updates name/icon/color and preserves createdAt", async () => {
    const p = await createProject({ name: "Old" });
    const next = await updateProject(p.id, { name: " New ", icon: "Briefcase", color: "#3b82f6" });
    expect(next.name).toBe("New");
    expect(next.icon).toBe("Briefcase");
    expect(next.color).toBe("#3b82f6");
    expect(next.createdAt).toBe(p.createdAt);
  });

  it("throws when updating a missing project", async () => {
    await expect(updateProject("nope", { name: "x" })).rejects.toThrow(/not found/i);
  });

  it("deletes a project", async () => {
    const p = await createProject({ name: "Gone" });
    await deleteProject(p.id);
    expect(await getProject(p.id)).toBeUndefined();
    expect(await listProjects()).toHaveLength(0);
  });
});
