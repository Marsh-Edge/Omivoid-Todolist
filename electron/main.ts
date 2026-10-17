import {
  app,
  BrowserWindow,
  Menu,
  Tray,
  globalShortcut,
  nativeImage,
  nativeTheme,
} from "electron";
import { createReadStream, statSync } from "node:fs";
import { createServer, type Server } from "node:http";
import path from "node:path";
import { loadWindowState, trackWindowState } from "./windowState";

/**
 * Omivoid desktop shell.
 *
 * - Never loads anything remote: production is served from a loopback-only
 *   static server (stable origin → reliable IndexedDB persistence), never
 *   `file://`.
 * - `contextIsolation: true`, `nodeIntegration: false`, `sandbox: true`.
 * - External navigation and popups are denied.
 * - Desktop extras: system tray (closing the window keeps the app running),
 *   a global quick-add shortcut, window size/position memory, and a
 *   single-instance lock.
 */

const isDev = !app.isPackaged;
const DEV_URL = process.env.OMIVOID_DEV_URL;

/**
 * Fixed loopback port. The renderer origin (`http://127.0.0.1:<port>`) must be
 * identical on every launch, otherwise IndexedDB would be partitioned per port
 * and all data would appear to vanish between restarts.
 * 41739 is below the Windows dynamic/ephemeral range (49152+), so it is not
 * normally handed out to other applications.
 */
const RENDERER_PORT = 41739;
const RENDERER_ORIGIN = `http://127.0.0.1:${RENDERER_PORT}`;

/** Renderer channel used by the global quick-add shortcut (see `preload.ts`). */
const QUICK_ADD_CHANNEL = "omivoid:quick-add";

/** Global accelerator that reveals the window and focuses the quick-add box. */
const QUICK_ADD_ACCELERATOR = "CommandOrControl+Alt+N";

const MIME_TYPES: Record<string, string> = {
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".mjs": "text/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".svg": "image/svg+xml",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".gif": "image/gif",
  ".webp": "image/webp",
  ".ico": "image/x-icon",
  ".woff": "font/woff",
  ".woff2": "font/woff2",
  ".ttf": "font/ttf",
  ".txt": "text/plain; charset=utf-8",
  ".map": "application/json; charset=utf-8",
};

function mimeFor(filePath: string): string {
  return MIME_TYPES[path.extname(filePath).toLowerCase()] ?? "application/octet-stream";
}

/** Resolves a request path to a file inside `rootDir`, or `null`. */
function resolveStaticFile(rootDir: string, requestPath: string): string | null {
  const candidates = [
    requestPath,
    requestPath.endsWith("/") ? `${requestPath}index.html` : `${requestPath}.html`,
    `${requestPath.replace(/\/$/, "")}/index.html`,
  ];

  for (const candidate of candidates) {
    const filePath = path.normalize(path.join(rootDir, candidate));
    const insideRoot = filePath === rootDir || filePath.startsWith(rootDir + path.sep);
    if (!insideRoot) continue;
    try {
      if (statSync(filePath).isFile()) return filePath;
    } catch {
      // try the next candidate
    }
  }
  return null;
}

interface StaticServer {
  origin: string;
  close: () => Promise<void>;
}

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/** Loopback-only static file server with SPA fallback. */
async function startStaticServer(rootDir: string): Promise<StaticServer> {
  const server: Server = createServer((request, response) => {
    const requestPath = decodeURIComponent(
      new URL(request.url ?? "/", RENDERER_ORIGIN).pathname,
    );

    const filePath = resolveStaticFile(rootDir, requestPath) ?? path.join(rootDir, "index.html");
    const isHashedAsset = requestPath.startsWith("/_next/static/");

    response.writeHead(200, {
      "Content-Type": mimeFor(filePath),
      "Cache-Control": isHashedAsset ? "public, max-age=31536000, immutable" : "no-store",
    });

    createReadStream(filePath)
      .on("error", (error) => {
        console.error("[omivoid] static file error", error);
        response.destroy();
      })
      .pipe(response);
  });

  // Retry briefly: a previous instance may still be releasing the port.
  for (let attempt = 1; ; attempt++) {
    try {
      await new Promise<void>((resolve, reject) => {
        const onError = (error: Error) => reject(error);
        server.once("error", onError);
        server.listen(RENDERER_PORT, "127.0.0.1", () => {
          server.off("error", onError);
          resolve();
        });
      });
      break;
    } catch (error) {
      if (attempt >= 10) throw error;
      await delay(300);
    }
  }

  return {
    origin: RENDERER_ORIGIN,
    close: () =>
      new Promise<void>((resolve, reject) => {
        server.close((error) => (error ? reject(error) : resolve()));
      }),
  };
}

let staticServer: StaticServer | null = null;
let mainWindow: BrowserWindow | null = null;
let tray: Tray | null = null;
let isQuitting = false;

async function createWindow(): Promise<BrowserWindow> {
  const saved = loadWindowState();

  const window = new BrowserWindow({
    width: saved.width,
    height: saved.height,
    ...(saved.x !== undefined && saved.y !== undefined ? { x: saved.x, y: saved.y } : {}),
    minWidth: 680,
    minHeight: 480,
    show: false,
    backgroundColor: nativeTheme.shouldUseDarkColors ? "#0a0a0a" : "#ffffff",
    autoHideMenuBar: true,
    webPreferences: {
      preload: path.join(__dirname, "preload.js"),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
      spellcheck: false,
    },
  });

  trackWindowState(window);
  if (saved.maximized) window.maximize();

  window.once("ready-to-show", () => window.show());

  // Closing the window hides it to the tray instead of quitting; a real quit
  // (tray menu, platform quit) sets `isQuitting` and lets the close through.
  window.on("close", (event) => {
    if (isQuitting) return;
    event.preventDefault();
    window.hide();
  });

  let rendererOrigin = DEV_URL;
  if (!rendererOrigin) {
    staticServer ??= await startStaticServer(path.join(app.getAppPath(), "out"));
    rendererOrigin = staticServer.origin;
  }

  // The renderer must never navigate away from its own local origin.
  window.webContents.setWindowOpenHandler(() => ({ action: "deny" }));
  window.webContents.on("will-navigate", (event, navigationUrl) => {
    if (!navigationUrl.startsWith(rendererOrigin)) {
      event.preventDefault();
      console.error("[omivoid] blocked navigation", navigationUrl);
    }
  });

  await window.loadURL(rendererOrigin);
  return window;
}

/** Shows and focuses the main window (restoring it first if minimized). */
function showMainWindow(): void {
  if (!mainWindow || mainWindow.isDestroyed()) return;
  if (mainWindow.isMinimized()) mainWindow.restore();
  mainWindow.show();
  mainWindow.focus();
}

function createTray(): void {
  const iconPath = path.join(__dirname, "..", "assets", "tray.png");
  const icon = nativeImage.createFromPath(iconPath);
  if (icon.isEmpty()) {
    console.error("[omivoid] tray icon not found, skipping tray:", iconPath);
    return;
  }

  tray = new Tray(icon);
  tray.setToolTip("Omivoid");
  tray.setContextMenu(
    Menu.buildFromTemplate([
      { label: "Show Omivoid", click: () => showMainWindow() },
      { type: "separator" },
      {
        label: "Quit Omivoid",
        click: () => {
          isQuitting = true;
          app.quit();
        },
      },
    ]),
  );
  tray.on("click", () => showMainWindow());
}

function registerGlobalShortcuts(): void {
  const registered = globalShortcut.register(QUICK_ADD_ACCELERATOR, () => {
    showMainWindow();
    mainWindow?.webContents.send(QUICK_ADD_CHANNEL);
  });
  if (!registered) {
    console.error("[omivoid] could not register the global quick-add shortcut");
    return;
  }
  if (isDev) {
    console.log(`[omivoid] global quick-add shortcut registered (${QUICK_ADD_ACCELERATOR}).`);
  }
}

app.on("before-quit", () => {
  isQuitting = true;
});

app.on("will-quit", () => {
  globalShortcut.unregisterAll();
  tray?.destroy();
  tray = null;
  void staticServer?.close().catch((error) => {
    console.error("[omivoid] failed to stop the local static server", error);
  });
});

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") {
    app.quit();
  }
});

// A second launch reveals the existing instance instead of opening another
// window (or, in production, colliding with it over the loopback port).
if (!app.requestSingleInstanceLock()) {
  app.quit();
} else {
  app.on("second-instance", () => showMainWindow());

  app.whenReady().then(() => {
    if (isDev) {
      console.log(`[omivoid] ${app.getName()} ready — local-only renderer.`);
    }

    void createWindow()
      .then((window) => {
        mainWindow = window;
        createTray();
        registerGlobalShortcuts();
      })
      .catch((error) => {
        console.error("[omivoid] failed to open the window", error);
        app.quit();
      });

    app.on("activate", () => {
      if (BrowserWindow.getAllWindows().length === 0) {
        void createWindow().then((window) => {
          mainWindow = window;
        });
      } else {
        showMainWindow();
      }
    });
  });
}
