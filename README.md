# Omivoid

A local-first todo / task manager. Everything is stored on your device in IndexedDB — there are **no network requests, no accounts, and no telemetry**, ever (not even fonts or icons; they are bundled locally). Ships as a web static export and as a desktop app (Electron).

## Stack

- **Next.js 16** with `output: 'export'` (static, client-only; no API routes/SSR)
- **Dexie / IndexedDB** for storage, with **Zod**-validated repositories
- **Zustand** (selector-based) for UI state
- **Tailwind v4** + shadcn/ui, **lucide-react**, **Space Grotesk** (all bundled locally)
- **Electron** shell with `contextIsolation`, `sandbox`, and a loopback-only static server

## Features

- Tasks with subtasks, priority, status, due date/time, tags (colors), projects (nesting, icons + colors)
- Smart views: Inbox, Today, Upcoming, Overdue, Completed, Important, Trash (restore)
- List, **Kanban board** and **month calendar** view modes (lazy-loaded)
- **Markdown notes** per task with `[[wiki links]]` and a backlinks panel
- **Natural-language quick-add** (`Submit report !high #work tomorrow 5pm`)
- **Recurring tasks** (completing one reschedules the next occurrence)
- **Desktop notifications** for tasks as they come due
- **Undo / redo** (`Ctrl/Cmd+Z`, `Ctrl/Cmd+Shift+Z`, `Ctrl/Cmd+Y`) and **rolling local backups**
- **Lightweight charts** on a global `/stats` page (completions trend, status/priority breakdown, tasks per project)
- Instant local search, filters, sort and group-by, plus **saved filter presets**
- Command palette (`Ctrl/Cmd+K`) and keyboard shortcuts (`Ctrl/Cmd+F` search, `Ctrl/Cmd+N` quick-add)
- Dark / light / system theme
- Export / import all data as a JSON backup; export the current view or everything as **Markdown**
- Virtualized lists and board columns for large datasets (smooth at 10,000+ tasks)
- Desktop extras: **system tray** (closing the window keeps the app running), **global quick-add** (`Ctrl/Cmd+Alt+N`), window size/position memory, and a single-instance lock
- Accessibility: skip-to-content link, focus-managed detail panel, keyboard status moves on the board, `prefers-reduced-motion` support

See `PLAN.md` for phase status (Phases 1–5 done) and `AGENTS.md` for the permanent project rules.

## Requirements

- Node.js 20+
- Windows (NSIS) or Linux (AppImage) for packaging

On Windows PowerShell, the execution policy may block `npm.ps1` — invoke
`npm.cmd` / `npx.cmd` instead.

## Develop

```bash
npm install
npm run dev        # web dev server with HMR at http://localhost:3000
```

## Test & lint

```bash
npm run test            # Vitest (fake-indexeddb for the DB layer)
npm run test:watch
npm run test:coverage   # informational, no threshold gate
npm run lint
```

## Build (web static export)

```bash
npm run build      # emits ./out
```

## Sample data (seed)

Generate a synthetic data set without typing anything:

```bash
npm run seed                 # 100 tasks (default)
npm run seed -- --count 1000 # custom size
npm run seed -- --out x.json # custom output file
```

This writes `omivoid-seed.json` (a valid Omivoid backup) in the project root.
Import it in the app via the command palette (`Ctrl/Cmd+K` → **Import data
(JSON)**); importing replaces all current data. `omivoid-seed.json` is
gitignored.

## Data & backups

- All data lives in IndexedDB on the app's origin (browser profile / Electron userData). Nothing leaves the device.
- Rolling snapshots: the 5 newest are kept automatically (one per app start, at most every ~6 h). Manage them from the command palette → **Backups**; restore replaces all data after validation.
- JSON export/import covers tasks, projects, tags, and saved filters.
- Desktop window state is stored in `window-state.json` in the Electron userData folder.

## Desktop (Electron)

```bash
npm run electron:compile   # type-check/compile the Electron shell only
npm run electron:dev       # next build -> tsc -> electron . (production-like)
npm run electron:build     # next build -> tsc -> electron-builder --win
```

`electron:dev` uses a full static build, so renderer changes require re-running
it; use `npm run dev` for fast web iteration. In production the renderer is
served from `http://127.0.0.1:41739` (a fixed loopback origin) so IndexedDB
persistence survives restarts.

Closing the window hides Omivoid to the system tray rather than quitting; use
the tray menu's **Quit Omivoid** (or the app menu) to exit. `Ctrl/Cmd+Alt+N`
focuses the quick-add box from anywhere.

### Packaging

```bash
npm run electron:build        # Windows → release/Omivoid-<version>-setup.exe
npx electron-builder --linux  # Linux  → release/Omivoid-<version>.AppImage
                              # (run `npm run build && npm run electron:compile` first)
```

Notes:

- App icon: `build/icon.png` (512×512), auto-detected by electron-builder (`buildResources: build`).
- The packaged `app.asar` is ~1.4 MB: only the static export and the compiled shell are included — runtime `node_modules` are excluded (the shell uses Electron/Node built-ins only).
- On Linux, the system tray needs a desktop environment with AppIndicator support.

### Release verification & SmartScreen

Release builds are **unsigned** (no code-signing certificate), so Windows
SmartScreen may warn "Windows protected your PC" on first run — click
**More info → Run anyway**. Verify the download integrity instead with the
published checksums:

```bash
npm run release:checksums   # writes release/SHA256SUMS.txt (sha256sum format)
```

On Windows: `Get-FileHash .\Omivoid-<version>-setup.exe -Algorithm SHA256`
and compare against `SHA256SUMS.txt`; on Linux: `sha256sum -c SHA256SUMS.txt`.

Hardening applied in production builds: strict hash-based CSP served by the
loopback static server, Electron fuses (ASAR integrity, `RunAsNode` off, etc.),
DevTools disabled, permission lockdown (notifications only), a non-loopback
request guard, and no external network access of any kind.

## Architecture pointers

| Area | Where |
| --- | --- |
| Database schema + migrations (Dexie v1–v6) | `src/db/` |
| Repository layer (only code that touches Dexie; Zod-validated) | `src/db/*Repository.ts` |
| Pure logic (filters, recurrence, NL parsing, stats, …) | `src/lib/` |
| Features (tasks, board, calendar, notes, stats, …) | `src/features/` |
| Electron main process + window state | `electron/` |
| Phase-by-phase development plan | `PLAN.md` |
| Permanent project rules | `AGENTS.md` |
