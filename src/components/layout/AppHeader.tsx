"use client";

import { useState } from "react";
import { Search, X, ChevronDown } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import useAppStore from "@/store/appStore";
import { t } from "@/lib/i18n";
import { cn } from "cn";

export function AppHeader() {
  const searchQuery = useAppStore((s) => s.searchQuery);
  const setSearchQuery = useAppStore((s) => s.setSearchQuery);
  const sortBy = useAppStore((s) => s.sortBy);
  const sortDir = useAppStore((s) => s.sortDir);
  const setSortBy = useAppStore((s) => s.setSortBy);
  const setSortDir = useAppStore((s) => s.setSortDir);
  const groupBy = useAppStore((s) => s.groupBy);
  const setGroupBy = useAppStore((s) => s.setGroupBy);
  const [showMenu, setShowMenu] = useState(false);

  return (
    <header className="flex flex-wrap items-center gap-2 border-b px-4 py-3">
      <div className="flex min-w-[240px] flex-1 items-center gap-2">
        <Search className="text-muted-foreground size-4" aria-hidden="true" />
        <Input
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          placeholder="Search tasks..."
          className="h-8"
          aria-label="Search tasks"
        />
        {searchQuery ? (
          <Button type="button" variant="ghost" size="icon-xs" onClick={() => setSearchQuery("")} aria-label="Clear search">
            <X aria-hidden="true" />
          </Button>
        ) : null}
      </div>

      <div className="relative">
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={() => setShowMenu((v) => !v)}
          aria-expanded={showMenu}
          className="gap-1"
        >
          <span className="text-xs">
            {sortBy === "order" ? "Manual" : sortBy === "dueAt" ? "Due" : sortBy === "createdAt" ? "Created" : "Updated"}
            {sortDir === "asc" ? " ↑" : " ↓"}
          </span>
          <ChevronDown className="size-3" aria-hidden="true" />
        </Button>
        {showMenu ? (
          <div className="bg-popover ring-border absolute right-0 z-50 mt-2 min-w-[180px] rounded-md p-1 shadow-lg ring-1">
            {(["order", "dueAt", "createdAt", "updatedAt"] as const).map((s) => (
              <button
                key={s}
                type="button"
                onClick={() => {
                  setSortBy(s);
                  setShowMenu(false);
                }}
                className={cn(
                  "hover:bg-accent flex w-full items-center justify-between px-2 py-1 text-sm rounded",
                  sortBy === s && "bg-accent"
                )}
              >
                {s === "order" ? "Manual order" : s === "dueAt" ? "Due date" : s === "createdAt" ? "Created" : "Updated"}
              </button>
            ))}
            <div className="my-1 h-px bg-border" />
            {(["asc", "desc"] as const).map((d) => (
              <button
                key={d}
                type="button"
                onClick={() => {
                  setSortDir(d);
                  setShowMenu(false);
                }}
                className={cn(
                  "hover:bg-accent flex w-full items-center justify-between px-2 py-1 text-sm rounded",
                  sortDir === d && "bg-accent"
                )}
              >
                {d === "asc" ? "Ascending" : "Descending"}
              </button>
            ))}
            <div className="my-1 h-px bg-border" />
            {(["none", "project", "date", "tag"] as const).map((g) => (
              <button
                key={g}
                type="button"
                onClick={() => {
                  setGroupBy(g);
                  setShowMenu(false);
                }}
                className={cn(
                  "hover:bg-accent flex w-full items-center justify-between px-2 py-1 text-sm rounded",
                  groupBy === g && "bg-accent"
                )}
              >
                {g === "none" ? "No grouping" : g === "project" ? "Group by project" : g === "date" ? "Group by date" : "Group by tag"}
              </button>
            ))}
          </div>
        ) : null}
      </div>
    </header>
  );
}
