"use client";

import { useState, type FormEvent } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import type { LucideIcon } from "lucide-react";
import {
  BarChart3,
  Calendar,
  CheckCircle2,
  Circle,
  Clock,
  Inbox,
  Pencil,
  Plus,
  Star,
  Trash2,
} from "lucide-react";
import { cn } from "cn";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import useAppStore, { type View } from "@/store/appStore";
import { useProjects } from "@/features/projects/useProjects";
import { useTags } from "@/features/tags/useTags";
import { createProject } from "@/db/projectRepository";
import { createTag, deleteTag } from "@/db/tagRepository";
import { notifyError, toUserMessage } from "@/lib/errors";
import { PROJECT_ICON_MAP } from "@/lib/projectIcons";
import { t } from "@/lib/i18n";
import { ProjectEditDialog } from "@/features/projects/components/ProjectEditDialog";
import { TagEditDialog } from "@/features/tags/components/TagEditDialog";
import type { Project, Tag } from "@/types";

const views: ReadonlyArray<{ id: View; labelKey: Parameters<typeof t>[0]; icon: LucideIcon }> = [
  { id: "inbox", labelKey: "viewInbox", icon: Inbox },
  { id: "today", labelKey: "viewToday", icon: Calendar },
  { id: "upcoming", labelKey: "viewUpcoming", icon: Clock },
  { id: "overdue", labelKey: "viewOverdue", icon: Circle },
  { id: "completed", labelKey: "viewCompleted", icon: CheckCircle2 },
  { id: "important", labelKey: "viewImportant", icon: Star },
  { id: "trash", labelKey: "viewTrash", icon: Trash2 },
];

/**
 * Depth-first flatten of the project tree: roots first, each child directly
 * after its parent so indentation reads as nesting. A project whose parent no
 * longer exists is treated as a root (deleting a parent must not hide children).
 */
function buildTree(projects: Project[]): Array<{ project: Project; depth: number }> {
  const byId = new Map(projects.map((p) => [p.id, p]));
  const roots = projects.filter((p) => p.parentId === "" || !byId.has(p.parentId));
  const ordered: Array<{ project: Project; depth: number }> = [];
  const visit = (parent: Project, depth: number) => {
    ordered.push({ project: parent, depth });
    for (const child of projects.filter((p) => p.parentId === parent.id)) {
      visit(child, depth + 1);
    }
  };
  for (const root of roots) visit(root, 0);
  return ordered;
}

/** A project's icon when one is set, otherwise a colored dot. */
function ProjectGlyph({ project }: { project: Project }) {
  const Icon = PROJECT_ICON_MAP[project.icon];
  if (Icon) {
    return (
      <Icon
        className="size-4 shrink-0"
        style={project.color ? { color: project.color } : undefined}
        aria-hidden="true"
      />
    );
  }
  return (
    <span
      className="size-2 shrink-0 rounded-full"
      style={{ backgroundColor: project.color || "var(--primary)" }}
      aria-hidden="true"
    />
  );
}

export function Sidebar() {
  const activeView = useAppStore((s) => s.activeView);
  const setActiveView = useAppStore((s) => s.setActiveView);
  const selectedProjectId = useAppStore((s) => s.selectedProjectId);
  const setSelectedProjectId = useAppStore((s) => s.setSelectedProjectId);
  const filters = useAppStore((s) => s.filters);
  const setFilters = useAppStore((s) => s.setFilters);
  const projects = useProjects();
  const tags = useTags();
  const pathname = usePathname();
  const router = useRouter();
  const onStats = pathname === "/stats";

  /** Leaving the statistics route (or any other route) returns to the task view. */
  function goHome() {
    if (pathname !== "/") router.push("/");
  }

  const [showProjectInput, setShowProjectInput] = useState(false);
  const [projectName, setProjectName] = useState("");
  const [showTagInput, setShowTagInput] = useState(false);
  const [tagName, setTagName] = useState("");
  const [editProject, setEditProject] = useState<Project | null>(null);
  const [editTag, setEditTag] = useState<Tag | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function handleProjectSubmit(event: FormEvent) {
    event.preventDefault();
    const name = projectName.trim();
    if (!name) return;
    try {
      await createProject({ name });
      setProjectName("");
      setShowProjectInput(false);
      setError(null);
    } catch (caught) {
      setError(toUserMessage(caught));
    }
  }

  async function handleTagSubmit(event: FormEvent) {
    event.preventDefault();
    const name = tagName.trim();
    if (!name) return;
    try {
      await createTag({ name });
      setTagName("");
      setShowTagInput(false);
      setError(null);
    } catch (caught) {
      setError(toUserMessage(caught));
    }
  }

  function toggleTagFilter(tagId: string) {
    const current = filters.tagIds ?? [];
    const next = current.includes(tagId)
      ? current.filter((id) => id !== tagId)
      : [...current, tagId];
    setFilters(next.length > 0 ? { ...filters, tagIds: next } : {});
  }

  const orderedProjects = projects ? buildTree(projects) : [];
  const activeTagIds = filters.tagIds ?? [];

  return (
    <aside className="flex h-full w-64 flex-col gap-1 overflow-y-auto border-r bg-muted/30 p-4">
      <nav aria-label={t("navViews")} className="flex flex-col gap-1">
        {views.map(({ id, labelKey, icon: Icon }) => (
          <button
            key={id}
            type="button"
            onClick={() => {
              goHome();
              setActiveView(id);
              setSelectedProjectId(null);
            }}
            className={cn(
              "hover:bg-accent focus-visible:bg-accent flex items-center gap-2 rounded-md px-2 py-1.5 text-sm transition-colors focus-visible:outline-none",
              !onStats &&
                activeView === id &&
                selectedProjectId === null &&
                "bg-accent font-medium",
            )}
          >
            <Icon className="size-4" aria-hidden="true" />
            {t(labelKey)}
          </button>
        ))}

        <Link
          href="/stats"
          className={cn(
            "hover:bg-accent focus-visible:bg-accent flex items-center gap-2 rounded-md px-2 py-1.5 text-sm transition-colors focus-visible:outline-none",
            onStats && "bg-accent font-medium",
          )}
        >
          <BarChart3 className="size-4" aria-hidden="true" />
          {t("navStatistics")}
        </Link>
      </nav>

      <section className="mt-5" aria-label={t("projects")}>
        <div className="mb-2 flex items-center justify-between">
          <h2 className="text-muted-foreground text-xs font-semibold uppercase tracking-wide">
            {t("projects")}
          </h2>
          <Button
            type="button"
            variant="ghost"
            size="icon-xs"
            aria-label={t("addProject")}
            onClick={() => setShowProjectInput((v) => !v)}
          >
            <Plus aria-hidden="true" />
          </Button>
        </div>

        {showProjectInput ? (
          <form onSubmit={handleProjectSubmit} className="mb-2 flex gap-1">
            <Input
              value={projectName}
              onChange={(e) => setProjectName(e.target.value)}
              placeholder={t("newProjectPlaceholder")}
              aria-label={t("newProjectPlaceholder")}
              className="h-7 text-xs"
              autoFocus
            />
            <Button type="submit" size="xs" aria-label={t("addProject")}>
              {t("addProject")}
            </Button>
          </form>
        ) : null}

        <div className="flex flex-col gap-1">
          {orderedProjects.length === 0 ? (
            <p className="text-muted-foreground px-2 text-xs">{t("noProjects")}</p>
          ) : (
            orderedProjects.map(({ project: p, depth }) => (
              <div
                key={p.id}
                style={{ paddingLeft: `${0.5 + depth * 0.75}rem` }}
                className={cn(
                  "group hover:bg-accent flex items-center gap-1 rounded-md pr-2 py-1.5 text-sm transition-colors",
                  selectedProjectId === p.id && "bg-accent font-medium",
                )}
              >
                <button
                  type="button"
                  onClick={() => {
                    goHome();
                    setSelectedProjectId(p.id);
                    setActiveView("inbox");
                  }}
                  className="flex min-w-0 flex-1 items-center gap-2 text-left focus-visible:outline-none"
                >
                  <ProjectGlyph project={p} />
                  <span className="truncate">{p.name}</span>
                </button>
                <button
                  type="button"
                  onClick={() => setEditProject(p)}
                  aria-label={t("editProjectAria", { name: p.name })}
                  className="opacity-0 transition-opacity group-hover:opacity-100 focus-visible:opacity-100"
                >
                  <Pencil className="size-3" aria-hidden="true" />
                </button>
              </div>
            ))
          )}
        </div>
      </section>

      <section className="mt-5" aria-label={t("tags")}>
        <div className="mb-2 flex items-center justify-between">
          <h2 className="text-muted-foreground text-xs font-semibold uppercase tracking-wide">
            {t("tags")}
          </h2>
          <Button
            type="button"
            variant="ghost"
            size="icon-xs"
            aria-label={t("addTag")}
            onClick={() => setShowTagInput((v) => !v)}
          >
            <Plus aria-hidden="true" />
          </Button>
        </div>

        {showTagInput ? (
          <form onSubmit={handleTagSubmit} className="mb-2 flex gap-1">
            <Input
              value={tagName}
              onChange={(e) => setTagName(e.target.value)}
              placeholder={t("newTagPlaceholder")}
              aria-label={t("newTagPlaceholder")}
              className="h-7 text-xs"
              autoFocus
            />
            <Button type="submit" size="xs" aria-label={t("addTag")}>
              {t("addTag")}
            </Button>
          </form>
        ) : null}

        <div className="flex flex-col gap-1">
          {tags && tags.length === 0 ? (
            <p className="text-muted-foreground px-2 text-xs">{t("noTags")}</p>
          ) : (
            tags?.map((tag) => (
              <div
                key={tag.id}
                className={cn(
                  "group hover:bg-accent flex items-center gap-2 rounded-md px-2 py-1.5 text-sm transition-colors",
                  activeTagIds.includes(tag.id) && "bg-accent font-medium",
                )}
              >
                <button
                  type="button"
                  onClick={() => toggleTagFilter(tag.id)}
                  aria-pressed={activeTagIds.includes(tag.id)}
                  aria-label={
                    activeTagIds.includes(tag.id)
                      ? t("clearTagFilter")
                      : t("filterByTag", { name: tag.name })
                  }
                  className="flex min-w-0 flex-1 items-center gap-2 text-left focus-visible:outline-none"
                >
                  <span
                    className="size-2 shrink-0 rounded-full"
                    style={{ backgroundColor: tag.color || "var(--muted-foreground)" }}
                    aria-hidden="true"
                  />
                  <span className="truncate">{tag.name}</span>
                </button>
                <button
                  type="button"
                  onClick={() => setEditTag(tag)}
                  aria-label={t("editTagAria", { name: tag.name })}
                  className="opacity-0 transition-opacity group-hover:opacity-100 focus-visible:opacity-100"
                >
                  <Pencil className="size-3" aria-hidden="true" />
                </button>
                <button
                  type="button"
                  onClick={() => void deleteTag(tag.id).catch(notifyError)}
                  aria-label={t("deleteTagAria", { name: tag.name })}
                  className="opacity-0 transition-opacity group-hover:opacity-100 focus-visible:opacity-100"
                >
                  <Trash2 className="size-3" aria-hidden="true" />
                </button>
              </div>
            ))
          )}
        </div>
      </section>

      {error ? (
        <p role="alert" className="text-destructive mt-3 text-xs">
          {error}
        </p>
      ) : null}

      <ProjectEditDialog
        project={editProject}
        open={editProject !== null}
        onOpenChange={(open) => {
          if (!open) setEditProject(null);
        }}
      />
      <TagEditDialog
        tag={editTag}
        open={editTag !== null}
        onOpenChange={(open) => {
          if (!open) setEditTag(null);
        }}
      />
    </aside>
  );
}
