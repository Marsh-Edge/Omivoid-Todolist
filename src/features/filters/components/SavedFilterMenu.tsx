"use client";

import { useCallback, useState, type FormEvent } from "react";
import { Bookmark, ChevronDown, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useDismissable } from "@/hooks/useDismissable";
import { t } from "@/lib/i18n";
import { toUserMessage } from "@/lib/errors";
import { toast } from "@/store/toastStore";
import useAppStore from "@/store/appStore";
import { createSavedFilter, deleteSavedFilter } from "@/db/savedFilterRepository";
import { useSavedFilters } from "../useSavedFilters";
import type { SavedFilter } from "@/types";

/** Save the current filters as a named preset, apply or delete presets. */
export function SavedFilterMenu() {
  const filters = useAppStore((s) => s.filters);
  const setFilters = useAppStore((s) => s.setFilters);
  const saved = useSavedFilters();
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [error, setError] = useState<string | null>(null);
  const close = useCallback(() => setOpen(false), []);
  const ref = useDismissable<HTMLDivElement>(open, close);

  async function handleSave(event: FormEvent) {
    event.preventDefault();
    const trimmed = name.trim();
    if (!trimmed) {
      setError(t("savedFilterNameRequired"));
      return;
    }
    try {
      await createSavedFilter({ name: trimmed, filters });
      setName("");
      setError(null);
      toast.success(t("savedFilterSaved"));
    } catch (caught) {
      setError(toUserMessage(caught));
    }
  }

  async function handleDelete(id: string) {
    try {
      await deleteSavedFilter(id);
      toast.success(t("savedFilterDeleted"));
    } catch (caught) {
      setError(toUserMessage(caught));
    }
  }

  function apply(filtersToApply: SavedFilter["filters"]) {
    setFilters(filtersToApply);
    close();
  }

  return (
    <div className="relative" ref={ref}>
      <Button
        type="button"
        variant="outline"
        size="sm"
        onClick={() => setOpen((value) => !value)}
        aria-expanded={open}
        aria-label={t("savedFiltersButtonAria")}
        className="gap-1"
      >
        <Bookmark className="size-3.5" aria-hidden="true" />
        <ChevronDown className="size-3" aria-hidden="true" />
      </Button>

      {open ? (
        <div className="bg-popover ring-border absolute right-0 z-50 mt-2 w-[260px] rounded-md p-2 shadow-lg ring-1">
          <p className="text-muted-foreground px-1 pb-1 text-xs font-semibold uppercase tracking-wide">
            {t("savedFiltersTitle")}
          </p>

          <form onSubmit={handleSave} className="mb-2 flex gap-1">
            <Input
              value={name}
              onChange={(event) => setName(event.target.value)}
              placeholder={t("savedFilterNamePlaceholder")}
              aria-label={t("savedFilterNamePlaceholder")}
              className="h-7 text-xs"
            />
            <Button type="submit" size="xs">
              {t("savedFilterSave")}
            </Button>
          </form>

          {error ? (
            <p role="alert" className="text-destructive px-1 pb-1 text-xs">
              {error}
            </p>
          ) : null}

          {saved && saved.length === 0 ? (
            <p className="text-muted-foreground px-1 py-1 text-xs">{t("savedFiltersEmpty")}</p>
          ) : (
            <ul className="flex flex-col">
              {saved?.map((filter) => (
                <li key={filter.id} className="group flex items-center gap-1">
                  <button
                    type="button"
                    onClick={() => apply(filter.filters)}
                    aria-label={t("savedFilterApply", { name: filter.name })}
                    className="hover:bg-accent min-w-0 flex-1 truncate rounded px-2 py-1 text-left text-sm"
                  >
                    {filter.name}
                  </button>
                  <button
                    type="button"
                    onClick={() => void handleDelete(filter.id)}
                    aria-label={t("savedFilterDelete", { name: filter.name })}
                    className="text-muted-foreground hover:text-foreground rounded p-1"
                  >
                    <Trash2 className="size-3.5" aria-hidden="true" />
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      ) : null}
    </div>
  );
}
