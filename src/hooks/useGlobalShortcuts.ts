import { useEffect } from "react";
import { redo, undo } from "@/db/history";

/**
 * App-wide keyboard shortcuts.
 *
 * - `Ctrl/Cmd + K` → toggle the command palette
 * - `Ctrl/Cmd + F` → focus the search box (replacing the browser find bar)
 * - `Ctrl/Cmd + Z` → undo the last action
 * - `Ctrl/Cmd + Shift + Z` / `Ctrl/Cmd + Y` → redo
 *
 * Modifier detection uses `metaKey` on macOS and `ctrlKey` elsewhere. Shortcuts
 * are ignored while typing in an input/textarea so they don't hijack editing
 * (and `Ctrl+Z` stays native text undo inside fields).
 */
export function useGlobalShortcuts(onTogglePalette: () => void): void {
  useEffect(() => {
    function isEditable(target: EventTarget | null): boolean {
      if (!(target instanceof HTMLElement)) return false;
      const tag = target.tagName;
      return tag === "INPUT" || tag === "TEXTAREA" || target.isContentEditable;
    }

    function handleKeyDown(event: KeyboardEvent): void {
      const mod = event.metaKey || event.ctrlKey;
      if (!mod) return;
      const key = event.key.toLowerCase();

      if (key === "k") {
        event.preventDefault();
        onTogglePalette();
        return;
      }

      if (key === "f") {
        event.preventDefault();
        const search = document.getElementById("task-search-input");
        if (search instanceof HTMLInputElement) {
          search.focus();
          search.select();
        }
        return;
      }

      // Ctrl/Cmd + N → focus the quick-add box (only when not already editing).
      if (key === "n" && !isEditable(event.target)) {
        event.preventDefault();
        document.getElementById("quick-add-input")?.focus();
        return;
      }

      // Undo/redo only outside text fields, so in-field editing keeps the
      // browser's native undo behaviour.
      if (isEditable(event.target)) return;

      if (key === "z" && !event.shiftKey) {
        event.preventDefault();
        void undo();
        return;
      }

      if ((key === "z" && event.shiftKey) || key === "y") {
        event.preventDefault();
        void redo();
      }
    }

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [onTogglePalette]);
}
