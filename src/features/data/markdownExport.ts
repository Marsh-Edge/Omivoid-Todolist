import { format } from "date-fns";
import { listActiveTasks } from "@/db/taskRepository";
import { listProjects } from "@/db/projectRepository";
import { listTags } from "@/db/tagRepository";
import { queryTasksForView } from "@/db/taskQueries";
import { recurrenceLabel, t } from "@/lib/i18n";
import useAppStore from "@/store/appStore";
import type { Project, Tag, Task } from "@/types";
import { downloadText, timestampSlug } from "./download";

export interface MarkdownExportOptions {
  /** Title for the exported document */
  title?: string;
  /** Include trashed tasks (default false) */
  includeTrashed?: boolean;
}

function buildChildrenMap(tasks: readonly Task[]): Map<string, Task[]> {
  const map = new Map<string, Task[]>();
  for (const task of tasks) {
    if (task.parentId === "") continue;
    const list = map.get(task.parentId);
    if (list) list.push(task);
    else map.set(task.parentId, [task]);
  }
  for (const list of map.values()) {
    list.sort((a, b) => a.order - b.order);
  }
  return map;
}

function buildTagMap(tags: readonly Tag[]): Map<string, Tag> {
  return new Map(tags.map((tag) => [tag.id, tag]));
}

function priorityLabel(task: Task): string | null {
  if (task.priority === "high") return t("priorityHigh");
  if (task.priority === "medium") return t("priorityMedium");
  if (task.priority === "low") return t("priorityLow");
  return null;
}

function checkbox(task: Task): string {
  return task.status === "done" ? "- [x]" : "- [ ]";
}

function formatDue(task: Task): string | null {
  if (task.dueAt <= 0) return null;
  return format(task.dueAt, "yyyy-MM-dd");
}

function taskMetadata(task: Task, tagMap: Map<string, Tag>): string[] {
  const parts: string[] = [];
  const p = priorityLabel(task);
  if (p) parts.push(p);
  const due = formatDue(task);
  if (due) parts.push(`due ${due}`);
  if (task.recurrence) parts.push(`repeats ${recurrenceLabel(task.recurrence)}`);
  const tags = task.tagIds
    .map((id) => tagMap.get(id))
    .filter((t): t is Tag => Boolean(t))
    .map((t) => `#${t.name.replace(/\s+/g, "-")}`);
  if (tags.length > 0) parts.push(tags.join(" "));
  return parts;
}

function indentLines(text: string, indent: number): string {
  if (!text) return "";
  const spaces = " ".repeat(indent);
  return text
    .split("\n")
    .map((line) => spaces + line)
    .join("\n");
}

export function tasksToMarkdown(
  tasks: readonly Task[],
  projects: readonly Project[],
  tags: readonly Tag[],
  options: MarkdownExportOptions = {},
): string {
  const title = options.title ?? "Omivoid tasks";
  const exportedAt = format(Date.now(), "yyyy-MM-dd");
  const tagMap = buildTagMap(tags);
  const childrenMap = buildChildrenMap(tasks);
  const lines: string[] = [];
  lines.push(`# ${title}`);
  lines.push("");
  lines.push(`_Exported ${exportedAt} · ${tasks.length} tasks_`);
  lines.push("");

  const sortedProjects = [...projects].sort((a, b) => a.order - b.order || a.name.localeCompare(b.name));

  // Group: Inbox first
  const inboxTasks = tasks.filter((t) => t.parentId === "" && t.projectId === "");
  if (inboxTasks.length > 0) {
    lines.push("## Inbox");
    lines.push("");
    for (const task of inboxTasks) {
      writeTask(task, 0, lines, tasks, childrenMap, tagMap);
    }
  }

  for (const project of sortedProjects) {
    const projectTasks = tasks.filter((t) => t.parentId === "" && t.projectId === project.id);
    if (projectTasks.length === 0) continue;
    lines.push(`## ${project.name}`);
    lines.push("");
    for (const task of projectTasks) {
      writeTask(task, 0, lines, tasks, childrenMap, tagMap);
    }
  }

  // Unassigned projects (referenced but not in list) → treat as No project
  const known = new Set(projects.map((p) => p.id));
  const noProjectTasks = tasks.filter((t) => t.parentId === "" && t.projectId !== "" && !known.has(t.projectId));
  if (noProjectTasks.length > 0) {
    lines.push("## No project");
    lines.push("");
    for (const task of noProjectTasks) {
      writeTask(task, 0, lines, tasks, childrenMap, tagMap);
    }
  }

  return lines.join("\n");
}

function writeTask(
  task: Task,
  depth: number,
  lines: string[],
  tasks: readonly Task[],
  childrenMap: Map<string, Task[]>,
  tagMap: Map<string, Tag>,
): void {
  const indent = depth * 4;
  const meta = taskMetadata(task, tagMap);
  const metaStr = meta.length > 0 ? `  _(${meta.join(" · ")})_` : "";
  const taskLine = `${checkbox(task)} ${task.title}${metaStr}`;
  lines.push(indentLines(taskLine, indent));
  if (task.notes.trim()) {
    const noteLines = task.notes.trimEnd().split("\n");
    for (const nl of noteLines) {
      lines.push(indentLines(nl, indent + 4));
    }
  }
  const children = childrenMap.get(task.id) || [];
  for (const child of children) {
    writeTask(child, depth + 1, lines, tasks, childrenMap, tagMap);
  }
}

export async function exportTasksAsMarkdown(scope: "view" | "all"): Promise<number> {
  const [projects, tags] = await Promise.all([listProjects(), listTags()]);
  let tasks: Task[] = [];

  if (scope === "all") {
    tasks = await listActiveTasks();
  } else {
    const s = useAppStore.getState();
    const matched = await queryTasksForView(s.activeView, {
      projectId: s.selectedProjectId ?? undefined,
      search: s.searchQuery,
      filters: s.filters,
    });
    const matchedIds = new Set(matched.map((t) => t.id));
    const all = await listActiveTasks();
    // include matched + descendants
    const byId = new Map(all.map((t) => [t.id, t]));
    const included = new Set<Task>();
    for (const t of all) {
      // check if t or any ancestor is matched
      let cur: Task | undefined = t;
      while (cur) {
        if (matchedIds.has(cur.id)) {
          included.add(t);
          break;
        }
        if (cur.parentId === "") break;
        cur = byId.get(cur.parentId);
      }
    }
    tasks = Array.from(included);
    // if nothing matched, just use matched set (shouldn't happen)
    if (tasks.length === 0) tasks = matched;
  }

  const md = tasksToMarkdown(tasks, projects, tags, { title: scope === "view" ? "Omivoid tasks — current view" : "Omivoid tasks — all" });
  downloadText(
    `omivoid-tasks-${scope}-${timestampSlug(Date.now())}.md`,
    md,
    "text/markdown",
  );
  return tasks.length;
}



