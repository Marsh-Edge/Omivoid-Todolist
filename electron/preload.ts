import { contextBridge, ipcRenderer } from "electron";

/**
 * Minimal, sandbox-safe preload. Nothing else is exposed to the renderer:
 * the app is 100% local, so there is no filesystem, shell or network bridge.
 * Additional capabilities (e.g. desktop notifications) are added here
 * explicitly, with the narrowest possible surface.
 */

/** Must match the channel name in `main.ts`. */
const QUICK_ADD_CHANNEL = "omivoid:quick-add";

const omivoidBridge = {
  /**
   * Subscribes to the global quick-add shortcut (`Ctrl/Cmd+Alt+N`).
   * Returns an unsubscribe function.
   */
  onQuickAdd: (listener: () => void): (() => void) => {
    const handler = (): void => listener();
    ipcRenderer.on(QUICK_ADD_CHANNEL, handler);
    return () => {
      ipcRenderer.removeListener(QUICK_ADD_CHANNEL, handler);
    };
  },
} as const;

contextBridge.exposeInMainWorld("omivoid", omivoidBridge);
