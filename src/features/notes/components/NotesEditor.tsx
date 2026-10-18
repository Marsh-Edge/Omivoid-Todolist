"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import dynamic from "next/dynamic";
import { Link2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { updateTask } from "@/db/taskRepository";
import { notifyError } from "@/lib/errors";
import { replaceWikiLinks } from "@/lib/wikiLinks";
import { t } from "@/lib/i18n";
import type { Task } from "@/types";
import type { TaskSuggestion } from "@/features/notes/useTaskNoteReferences";

/** Markdown rendering (react-markdown + remark-gfm) is code-split out. */
const MarkdownPreview = dynamic(() => import("./MarkdownPreview"), {
  ssr: false,
  loading: () => <p className="text-muted-foreground text-sm">{t("loadingTasks")}</p>,
});

type NotesMode = "edit" | "preview" | "split";
type SaveStatus = "idle" | "saving" | "saved";

const MODES: ReadonlyArray<{ id: NotesMode; labelKey: "notesEdit" | "notesPreview" | "notesSplit" }> = [
  { id: "edit", labelKey: "notesEdit" },
  { id: "preview", labelKey: "notesPreview" },
  { id: "split", labelKey: "notesSplit" },
];

const AUTOSAVE_MS = 500;

export function NotesEditor({
  task,
  resolveTitle,
  suggestTitles,
  onOpenTask,
}: {
  task: Task;
  resolveTitle: (title: string) => string | null;
  suggestTitles: (query: string, excludeId: string) => TaskSuggestion[];
  onOpenTask: (id: string) => void;
}) {
  const [mode, setMode] = useState<NotesMode>("split");
  const [value, setValue] = useState(task.notes);
  const [status, setStatus] = useState<SaveStatus>("idle");
  const [pickerOpen, setPickerOpen] = useState(false);
  const [pickerQuery, setPickerQuery] = useState("");

  const timerRef = useRef<number | undefined>(undefined);
  const lastSavedRef = useRef(task.notes);
  const valueRef = useRef(task.notes);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // Cancel any pending autosave when the editor unmounts (the parent remounts
  // this component — via `key={task.id}` — when a different task is opened).
  useEffect(() => () => window.clearTimeout(timerRef.current), []);

  async function save(next: string) {
    if (next === lastSavedRef.current) return;
    setStatus("saving");
    try {
      // Note autosave is continuous; excluding it keeps undo/redo meaningful.
      await updateTask(task.id, { notes: next }, { recordHistory: false });
      lastSavedRef.current = next;
      setStatus("saved");
    } catch (error) {
      notifyError(error, t("noteSaveFailed"));
      setStatus("idle");
      return;
    }
  }

  function scheduleSave(next: string) {
    setStatus("idle");
    window.clearTimeout(timerRef.current);
    timerRef.current = window.setTimeout(() => void save(next), AUTOSAVE_MS);
  }

  function handleChange(next: string) {
    setValue(next);
    valueRef.current = next;
    scheduleSave(next);
  }

  function flush() {
    window.clearTimeout(timerRef.current);
    void save(valueRef.current);
  }

  function insertLink(title: string) {
    if (mode === "preview") setMode("split");
    const token = `[[${title}]]`;
    const element = textareaRef.current;
    if (!element) {
      handleChange(`${valueRef.current}${token}`);
    } else {
      const start = element.selectionStart ?? valueRef.current.length;
      const end = element.selectionEnd ?? start;
      const next = `${valueRef.current.slice(0, start)}${token}${valueRef.current.slice(end)}`;
      handleChange(next);
      requestAnimationFrame(() => {
        element.focus();
        const caret = start + token.length;
        element.setSelectionRange(caret, caret);
      });
    }
    setPickerOpen(false);
    setPickerQuery("");
  }

  const previewSource = useMemo(() => replaceWikiLinks(value, resolveTitle), [value, resolveTitle]);
  const suggestions = pickerOpen ? suggestTitles(pickerQuery, task.id) : [];
  const showEditor = mode === "edit" || mode === "split";
  const showPreview = mode === "preview" || mode === "split";

  return (
    <section className="flex flex-col gap-2" aria-label={t("notesLabel")}>
      <div className="flex flex-wrap items-center gap-2">
        <h3 className="text-sm font-medium">{t("notesLabel")}</h3>

        <div className="ml-auto flex items-center gap-0.5" role="group">
          {MODES.map((item) => (
            <Button
              key={item.id}
              type="button"
              variant={mode === item.id ? "secondary" : "ghost"}
              size="xs"
              aria-pressed={mode === item.id}
              onClick={() => setMode(item.id)}
            >
              {t(item.labelKey)}
            </Button>
          ))}
        </div>
      </div>

      <div className="relative flex items-center gap-2">
        <Button
          type="button"
          variant="outline"
          size="xs"
          onClick={() => setPickerOpen((open) => !open)}
          aria-expanded={pickerOpen}
          className="gap-1"
        >
          <Link2 className="size-3" aria-hidden="true" />
          {t("insertLink")}
        </Button>
        <span className="text-muted-foreground ml-auto text-xs" aria-live="polite">
          {status === "saving" ? t("noteSaving") : status === "saved" ? t("noteSaved") : ""}
        </span>

        {pickerOpen ? (
          <div className="bg-popover ring-border absolute top-8 left-0 z-20 w-72 rounded-md p-2 shadow-lg ring-1">
            <Input
              value={pickerQuery}
              onChange={(event) => setPickerQuery(event.target.value)}
              placeholder={t("linkPickerPlaceholder")}
              aria-label={t("linkPickerAria")}
              className="mb-1 h-7 text-xs"
              autoFocus
            />
            <ul className="max-h-56 overflow-y-auto" aria-label={t("linkPickerAria")}>
              {suggestions.length === 0 ? (
                <li className="text-muted-foreground px-2 py-1.5 text-xs">{t("linkPickerEmpty")}</li>
              ) : (
                suggestions.map((suggestion) => (
                  <li key={suggestion.id}>
                    <button
                      type="button"
                      onClick={() => insertLink(suggestion.title)}
                      className="hover:bg-accent flex w-full items-center rounded px-2 py-1 text-left text-sm"
                    >
                      <span className="truncate">{suggestion.title}</span>
                    </button>
                  </li>
                ))
              )}
            </ul>
          </div>
        ) : null}
      </div>

      <div className={showEditor && showPreview ? "grid grid-cols-2 gap-3" : ""}>
        {showEditor ? (
          <Textarea
            ref={textareaRef}
            value={value}
            onChange={(event) => handleChange(event.target.value)}
            onBlur={flush}
            placeholder={t("notesPlaceholder")}
            aria-label={t("notesLabel")}
            className="min-h-[240px] font-mono text-xs"
          />
        ) : null}

        {showPreview ? (
          <div
            className="min-h-[240px] overflow-auto rounded-lg border p-3"
            aria-label={t("markdownPreviewAria")}
          >
            {value.trim() === "" ? (
              <p className="text-muted-foreground text-sm">{t("noNotesYet")}</p>
            ) : (
              <MarkdownPreview markdown={previewSource} onOpenTask={onOpenTask} />
            )}
          </div>
        ) : null}
      </div>
    </section>
  );
}
