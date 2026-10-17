import { useEffect } from "react";

/**
 * Bridges Electron-only capabilities into the renderer. Currently the global
 * quick-add shortcut (`Ctrl/Cmd+Alt+N`), which reveals the window from the main
 * process and asks the renderer to focus the quick-add box.
 *
 * A no-op in the browser (`window.omivoid` is only injected by the Electron
 * preload), so the web build is unaffected.
 */
export function useDesktopBridge(): void {
  useEffect(() => {
    const unsubscribe = window.omivoid?.onQuickAdd(() => {
      const input = document.getElementById("quick-add-input");
      if (input instanceof HTMLInputElement) {
        input.focus();
        input.select();
      }
    });
    return () => {
      unsubscribe?.();
    };
  }, []);
}
