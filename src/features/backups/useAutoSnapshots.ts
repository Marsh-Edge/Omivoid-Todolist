"use client";

import { useEffect } from "react";
import { maybeCreateSnapshot } from "@/db/snapshotRepository";
import { toUserMessage } from "@/lib/errors";

/**
 * Takes a rolling local backup once per app start when the newest one is older
 * than the interval (~6 hours). Failures are logged, never shown as raw errors.
 */
export function useAutoSnapshots(): void {
  useEffect(() => {
    void (async () => {
      try {
        await maybeCreateSnapshot();
      } catch (error) {
        toUserMessage(error);
      }
    })();
  }, []);
}
