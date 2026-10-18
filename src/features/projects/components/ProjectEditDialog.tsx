"use client";

import { useEffect, useState, type FormEvent } from "react";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ColorSwatches } from "@/components/ui/color-swatches";
import { updateProject } from "@/db/projectRepository";
import { toUserMessage } from "@/lib/errors";
import { t } from "@/lib/i18n";
import type { Project } from "@/types";
import { IconPicker } from "./IconPicker";

/** Edit an existing project's name, icon and color. */
export function ProjectEditDialog({
  project,
  open,
  onOpenChange,
}: {
  project: Project | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const [name, setName] = useState("");
  const [icon, setIcon] = useState("");
  const [color, setColor] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!open || !project) return;
    const timer = window.setTimeout(() => {
      setName(project.name);
      setIcon(project.icon);
      setColor(project.color);
      setError(null);
    }, 0);
    return () => window.clearTimeout(timer);
  }, [open, project]);

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    if (!project) return;
    const trimmed = name.trim();
    if (!trimmed) {
      setError(t("nameRequired"));
      return;
    }
    setSaving(true);
    setError(null);
    try {
      await updateProject(project.id, { name: trimmed, icon, color });
      onOpenChange(false);
    } catch (caught) {
      setError(toUserMessage(caught));
    } finally {
      setSaving(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-sm">
        <DialogHeader>
          <DialogTitle>{t("editProject")}</DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="flex flex-col gap-3">
          <div className="flex flex-col gap-1.5">
            <label htmlFor="project-name" className="text-xs font-medium">
              {t("nameLabel")}
            </label>
            <Input
              id="project-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              aria-label={t("nameLabel")}
              aria-invalid={error !== null}
              autoFocus
            />
          </div>

          <div className="flex flex-col gap-1.5">
            <span className="text-xs font-medium">{t("iconLabel")}</span>
            <IconPicker
              value={icon}
              onChange={setIcon}
              ariaLabel={t("iconLabel")}
              noneLabel={t("iconNone")}
            />
          </div>

          <div className="flex flex-col gap-1.5">
            <span className="text-xs font-medium">{t("colorLabel")}</span>
            <ColorSwatches
              value={color}
              onChange={setColor}
              ariaLabel={t("colorLabel")}
              defaultLabel={t("colorDefault")}
            />
          </div>

          {error ? (
            <p role="alert" className="text-destructive text-sm">
              {error}
            </p>
          ) : null}

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
            >
              {t("cancel")}
            </Button>
            <Button type="submit" disabled={saving}>
              {t("save")}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
