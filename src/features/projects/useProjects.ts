"use client";

import { useLiveQuery } from "dexie-react-hooks";
import { listProjects } from "@/db/projectRepository";
import type { Project } from "@/types";

export function useProjects(): Project[] | undefined {
  return useLiveQuery(() => listProjects(), []);
}

