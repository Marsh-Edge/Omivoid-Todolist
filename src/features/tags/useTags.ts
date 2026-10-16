"use client";

import { useLiveQuery } from "dexie-react-hooks";
import { listTags } from "@/db/tagRepository";
import type { Tag } from "@/types";

export function useTags(): Tag[] | undefined {
  return useLiveQuery(() => listTags(), []);
}
