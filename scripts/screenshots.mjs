/**
 * Captures the README screenshots from the static export.
 *
 * The app is driven through the Chrome DevTools Protocol by a locally
 * installed Chromium (Edge or Chrome on Windows, Chrome/Chromium elsewhere).
 * No npm dependency is added and nothing ever leaves the machine: the browser
 * is launched with DNS resolution disabled, so only the loopback origin of the
 * local preview server is reachable.
 *
 * The seed data is imported through the app's *own* JSON import path (the
 * command palette's file input), so the screenshots show exactly what a user
 * sees after importing a backup — no schema drift, no hand-written fixtures.
 *
 * Usage:
 *   npm run build                 # the script serves ./out
 *   npm run seed                  # writes omivoid-seed.json (60 tasks)
 *   node scripts/screenshots.mjs
 *
 * Options:
 *   --url http://127.0.0.1:3000  base URL of a running preview server
 *   --out docs/screenshots        output directory
 *   --seed omivoid-seed.json      seed file to import
 */

import { spawn } from "node:child_process";
import { existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import { setTimeout as sleep } from "node:timers/promises";
import { fileURLToPath } from "node:url";

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

const VIEWPORT = { width: 1440, height: 900, deviceScaleFactor: 1, mobile: false };

/* -------------------------------------------------------------------------- */
/* Arguments                                                                   */
/* -------------------------------------------------------------------------- */

function parseArgs(argv) {
  const args = {
    url: "http://127.0.0.1:3000",
    outDir: path.join(repoRoot, "docs", "screenshots"),
    seedFile: path.join(repoRoot, "omivoid-seed.json"),
  };
  for (let i = 0; i < argv.length; i += 1) {
    if (argv[i] === "--url" && argv[i + 1]) {
      args.url = argv[i + 1].replace(/\/+$/, "");
      i += 1;
    } else if (argv[i] === "--out" && argv[i + 1]) {
      args.outDir = path.resolve(process.cwd(), argv[i + 1]);
      i += 1;
    } else if (argv[i] === "--seed" && argv[i + 1]) {
      args.seedFile = path.resolve(process.cwd(), argv[i + 1]);
      i += 1;
    }
  }
  return args;
}

/* -------------------------------------------------------------------------- */
/* Browser discovery                                                           */
/* -------------------------------------------------------------------------- */

function browserCandidates() {
  if (process.platform === "win32") {
    return [
      process.env.PROGRAMFILES && path.join(process.env.PROGRAMFILES, "Microsoft/Edge/Application/msedge.exe"),
      process.env["PROGRAMFILES(X86)"] && path.join(process.env["PROGRAMFILES(X86)"], "Microsoft/Edge/Application/msedge.exe"),
      process.env.LOCALAPPDATA && path.join(process.env.LOCALAPPDATA, "Microsoft/Edge/Application/msedge.exe"),
      process.env.PROGRAMFILES && path.join(process.env.PROGRAMFILES, "Google/Chrome/Application/chrome.exe"),
      process.env["PROGRAMFILES(X86)"] && path.join(process.env["PROGRAMFILES(X86)"], "Google/Chrome/Application/chrome.exe"),
      process.env.LOCALAPPDATA && path.join(process.env.LOCALAPPDATA, "Google/Chrome/Application/chrome.exe"),
    ].filter(Boolean);
  }
  if (process.platform === "darwin") {
    return [
      "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
      "/Applications/Microsoft Edge.app/Contents/MacOS/Microsoft Edge",
      "/Applications/Chromium.app/Contents/MacOS/Chromium",
    ];
  }
  return [
    "/usr/bin/google-chrome",
    "/usr/bin/google-chrome-stable",
    "/usr/bin/chromium",
    "/usr/bin/chromium-browser",
    "/snap/bin/chromium",
  ];
}

function findBrowser() {
  const override = process.env.OMIVOID_BROWSER;
  if (override) {
    if (!existsSync(override)) throw new Error(`OMIVOID_BROWSER does not exist: ${override}`);
    return override;
  }
  const found = browserCandidates().find((candidate) => candidate && existsSync(candidate));
  if (!found) {
    throw new Error(
      "No Chromium browser found. Install Edge/Chrome or set OMIVOID_BROWSER to the executable path.",
    );
  }
  return found;
}

/** Scratch directory for the throwaway browser profile. */
function scratchDir() {
  const preferred = path.join(process.env.LOCALAPPDATA ?? "", "Temp", "opencode");
  const base = existsSync(preferred) ? preferred : os.tmpdir();
  return path.join(base, `omivoid-shots-${process.pid}`);
}

/* -------------------------------------------------------------------------- */
/* Minimal CDP client                                                          */
/* -------------------------------------------------------------------------- */

class Cdp {
  constructor(socket) {
    this.socket = socket;
    this.nextId = 0;
    this.pending = new Map();
    this.listeners = new Map();
    socket.addEventListener("message", (event) => {
      const message = JSON.parse(event.data);
      if (message.id !== undefined) {
        const entry = this.pending.get(message.id);
        if (!entry) return;
        this.pending.delete(message.id);
        if (message.error) {
          entry.reject(
            new Error(`${entry.method} failed: ${message.error.message} (${message.error.code})`),
          );
        } else entry.resolve(message.result);
        return;
      }
      const handlers = this.listeners.get(message.method);
      if (handlers) for (const handler of handlers) handler(message.params);
    });
  }

  static async connect(url) {
    const socket = new WebSocket(url);
    await new Promise((resolve, reject) => {
      socket.addEventListener("open", resolve, { once: true });
      socket.addEventListener("error", () => reject(new Error("CDP socket failed")), { once: true });
    });
    return new Cdp(socket);
  }

  send(method, params = {}) {
    const id = (this.nextId += 1);
    return new Promise((resolve, reject) => {
      this.pending.set(id, { resolve, reject, method });
      this.socket.send(JSON.stringify({ id, method, params }));
    });
  }

  on(method, handler) {
    const handlers = this.listeners.get(method) ?? [];
    handlers.push(handler);
    this.listeners.set(method, handlers);
  }

  close() {
    this.socket.close();
  }
}

/* -------------------------------------------------------------------------- */
/* Page helpers                                                                */
/* -------------------------------------------------------------------------- */

async function evaluate(cdp, expression) {
  const result = await cdp.send("Runtime.evaluate", {
    expression,
    awaitPromise: true,
    returnByValue: true,
  });
  if (result.exceptionDetails) {
    throw new Error(result.exceptionDetails.exception?.description ?? "evaluate failed");
  }
  return result.result?.value;
}

async function navigate(cdp, url) {
  const loaded = new Promise((resolve) => cdp.on("Page.loadEventFired", resolve));
  await cdp.send("Page.navigate", { url });
  await loaded;
  await sleep(400);
}

/**
 * Asserts that the expected view is on screen, so a silently broken view never
 * produces a misleading README image. `check` is a JavaScript expression that
 * must evaluate to a truthy value.
 */
async function assert(cdp, file, check) {
  const ok = await evaluate(cdp, `Boolean(${check})`);
  if (!ok) {
    const text = await evaluate(cdp, `document.body.innerText`);
    throw new Error(
      `Refusing to write ${path.basename(file)}: "${check}" was not true.\n--- page text ---\n${String(text).slice(0, 3000)}`,
    );
  }
}

/** Captures the current viewport as a PNG. */
async function capture(cdp, file) {
  const { data } = await cdp.send("Page.captureScreenshot", { format: "png", captureBeyondViewport: false });
  writeFileSync(file, Buffer.from(data, "base64"));
  console.log(`  wrote ${path.relative(repoRoot, file)}`);
}

/* -------------------------------------------------------------------------- */
/* Capture scenarios                                                           */
/* -------------------------------------------------------------------------- */

/** Imports the seed through the app's own validated JSON import path. */
function importSeedExpression(seedJson) {
  return `(async () => {
    window.confirm = () => true;
    const text = ${JSON.stringify(seedJson)};
    const file = new File([text], "omivoid-seed.json", { type: "application/json" });
    const transfer = new DataTransfer();
    transfer.items.add(file);
    const input = document.querySelector('input[type=file]');
    if (!input) return "no file input";
    input.files = transfer.files;
    input.dispatchEvent(new Event("change", { bubbles: true }));
    await new Promise((resolve) => setTimeout(resolve, 1500));
    return document.body.innerText.slice(0, 120);
  })()`;
}

/** Clicks a button by its accessible name. */
function clickByLabel(label) {
  return `(() => {
    const buttons = Array.from(document.querySelectorAll("button"));
    const button = buttons.find((b) => (b.getAttribute("aria-label") || "").toLowerCase().includes(${JSON.stringify(label.toLowerCase())}));
    if (!button) return "not found: " + ${JSON.stringify(label)};
    button.click();
    return "clicked";
  })()`;
}

async function run({ cdp, args, seedJson }) {
  const outDir = args.outDir;
  mkdirSync(outDir, { recursive: true });

  // The calendar header renders the month as "MMMM yyyy".
  const now = new Date();
  const monthHeading = `${now.toLocaleString("en-US", { month: "long" })} ${now.getFullYear()}`;

  await cdp.send("Page.enable");
  await cdp.send("Runtime.enable");
  await cdp.send("Emulation.setDeviceMetricsOverride", VIEWPORT);

  console.log(`[shots] opening ${args.url}`);
  await navigate(cdp, `${args.url}/`);

  if (seedJson) {
    console.log("[shots] importing seed data through the app's import flow");
    const feedback = await evaluate(cdp, importSeedExpression(seedJson));
    console.log(`[shots] import finished (${String(feedback).split("\n")[0]})`);
  }

  console.log("[shots] capturing");
  await assert(cdp, "list.png", `document.body.innerText.toLowerCase().includes("inbox")`);
  await capture(cdp, path.join(outDir, "list.png"));

  const clickedBoard = await evaluate(cdp, clickByLabel("Board"));
  if (clickedBoard !== "clicked") throw new Error(`Could not switch to the board view (${clickedBoard}).`);
  await sleep(900);
  // Column headings are uppercased by CSS, so compare case-insensitively.
  await assert(cdp, "board.png", `document.body.innerText.toLowerCase().includes("in progress")`);
  await capture(cdp, path.join(outDir, "board.png"));

  const clickedCalendar = await evaluate(cdp, clickByLabel("Calendar"));
  if (clickedCalendar !== "clicked") throw new Error(`Could not switch to the calendar view (${clickedCalendar}).`);
  await sleep(900);
  await assert(
    cdp,
    "calendar.png",
    `document.body.innerText.toLowerCase().includes(${JSON.stringify(monthHeading.toLowerCase())})`,
  );
  await capture(cdp, path.join(outDir, "calendar.png"));

  const clickedPalette = await evaluate(cdp, clickByLabel("palette"));
  if (clickedPalette !== "clicked") throw new Error(`Could not open the command palette (${clickedPalette}).`);
  await sleep(500);
  await assert(cdp, "command-palette.png", `document.querySelector('input[placeholder*="command" i]')`);
  await capture(cdp, path.join(outDir, "command-palette.png"));
  await evaluate(cdp, `(() => { document.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape", bubbles: true })); return 1; })()`);
  await sleep(300);

  await navigate(cdp, `${args.url}/stats`);
  await sleep(800);
  await assert(
    cdp,
    "stats.png",
    `document.body.innerText.toLowerCase().includes("statistics") && !document.body.innerText.includes("No tasks yet")`,
  );
  await capture(cdp, path.join(outDir, "stats.png"));

  // Dark theme: the theme is a tiny localStorage setting, applied on load.
  await navigate(cdp, `${args.url}/`);
  await evaluate(cdp, `(() => { window.localStorage.setItem("omivoid-theme", "dark"); return 1; })()`);
  await navigate(cdp, `${args.url}/`);
  await sleep(600);
  await assert(cdp, "list-dark.png", `document.documentElement.classList.contains("dark") && document.body.innerText.toLowerCase().includes("inbox")`);
  await capture(cdp, path.join(outDir, "list-dark.png"));
}

/* -------------------------------------------------------------------------- */
/* Entrypoint                                                                  */
/* -------------------------------------------------------------------------- */

async function main() {
  const args = parseArgs(process.argv.slice(2));

  if (!existsSync(args.seedFile)) {
    console.error(`Seed file not found: ${path.relative(repoRoot, args.seedFile)} — run "npm run seed" first.`);
    process.exit(1);
  }
  const seedJson = readFileSync(args.seedFile, "utf8");

  const browser = findBrowser();
  const userDataDir = scratchDir();
  const port = 9222 + (process.pid % 500);
  console.log(`[shots] launching ${browser} on port ${port}`);

  const child = spawn(
    browser,
    [
      "--headless=new",
      `--remote-debugging-port=${port}`,
      `--user-data-dir=${userDataDir}`,
      "--no-first-run",
      "--no-default-browser-check",
      "--disable-extensions",
      "--disable-gpu",
      "--hide-scrollbars",
      "--disable-background-networking",
      "--disable-component-update",
      "--disable-sync",
      // Locality: resolve nothing but the loopback preview server.
      "--host-resolver-rules=MAP * ~NOTFOUND, EXCLUDE 127.0.0.1",
      `--window-size=${VIEWPORT.width},${VIEWPORT.height}`,
      "about:blank",
    ],
    { stdio: "ignore" },
  );

  let cdp;
  let failure = null;
  try {
    // Wait for the DevTools endpoint.
    let version;
    for (let attempt = 0; attempt < 100; attempt += 1) {
      try {
        const response = await fetch(`http://127.0.0.1:${port}/json/version`);
        if (response.ok) {
          version = await response.json();
          break;
        }
      } catch {
        /* not up yet */
      }
      await sleep(150);
    }
    if (!version) throw new Error("Browser did not expose a DevTools endpoint in time.");

    const created = await fetch(`http://127.0.0.1:${port}/json/new?about:blank`, { method: "PUT" });
    const target = await created.json();
    cdp = await Cdp.connect(target.webSocketDebuggerUrl);

    await run({ cdp, args, seedJson });
    console.log("[shots] done");
  } catch (error) {
    failure = error;
  } finally {
    cdp?.close();
    child.kill();
    await sleep(700);
    try {
      rmSync(userDataDir, { recursive: true, force: true });
    } catch {
      // The browser may still hold a lock on the profile — it is in the
      // scratch directory and does not affect the repository.
    }
  }

  if (failure) throw failure;
}

main().catch((error) => {
  console.error("[shots] failed:", error);
  process.exit(1);
});
