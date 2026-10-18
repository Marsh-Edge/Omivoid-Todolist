import { getDb } from "./index";
import { projectSchema } from "./schemas";
import { recordHistory, projectRow } from "./history";
import type { Project } from "@/types";

function now(): number {
  return Date.now();
}

function newId(): string {
  return crypto.randomUUID();
}

export async function createProject(input: { name: string; icon?: string; color?: string; parentId?: string }): Promise<Project> {
  const name = input.name.trim();
  if (!name) {
    throw new Error("Project name is required");
  }
  const timestamp = now();
  const project: Project = projectSchema.parse({
    id: newId(),
    name,
    icon: input.icon ?? "",
    color: input.color ?? "",
    parentId: input.parentId ?? "",
    order: timestamp,
    createdAt: timestamp,
    updatedAt: timestamp,
  } satisfies Project);
  await getDb().projects.add(project);
  recordHistory({ label: "undoCreateProject", changes: [projectRow(null, project)] });
  return project;
}

export async function listProjects(): Promise<Project[]> {
  return getDb().projects.orderBy("order").toArray();
}

export async function getProject(id: string): Promise<Project | undefined> {
  return getDb().projects.get(id);
}

export async function updateProject(id: string, patch: Partial<Pick<Project, "name" | "icon" | "color" | "parentId" | "order">>): Promise<Project> {
  const db = getDb();
  return db.transaction("rw", db.projects, async () => {
    const existing = await db.projects.get(id);
    if (!existing) {
      throw new Error(`Project not found: ${id}`);
    }
    const next = projectSchema.parse({
      ...existing,
      ...patch,
      name: patch.name !== undefined ? patch.name.trim() : existing.name,
      updatedAt: now(),
    } satisfies Project);
    await db.projects.put(next);
    recordHistory({ label: "undoEditProject", changes: [projectRow(existing, next)] });
    return next;
  });
}

export async function deleteProject(id: string): Promise<void> {
  const db = getDb();
  await db.transaction("rw", db.projects, async () => {
    const existing = await db.projects.get(id);
    await db.projects.delete(id);
    if (existing) {
      recordHistory({ label: "undoDeleteProject", changes: [projectRow(existing, null)] });
    }
  });
}
