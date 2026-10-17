"use client";

import { useSyncExternalStore } from "react";
import {
  getHistorySnapshot,
  subscribeHistory,
  undo,
  redo,
  type HistoryState,
} from "@/db/history";

export interface UseHistory extends HistoryState {
  undo: () => Promise<boolean>;
  redo: () => Promise<boolean>;
}

/** Subscribes to the undo/redo stack so components can enable/disable buttons. */
export function useHistory(): UseHistory {
  const state = useSyncExternalStore(
    subscribeHistory,
    getHistorySnapshot,
    getHistorySnapshot,
  );
  return { ...state, undo, redo };
}
