# Omivoid

A local-first Todo / task manager. Everything is stored on your device in
IndexedDB — there are **no network requests, no accounts, and no telemetry**.
Ships as a web static export and as a desktop app (Electron).

## Stack

- **Next.js 16** with `output: 'export'` (static, client-only; no API routes/SSR)
- **Dexie / IndexedDB** for storage, with **Zod**-validated repositories
- **Zustand** (selector-based) for UI state
- **Tailwind v4** + shadcn/ui, **lucide-react**, **Space Grotesk** (all bundled locally)
- **Electron** shell with `contextIsolation`, `sandbox`, and a loopback-only static server

## Features

- Tasks with subtasks, priority, status, due date/time, tags (colors), projects (nesting)
- Smart views: Inbox, Today, Upcoming, Overdue, Completed, Important, Trash (restore)
- List, **Kanban board** and **month calendar** view modes (lazy-loaded)
- **Markdown notes** per task with `[[wiki links]]` and a backlinks panel
- **Natural-language quick-add** (`Submit report !high #work tomorrow 5pm`)
- **Recurring tasks** (completing one reschedules the next occurrence)
- **Desktop notifications** for tasks as they come due
- **Undo / redo** (`Ctrl/Cmd+Z`, `Ctrl/Cmd+Shift+Z`, `Ctrl/Cmd+Y`) and **rolling local backups**
- **Lightweight charts** on a global `/stats` page (completions trend, status/priority breakdown, tasks per project)
- Instant local search, filters, sort and group-by
- Command palette (`Ctrl/Cmd+K`) and keyboard shortcuts (`Ctrl/Cmd+F` search, `Ctrl/Cmd+N` quick-add)
- Dark / light / system theme
- Export / import all data as a JSON backup
- Virtualized lists and board columns for large datasets
- Desktop extras: **system tray** (closing the window keeps the app running), **global quick-add** (`Ctrl/Cmd+Alt+N`), window size/position memory, and a single-instance lock

See `PLAN.md` for phase status (Phases 0–4 done; Phase 5 not started).

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
npm run test       # Vitest (fake-indexeddb for the DB layer)
npm run lint
```

## Build (web static export)

```bash
npm run build      # emits ./out
```

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
