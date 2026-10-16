import { contextBridge } from "electron";

/**
 * Minimal, sandbox-safe preload. Nothing else is exposed to the renderer:
 * the app is 100% local, so there is no filesystem, shell or network bridge.
 * Additional capabilities (e.g. desktop notifications) are added here
 * explicitly, with the narrowest possible surface.
 */
const omivoidBridge = {
  platform: process.platform,
  versions: {
    electron: process.versions.electron,
    chrome: process.versions.chrome,
    node: process.versions.node,
  },
} as const;

contextBridge.exposeInMainWorld("omivoid", omivoidBridge);
