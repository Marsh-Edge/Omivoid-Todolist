"use client";

import { useLiveQuery } from "dexie-react-hooks";
import { listActiveTasks } from "@/db/taskRepository";
import type { Task } from "@/types";

/**
 * Live list of active (non-deleted) tasks.
 *
 * Returns `undefined` until the first IndexedDB result arrives, which keeps
 * server-side prerendering (static export) and the first client render
 * identical — no hydration mismatch, no fake "empty" flash.
 */
export function useActiveTasks(): Task[] | undefined {
  return useLiveQuery(() => listActiveTasks(), []);
}
