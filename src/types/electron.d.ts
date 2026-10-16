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
}

declare global {
  interface Window {
    omivoid?: OmivoidBridge;
  }
}
