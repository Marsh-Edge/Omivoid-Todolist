import { create } from "zustand";
import type { TaskFilterCriteria } from "@/types";

export type View = "inbox" | "today" | "upcoming" | "overdue" | "completed" | "important" | "trash";

/** How the active view's tasks are presented. */
export type ViewMode = "list" | "board" | "calendar";

/** Live filter chips for the active view (same shape as a saved filter). */
export type AppFilters = TaskFilterCriteria;

export interface AppState {
  activeView: View;
  selectedProjectId: string | null;
  /** Local search query (case-insensitive). */
  searchQuery: string;
  /** Instant filter chips. */
  filters: AppFilters;
  sortBy: "dueAt" | "createdAt" | "updatedAt" | "order";
  sortDir: "asc" | "desc";
  groupBy: "none" | "project" | "date" | "tag";
  /** Presentation of the active view: flat list, kanban board or month calendar. */
  viewMode: ViewMode;
  /** Ids of tasks whose subtask rows are expanded in the list. */
  expandedTaskIds: ReadonlySet<string>;
  /** Whether the command palette dialog is open. */
  paletteOpen: boolean;
  setPaletteOpen: (paletteOpen: boolean) => void;
  /** Whether the rolling-backups dialog is open. */
  backupsOpen: boolean;
  setBackupsOpen: (backupsOpen: boolean) => void;
  /** Task whose detail (notes/backlinks) panel is open, or null. */
  detailTaskId: string | null;
  setDetailTaskId: (detailTaskId: string | null) => void;
  setActiveView: (activeView: View) => void;
  setSelectedProjectId: (selectedProjectId: string | null) => void;
  setSearchQuery: (searchQuery: string) => void;
  setFilters: (filters: AppFilters) => void;
  clearFilters: () => void;
  setSortBy: (sortBy: AppState["sortBy"]) => void;
  setSortDir: (sortDir: AppState["sortDir"]) => void;
  setGroupBy: (groupBy: AppState["groupBy"]) => void;
  setViewMode: (viewMode: ViewMode) => void;
  toggleTaskExpanded: (id: string) => void;
  collapseAllTasks: () => void;
}

const useAppStore = create<AppState>((set) => ({
  activeView: "inbox",
  selectedProjectId: null,
  searchQuery: "",
  filters: {},
  sortBy: "order",
  sortDir: "asc",
  groupBy: "none",
  viewMode: "list",
  expandedTaskIds: new Set<string>(),
  paletteOpen: false,
  setPaletteOpen: (paletteOpen) => set({ paletteOpen }),
  backupsOpen: false,
  setBackupsOpen: (backupsOpen) => set({ backupsOpen }),
  detailTaskId: null,
  setDetailTaskId: (detailTaskId) => set({ detailTaskId }),
  setActiveView: (activeView) => set({ activeView }),
  setSelectedProjectId: (selectedProjectId) => set({ selectedProjectId }),
  setSearchQuery: (searchQuery) => set({ searchQuery }),
  setFilters: (filters) => set({ filters }),
  clearFilters: () => set({ filters: {} }),
  setSortBy: (sortBy) => set({ sortBy }),
  setSortDir: (sortDir) => set({ sortDir }),
  setGroupBy: (groupBy) => set({ groupBy }),
  setViewMode: (viewMode) => set({ viewMode }),
  toggleTaskExpanded: (id) =>
    set((state) => {
      const next = new Set(state.expandedTaskIds);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return { expandedTaskIds: next };
    }),
  collapseAllTasks: () => set({ expandedTaskIds: new Set<string>() }),
}));

export default useAppStore;
