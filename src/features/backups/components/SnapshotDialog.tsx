"use client";

import { useState } from "react";
import { format } from "date-fns";
import { useLiveQuery } from "dexie-react-hooks";
import { RotateCcw, Save, Trash2 } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import useAppStore from "@/store/appStore";
import { toast } from "@/store/toastStore";
import {
  createSnapshot,
  deleteSnapshot,
  listSnapshots,
  restoreSnapshot,
} from "@/db/snapshotRepository";
import { notifyError } from "@/lib/errors";
import { t } from "@/lib/i18n";
import type { SnapshotMeta } from "@/types";

function formatTaken(ms: number): string {
  return format(new Date(ms), "yyyy-MM-dd HH:mm");
}

export function SnapshotDialog() {
  const open = useAppStore((s) => s.backupsOpen);
  const setOpen = useAppStore((s) => s.setBackupsOpen);
  const [busy, setBusy] = useState(false);

  // Indexed, newest-first query over `snapshots` — only read while open so a
  // closed dialog keeps no live subscription.
  const snapshots =
    useLiveQuery(() => (open ? listSnapshots() : []), [open], [] as SnapshotMeta[]) ?? [];

  async function run(action: () => Promise<void>): Promise<void> {
    if (busy) return;
    setBusy(true);
    try {
      await action();
    } catch (error) {
      notifyError(error);
    } finally {
      setBusy(false);
    }
  }

  function backupNow(): void {
    void run(async () => {
      await createSnapshot();
      toast.success(t("backupsCreatedToast"));
    });
  }

  function restore(id: string): void {
    if (!window.confirm(t("backupsRestoreConfirm"))) return;
    void run(async () => {
      await restoreSnapshot(id);
      toast.success(t("backupsRestoredToast"));
      setOpen(false);
    });
  }

  function remove(id: string): void {
    void run(async () => {
      await deleteSnapshot(id);
    });
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{t("backupsTitle")}</DialogTitle>
          <DialogDescription>{t("backupsDescription")}</DialogDescription>
        </DialogHeader>

        <div className="max-h-72 overflow-y-auto">
          {snapshots.length === 0 ? (
            <p className="text-muted-foreground py-6 text-center text-sm">
              {t("backupsEmpty")}
            </p>
          ) : (
            <ul className="divide-border divide-y">
              {snapshots.map((snapshot) => (
                <li key={snapshot.id} className="flex items-center gap-2 py-2">
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm">
                      {t("backupsCreatedAt", { date: formatTaken(snapshot.createdAt) })}
                    </p>
                    <p className="text-muted-foreground truncate text-xs">
                      {t("backupsCounts", {
                        tasks: snapshot.taskCount,
                        projects: snapshot.projectCount,
                        tags: snapshot.tagCount,
                      })}
                    </p>
                  </div>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => restore(snapshot.id)}
                    disabled={busy}
                  >
                    <RotateCcw aria-hidden="true" />
                    {t("backupsRestore")}
                  </Button>
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon-sm"
                    onClick={() => remove(snapshot.id)}
                    disabled={busy}
                    aria-label={t("backupsDelete")}
                  >
                    <Trash2 aria-hidden="true" />
                  </Button>
                </li>
              ))}
            </ul>
          )}
        </div>

        <DialogFooter>
          <Button type="button" variant="outline" onClick={() => setOpen(false)}>
            {t("backupDialogClose")}
          </Button>
          <Button type="button" onClick={backupNow} disabled={busy}>
            <Save aria-hidden="true" />
            {t("backupsRefresh")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
