import { create } from "zustand";
import type { TaskStatus, TaskPriority } from "@/types";

export type View = "inbox" | "today" | "upcoming" | "overdue" | "completed" | "important" | "trash";

export interface AppFilters {
  status?: TaskStatus[];
  priority?: TaskPriority[];
  projectId?: string;
  tagIds?: string[];
}

export interface AppState {
  activeView: View;
  selectedProjectId: string | null;
  searchQuery: string;
  filters: AppFilters;
  sortBy: "dueAt" | "createdAt" | "updatedAt" | "order";
  sortDir: "asc" | "desc";
  groupBy: "none" | "project" | "date" | "tag";
  /** Ids of tasks whose subtask rows are expanded in the list. */
  expandedTaskIds: ReadonlySet<string>;
  setActiveView: (view: View) => void;
  setSelectedProjectId: (id: string | null) => void;
  setSearchQuery: (q: string) => void;
  setFilters: (f: AppFilters) => void;
  clearFilters: () => void;
  setSortBy: (s: AppState["sortBy"]) => void;
  setSortDir: (d: AppState["sortDir"]) => void;
  setGroupBy: (g: AppState["groupBy"]) => void;
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
  expandedTaskIds: new Set<string>(),
  setActiveView: (activeView) => set({ activeView }),
  setSelectedProjectId: (selectedProjectId) => set({ selectedProjectId }),
  setSearchQuery: (searchQuery) => set({ searchQuery }),
  setFilters: (filters) => set({ filters }),
  clearFilters: () => set({ filters: {} }),
  setSortBy: (sortBy) => set({ sortBy }),
  setSortDir: (sortDir) => set({ sortDir }),
  setGroupBy: (groupBy) => set({ groupBy }),
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
