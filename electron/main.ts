import {
  app,
  BrowserWindow,
  Menu,
  Tray,
  globalShortcut,
  nativeImage,
  nativeTheme,
  session,
} from "electron";
import path from "node:path";
import { loadWindowState, trackWindowState } from "./windowState";
import { startStaticServer, type StaticServer } from "./staticServer";
import { isAllowedPermission, isAllowedRequest } from "./requestGuard";

/**
 * Omivoid desktop shell.
 *
 * - Never loads anything remote: production is served from a loopback-only
 *   static server (stable origin → reliable IndexedDB persistence), never
 *   `file://`.
 * - `contextIsolation: true`, `nodeIntegration: false`, `sandbox: true`,
 *   DevTools disabled in production.
 * - External navigation and popups are denied; every session request that
 *   would leave the machine is cancelled; only notification permission is
 *   granted (needed for due-task reminders).
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

/**
 * Renderer channel used by the global quick-add shortcut. Duplicated in
 * `preload.ts` (which only carries a "must match" comment): sandboxed
 * preloads cannot require local modules, so the constant can't be shared.
 */
const QUICK_ADD_CHANNEL = "omivoid:quick-add";

/** Global accelerator that reveals the window and focuses the quick-add box. */
const QUICK_ADD_ACCELERATOR = "CommandOrControl+Alt+N";

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
      // Keep the inspector available while developing the shell; in a shipped
      // build no shortcut may open it.
      ...(isDev ? {} : { devTools: false }),
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
    staticServer ??= await startStaticServer(path.join(app.getAppPath(), "out"), RENDERER_PORT);
    rendererOrigin = staticServer.origin;
  }
  const rendererBaseOrigin = new URL(rendererOrigin).origin;

  // The renderer must never navigate away from its own local origin.
  window.webContents.setWindowOpenHandler(() => ({ action: "deny" }));
  // No <webview> is part of the app; refuse any attempt to attach one.
  window.webContents.on("will-attach-webview", (event) => event.preventDefault());
  window.webContents.on("will-navigate", (event, navigationUrl) => {
    let allowed = false;
    try {
      // Origin equality (not a prefix check): `http://127.0.0.1:41739.evil`
      // would pass a `startsWith` test on the origin string.
      allowed = new URL(navigationUrl).origin === rendererBaseOrigin;
    } catch {
      allowed = false;
    }
    if (!allowed) {
      event.preventDefault();
      console.error("[omivoid] blocked navigation", navigationUrl);
    }
  });

  await window.loadURL(rendererOrigin);
  return window;
}

/**
 * Locks the renderer session down to what the app actually needs.
 *
 * - Permission requests: only OS notifications (due-task reminders) are
 *   granted; every other permission (camera, mic, geolocation, …) is denied.
 * - Device permissions (HID/serial/USB): always denied.
 * - In production, any request that would leave the machine is cancelled and
 *   logged, so the "local-only" promise is enforced rather than assumed.
 */
function lockDownSession(): void {
  const defaultSession = session.defaultSession;

  defaultSession.setPermissionRequestHandler((_contents, permission, callback) => {
    callback(isAllowedPermission(permission));
  });
  defaultSession.setPermissionCheckHandler((_contents, permission) =>
    isAllowedPermission(permission),
  );
  defaultSession.setDevicePermissionHandler(() => false);

  if (isDev) return;
  defaultSession.webRequest.onBeforeRequest((details, callback) => {
    const allowed = isAllowedRequest(details.url);
    if (!allowed) {
      console.error("[omivoid] blocked non-local request", details.url);
    }
    callback({ cancel: !allowed });
  });
}

/** Shows and focuses the main window (restoring it first if minimized). */
function showMainWindow(): void {  if (!mainWindow || mainWindow.isDestroyed()) return;
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

    lockDownSession();

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
