"use client";

import { useLiveQuery } from "dexie-react-hooks";
import { listSavedFilters } from "@/db/savedFilterRepository";
import type { SavedFilter } from "@/types";

/** Live list of saved filter presets (undefined until the first DB read). */
export function useSavedFilters(): SavedFilter[] | undefined {
  return useLiveQuery(() => listSavedFilters(), []);
}
