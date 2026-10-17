import { app, screen, type BrowserWindow } from "electron";
import { readFileSync, writeFileSync } from "node:fs";
import path from "node:path";

/**
 * Remembers the window size/position (and maximized state) between launches.
 *
 * Stored as a small JSON file in the app's userData folder — no dependency, no
 * network. Anything malformed, out of range, or positioned off every connected
 * display is discarded so the window can never open somewhere unreachable.
 */

export interface WindowState {
  width: number;
  height: number;
  x?: number;
  y?: number;
  maximized: boolean;
}

const DEFAULT_WIDTH = 1100;
const DEFAULT_HEIGHT = 760;
const MIN_WIDTH = 680;
const MIN_HEIGHT = 480;
const SAVE_DEBOUNCE_MS = 400;

function stateFilePath(): string {
  return path.join(app.getPath("userData"), "window-state.json");
}

function defaultState(): WindowState {
  return { width: DEFAULT_WIDTH, height: DEFAULT_HEIGHT, maximized: false };
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function isFiniteNumber(value: unknown): value is number {
  return typeof value === "number" && Number.isFinite(value);
}

/** True when `bounds` overlaps the work area of at least one connected display. */
function isVisibleOnSomeDisplay(bounds: {
  x: number;
  y: number;
  width: number;
  height: number;
}): boolean {
  return screen.getAllDisplays().some(({ workArea }) => {
    const overlapsX = bounds.x < workArea.x + workArea.width;
    const overlapsY = bounds.y < workArea.y + workArea.height;
    return (
      overlapsX &&
      overlapsY &&
      bounds.x + bounds.width > workArea.x &&
      bounds.y + bounds.height > workArea.y
    );
  });
}

/** Loads the last window geometry; falls back to defaults when absent or unusable. */
export function loadWindowState(): WindowState {
  let parsed: unknown;
  try {
    parsed = JSON.parse(readFileSync(stateFilePath(), "utf8"));
  } catch {
    return defaultState();
  }

  if (!isRecord(parsed)) return defaultState();

  const rawWidth = isFiniteNumber(parsed.width) ? Math.round(parsed.width) : DEFAULT_WIDTH;
  const rawHeight = isFiniteNumber(parsed.height) ? Math.round(parsed.height) : DEFAULT_HEIGHT;
  const maximized = parsed.maximized === true;

  if (rawWidth < MIN_WIDTH || rawHeight < MIN_HEIGHT) {
    return { width: DEFAULT_WIDTH, height: DEFAULT_HEIGHT, maximized };
  }

  const state: WindowState = { width: rawWidth, height: rawHeight, maximized };

  // Only restore a position that still lands on a connected display; otherwise
  // let Electron center the window on the primary display.
  if (isFiniteNumber(parsed.x) && isFiniteNumber(parsed.y)) {
    const x = Math.round(parsed.x);
    const y = Math.round(parsed.y);
    if (isVisibleOnSomeDisplay({ x, y, width: rawWidth, height: rawHeight })) {
      state.x = x;
      state.y = y;
    }
  }

  return state;
}

/** Writes the geometry to disk, ignoring failures (state is a nicety, not data). */
export function saveWindowState(state: WindowState): void {
  try {
    writeFileSync(stateFilePath(), JSON.stringify(state), "utf8");
  } catch (error) {
    console.error("[omivoid] could not persist window state", error);
  }
}

/**
 * Persists the window size/position (debounced) as the user moves or resizes it,
 * plus a final flush when the window closes. Maximized windows store their
 * restored bounds (`getNormalBounds`) so un-maximizing later stays sensible.
 */
export function trackWindowState(window: BrowserWindow): void {
  let timer: NodeJS.Timeout | null = null;

  const capture = (): WindowState => {
    const bounds = window.getNormalBounds();
    return {
      x: bounds.x,
      y: bounds.y,
      width: bounds.width,
      height: bounds.height,
      maximized: window.isMaximized(),
    };
  };

  const persist = (): void => {
    if (timer) {
      clearTimeout(timer);
      timer = null;
    }
    saveWindowState(capture());
  };

  const schedule = (): void => {
    if (timer) clearTimeout(timer);
    timer = setTimeout(persist, SAVE_DEBOUNCE_MS);
  };

  window.on("resize", schedule);
  window.on("move", schedule);
  window.on("maximize", schedule);
  window.on("unmaximize", schedule);
  window.on("close", persist);
}
