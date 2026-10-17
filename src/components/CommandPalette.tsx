"use client";

import { useRef } from "react";
import { usePathname, useRouter } from "next/navigation";
import {
  BarChart3,
  Bell,
  CheckCircle2,
  Circle,
  Calendar,
  Clock,
  Download,
  History,
  Inbox,
  Moon,
  Plus,
  Redo2,
  RotateCcw,
  Search,
  Star,
  Trash2,
  Undo2,
  Upload,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import {
  CommandDialog,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
  CommandSeparator,
  CommandShortcut,
} from "@/components/ui/command";
import useAppStore, { type View } from "@/store/appStore";
import useThemeStore from "@/store/themeStore";
import { toast } from "@/store/toastStore";
import { downloadBackup, importBackupFile } from "@/features/data/backupActions";
import { exportTasksAsMarkdown } from "@/features/data/markdownExport";
import { createSnapshot } from "@/db/snapshotRepository";
import { redo, undo } from "@/db/history";
import {
  isDueNotificationsEnabled,
  setDueNotificationsEnabled,
} from "@/lib/notificationPrefs";
import { toUserMessage } from "@/lib/errors";
import { t, type MessageKey } from "@/lib/i18n";

const views: ReadonlyArray<{ id: View; labelKey: MessageKey; icon: LucideIcon }> = [
  { id: "inbox", labelKey: "viewInbox", icon: Inbox },
  { id: "today", labelKey: "viewToday", icon: Calendar },
  { id: "upcoming", labelKey: "viewUpcoming", icon: Clock },
  { id: "overdue", labelKey: "viewOverdue", icon: Circle },
  { id: "completed", labelKey: "viewCompleted", icon: CheckCircle2 },
  { id: "important", labelKey: "viewImportant", icon: Star },
  { id: "trash", labelKey: "viewTrash", icon: Trash2 },
];

const modifier = typeof navigator !== "undefined" && /Mac|iPhone|iPad/.test(navigator.platform) ? "⌘" : "Ctrl";

export function CommandPalette() {
  const open = useAppStore((s) => s.paletteOpen);
  const setOpen = useAppStore((s) => s.setPaletteOpen);
  const setActiveView = useAppStore((s) => s.setActiveView);
  const setSelectedProjectId = useAppStore((s) => s.setSelectedProjectId);
  const setSearchQuery = useAppStore((s) => s.setSearchQuery);
  const setBackupsOpen = useAppStore((s) => s.setBackupsOpen);
  const cycleTheme = useThemeStore((s) => s.cycle);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const router = useRouter();
  const pathname = usePathname();

  function run(action: () => void) {
    setOpen(false);
    // Let the dialog unmount before the action mutates focus/state.
    setTimeout(action, 0);
  }

  /** The task view lives at "/"; leave any other route first. */
  function goHome() {
    if (pathname !== "/") router.push("/");
  }

  function goToView(view: View) {
    run(() => {
      goHome();
      setActiveView(view);
      setSelectedProjectId(null);
    });
  }

  function goToStats() {
    run(() => router.push("/stats"));
  }

  function addTask() {
    run(() => {
      goHome();
      setActiveView("inbox");
      setSelectedProjectId(null);
      setSearchQuery("");
      document.getElementById("quick-add-input")?.focus();
    });
  }

  function clearSearch() {
    run(() => {
      setSearchQuery("");
      document.getElementById("task-search-input")?.focus();
    });
  }

  function cycleThemeAction() {
    run(() => cycleTheme());
  }

  function toggleNotifications() {
    run(() => {
      const next = !isDueNotificationsEnabled();
      setDueNotificationsEnabled(next);
      if (next) {
        toast.success(t("notificationsEnabledToast"));
      } else {
        toast.info(t("notificationsDisabledToast"));
      }
    });
  }

  function undoAction() {
    run(() => {
      void undo();
    });
  }

  function redoAction() {
    run(() => {
      void redo();
    });
  }

  function backupNow() {
    run(async () => {
      try {
        await createSnapshot();
        toast.success(t("backupsCreatedToast"));
      } catch (error) {
        toUserMessage(error);
        toast.error(t("errorGeneric"));
      }
    });
  }

  function openBackups() {
    run(() => setBackupsOpen(true));
  }

  function exportData() {
    run(async () => {
      try {
        const count = await downloadBackup();
        toast.success(t("exportSuccess", { count }));
      } catch (error) {
        toUserMessage(error);
        toast.error(t("exportFailed"));
      }
    });
  }

  function exportMarkdownView() {
    run(async () => {
      try {
        const count = await exportTasksAsMarkdown("view");
        if (count === 0) {
          toast.info(t("exportMarkdownEmpty"));
        } else {
          toast.success(t("exportMarkdownSuccess", { count }));
        }
      } catch (error) {
        toUserMessage(error);
        toast.error(t("exportFailed"));
      }
    });
  }

  function exportMarkdownAll() {
    run(async () => {
      try {
        const count = await exportTasksAsMarkdown("all");
        if (count === 0) {
          toast.info(t("exportMarkdownEmpty"));
        } else {
          toast.success(t("exportMarkdownSuccess", { count }));
        }
      } catch (error) {
        toUserMessage(error);
        toast.error(t("exportFailed"));
      }
    });
  }

  function startImport() {
    fileInputRef.current?.click();
  }

  async function handleFileChange(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) return;
    if (!window.confirm(t("importConfirm"))) {
      return;
    }
    try {
      const result = await importBackupFile(file);
      toast.success(
        t("importSuccess", {
          tasks: result.tasks,
          projects: result.projects,
          tags: result.tags,
        }),
      );
    } catch (error) {
      toUserMessage(error);
      toast.error(t("importFailed"));
    }
  }

  return (
    <>
      <CommandDialog
        open={open}
        onOpenChange={setOpen}
        title={t("paletteTitle")}
        description={t("paletteDescription")}
      >
        <CommandInput placeholder={t("palettePlaceholder")} aria-label={t("palettePlaceholder")} />
        <CommandList>
          <CommandEmpty>{t("paletteNoResults")}</CommandEmpty>
          <CommandGroup heading={t("paletteNavigate")}>
            {views.map(({ id, labelKey, icon: Icon }) => (
              <CommandItem key={id} value={`view ${t(labelKey)}`} onSelect={() => goToView(id)}>
                <Icon aria-hidden="true" />
                {t(labelKey)}
              </CommandItem>
            ))}
            <CommandItem value="statistics stats charts dashboard" onSelect={goToStats}>
              <BarChart3 aria-hidden="true" />
              {t("paletteStatistics")}
            </CommandItem>
          </CommandGroup>
          <CommandSeparator />
          <CommandGroup heading={t("paletteActions")}>
            <CommandItem value="add task new create" onSelect={addTask}>
              <Plus aria-hidden="true" />
              {t("paletteAddTask")}
              <CommandShortcut>{modifier} N</CommandShortcut>
            </CommandItem>
            <CommandItem value="undo revert last action" onSelect={undoAction}>
              <Undo2 aria-hidden="true" />
              {t("paletteUndo")}
              <CommandShortcut>{modifier} Z</CommandShortcut>
            </CommandItem>
            <CommandItem value="redo repeat last action" onSelect={redoAction}>
              <Redo2 aria-hidden="true" />
              {t("paletteRedo")}
              <CommandShortcut>⇧{modifier} Z</CommandShortcut>
            </CommandItem>
            <CommandItem value="theme dark light system toggle" onSelect={cycleThemeAction}>
              <Moon aria-hidden="true" />
              {t("paletteToggleTheme")}
            </CommandItem>
            <CommandItem value="notifications reminders due toggle bell" onSelect={toggleNotifications}>
              <Bell aria-hidden="true" />
              {t("paletteToggleNotifications")}
            </CommandItem>
            <CommandItem value="search clear reset" onSelect={clearSearch}>
              <Search aria-hidden="true" />
              {t("paletteClearSearch")}
            </CommandItem>
            <CommandItem value="backup snapshot save now" onSelect={backupNow}>
              <History aria-hidden="true" />
              {t("paletteBackupNow")}
            </CommandItem>
            <CommandItem value="backups restore snapshot history" onSelect={openBackups}>
              <RotateCcw aria-hidden="true" />
              {t("paletteRestoreBackup")}
            </CommandItem>
            <CommandItem value="export download backup json" onSelect={exportData}>
              <Download aria-hidden="true" />
              {t("paletteExport")}
            </CommandItem>
            <CommandItem value="export markdown current view download md" onSelect={exportMarkdownView}>
              <Download aria-hidden="true" />
              {t("paletteExportMarkdownView")}
            </CommandItem>
            <CommandItem value="export markdown all tasks download md" onSelect={exportMarkdownAll}>
              <Download aria-hidden="true" />
              {t("paletteExportMarkdownAll")}
            </CommandItem>
            <CommandItem value="import restore backup json" onSelect={startImport}>
              <Upload aria-hidden="true" />
              {t("paletteImport")}
            </CommandItem>
          </CommandGroup>
        </CommandList>
      </CommandDialog>

      <input
        ref={fileInputRef}
        type="file"
        accept="application/json,.json"
        className="hidden"
        onChange={handleFileChange}
        aria-hidden="true"
        tabIndex={-1}
      />
    </>
  );
}
