/**
 * Renderer-side type for the minimal preload bridge (see `electron/preload.ts`).
 * Kept in sync manually — the Electron shell is compiled separately and is not
 * part of the Next.js TypeScript project.
 */
export interface OmivoidBridge {
  readonly platform: NodeJS.Platform;
  readonly versions: {
    readonly electron: string;
    readonly chrome: string;
    readonly node: string;
  };
  /**
   * Subscribes to the global quick-add shortcut (`Ctrl/Cmd+Alt+N`).
   * Returns an unsubscribe function.
   */
  readonly onQuickAdd: (listener: () => void) => () => void;
}

declare global {
  interface Window {
    omivoid?: OmivoidBridge;
  }
}
