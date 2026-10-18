"use client";

import { useCallback, useEffect, useState } from "react";
import { ChevronDown, Command, Monitor, Moon, Redo2, Search, Sun, Undo2, X } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import useAppStore, { type AppState } from "@/store/appStore";
import useThemeStore from "@/store/themeStore";
import { useHistory } from "@/features/history/useHistory";
import { FilterMenu } from "@/features/filters/components/FilterMenu";
import { SavedFilterMenu } from "@/features/filters/components/SavedFilterMenu";
import { useDismissable } from "@/hooks/useDismissable";
import { t, type MessageKey } from "@/lib/i18n";
import type { ThemeMode } from "@/lib/theme";
import { cn } from "cn";

const sortLabels: Record<AppState["sortBy"], MessageKey> = {
  order: "sortManual",
  dueAt: "sortDue",
  createdAt: "sortCreated",
  updatedAt: "sortUpdated",
};

const groupLabels: Record<AppState["groupBy"], MessageKey> = {
  none: "groupNone",
  project: "groupProject",
  date: "groupDate",
  tag: "groupTag",
};

const themeIcons: Record<ThemeMode, typeof Sun> = {
  light: Sun,
  dark: Moon,
  system: Monitor,
};

export function AppHeader() {
  const searchQuery = useAppStore((s) => s.searchQuery);
  const setSearchQuery = useAppStore((s) => s.setSearchQuery);
  const sortBy = useAppStore((s) => s.sortBy);
  const sortDir = useAppStore((s) => s.sortDir);
  const setSortBy = useAppStore((s) => s.setSortBy);
  const setSortDir = useAppStore((s) => s.setSortDir);
  const groupBy = useAppStore((s) => s.groupBy);
  const setGroupBy = useAppStore((s) => s.setGroupBy);
  const setPaletteOpen = useAppStore((s) => s.setPaletteOpen);

  const themeMode = useThemeStore((s) => s.mode);
  const cycleTheme = useThemeStore((s) => s.cycle);
  const hydrateTheme = useThemeStore((s) => s.hydrate);
  const { canUndo, canRedo, undoLabel, redoLabel, undo, redo } = useHistory();
  const [showMenu, setShowMenu] = useState(false);
  const closeMenu = useCallback(() => setShowMenu(false), []);
  const menuRef = useDismissable<HTMLDivElement>(showMenu, closeMenu);

  useEffect(() => {
    hydrateTheme();
  }, [hydrateTheme]);

  // Keep "system" theme in sync with OS changes while it is selected.
  useEffect(() => {
    if (themeMode !== "system") return;
    const media = window.matchMedia("(prefers-color-scheme: dark)");
    const onChange = () => {
      document.documentElement.classList.toggle("dark", media.matches);
    };
    media.addEventListener("change", onChange);
    return () => media.removeEventListener("change", onChange);
  }, [themeMode]);

  const ThemeIcon = themeIcons[themeMode];

  return (
    <header className="flex flex-wrap items-center gap-2 border-b px-4 py-3">
      <div className="flex min-w-[240px] flex-1 items-center gap-2">
        <Search className="text-muted-foreground size-4" aria-hidden="true" />
        <Input
          id="task-search-input"
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          placeholder={t("searchPlaceholder")}
          className="h-8"
          aria-label={t("searchTasksAria")}
        />
        {searchQuery ? (
          <Button
            type="button"
            variant="ghost"
            size="icon-xs"
            onClick={() => setSearchQuery("")}
            aria-label={t("clearSearch")}
          >
            <X aria-hidden="true" />
          </Button>
        ) : null}
      </div>

      <div className="flex items-center gap-1">
        <Button
          type="button"
          variant="ghost"
          size="icon-sm"
          onClick={() => void undo()}
          disabled={!canUndo}
          aria-label={undoLabel ? t("undoAction", { action: t(undoLabel as MessageKey) }) : t("undo")}
          title={t("undo")}
        >
          <Undo2 aria-hidden="true" />
        </Button>
        <Button
          type="button"
          variant="ghost"
          size="icon-sm"
          onClick={() => void redo()}
          disabled={!canRedo}
          aria-label={redoLabel ? t("redoAction", { action: t(redoLabel as MessageKey) }) : t("redo")}
          title={t("redo")}
        >
          <Redo2 aria-hidden="true" />
        </Button>
      </div>

      <Button
        type="button"
        variant="outline"
        size="sm"
        onClick={() => setPaletteOpen(true)}
        aria-label={t("openPalette")}
        className="gap-1.5"
      >
        <Command className="size-3.5" aria-hidden="true" />
        <span className="hidden text-xs sm:inline">K</span>
      </Button>

      <Button
        type="button"
        variant="ghost"
        size="icon-sm"
        onClick={cycleTheme}
        aria-label={t("themeToggleAria", { mode: t(themeMode === "light" ? "themeLight" : themeMode === "dark" ? "themeDark" : "themeSystem") })}
      >
        <ThemeIcon aria-hidden="true" />
      </Button>

      <FilterMenu />
      <SavedFilterMenu />

      <div className="relative" ref={menuRef}>
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={() => setShowMenu((v) => !v)}
          aria-expanded={showMenu}
          aria-label={t("sortButtonAria")}
          className="gap-1"
        >
          <span className="text-xs">
            {t(sortLabels[sortBy])}
            {sortDir === "asc" ? " ↑" : " ↓"}
          </span>
          <ChevronDown className="size-3" aria-hidden="true" />
        </Button>
        {showMenu ? (
          <div className="bg-popover ring-border absolute right-0 z-50 mt-2 min-w-[200px] rounded-md p-1 shadow-lg ring-1">
            {(["order", "dueAt", "createdAt", "updatedAt"] as const).map((s) => (
              <button
                key={s}
                type="button"
                onClick={() => {
                  setSortBy(s);
                  setShowMenu(false);
                }}
                className={cn(
                  "hover:bg-accent flex w-full items-center justify-between rounded px-2 py-1 text-sm",
                  sortBy === s && "bg-accent",
                )}
              >
                {t(sortLabels[s])}
              </button>
            ))}
            <div className="bg-border my-1 h-px" />
            {(["asc", "desc"] as const).map((d) => (
              <button
                key={d}
                type="button"
                onClick={() => {
                  setSortDir(d);
                  setShowMenu(false);
                }}
                className={cn(
                  "hover:bg-accent flex w-full items-center justify-between rounded px-2 py-1 text-sm",
                  sortDir === d && "bg-accent",
                )}
              >
                {d === "asc" ? t("sortAsc") : t("sortDesc")}
              </button>
            ))}
            <div className="bg-border my-1 h-px" />
            {(["none", "project", "date", "tag"] as const).map((g) => (
              <button
                key={g}
                type="button"
                onClick={() => {
                  setGroupBy(g);
                  setShowMenu(false);
                }}
                className={cn(
                  "hover:bg-accent flex w-full items-center justify-between rounded px-2 py-1 text-sm",
                  groupBy === g && "bg-accent",
                )}
              >
                {t(groupLabels[g])}
              </button>
            ))}
          </div>
        ) : null}
      </div>
    </header>
  );
}
