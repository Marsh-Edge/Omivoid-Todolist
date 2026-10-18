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
import { updateTag } from "@/db/tagRepository";
import { toUserMessage } from "@/lib/errors";
import { t } from "@/lib/i18n";
import type { Tag } from "@/types";

/** Edit an existing tag's name and color. */
export function TagEditDialog({
  tag,
  open,
  onOpenChange,
}: {
  tag: Tag | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const [name, setName] = useState("");
  const [color, setColor] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!open || !tag) return;
    const timer = window.setTimeout(() => {
      setName(tag.name);
      setColor(tag.color);
      setError(null);
    }, 0);
    return () => window.clearTimeout(timer);
  }, [open, tag]);

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    if (!tag) return;
    const trimmed = name.trim();
    if (!trimmed) {
      setError(t("nameRequired"));
      return;
    }
    setSaving(true);
    setError(null);
    try {
      await updateTag(tag.id, { name: trimmed, color });
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
          <DialogTitle>{t("editTag")}</DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="flex flex-col gap-3">
          <div className="flex flex-col gap-1.5">
            <label htmlFor="tag-name" className="text-xs font-medium">
              {t("nameLabel")}
            </label>
            <Input
              id="tag-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              aria-label={t("nameLabel")}
              aria-invalid={error !== null}
              autoFocus
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
