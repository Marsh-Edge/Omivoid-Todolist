# PLAN — omivoid-todolist

Local-first Todo / task-management app. Next.js 16 (static export) + Dexie/IndexedDB + Electron.
Rules are permanent and live in `AGENTS.md`. Work phase by phase; **STOP for approval after each phase.**

## Phase status

- [x] **Step 0** — AGENTS.md + PLAN.md
- [x] **Phase 1** — Foundation + Electron proof (no real features)
- [x] **Phase 2** — Tier 1 core: tasks, subtasks, projects, tags, smart views
- [x] **Phase 3** — Tier 1 rest: search, filters, command palette, shortcuts, import/export, dark/light mode
- [x] **Phase 4** — Tier 2 features, in small groups (STOP after each group)
- [x] **Phase 5** — Tier 3 (only if performance budget allows), polish, animations, performance audit, tests

## Phase 1 — Foundation + Electron proof

Pass condition:
1. `npm run build` works → static export in `out/`
2. `npm run electron:dev` builds, compiles the Electron shell, and opens the desktop window
3. Data written through the test screen **survives a full app quit + relaunch** (IndexedDB persistence proof)

Deliverables:
- Static export config; `src/` folder structure; Tailwind v4 + shadcn/ui (`button`, `input` only)
- Space Grotesk vendored as woff2 via `next/font/local` (no network at build or runtime)
- Dexie schema **v1** with full indexes + migration stub; Zod-validated repository layer
- Tiny test screen: add / list (live query) / complete / delete a task
- Electron shell: `contextIsolation: true`, `nodeIntegration: false`, `sandbox: true`, minimal preload;
  production serves `out/` from a loopback-only local static server (stable origin for IndexedDB)
- `electron-builder.yml` wired (win nsis + linux AppImage)

Scripts: `dev` (web HMR), `build`, `lint`, `electron:compile`, `electron:dev` (static-build mode:
`next build` → `tsc` → `electron .`), `electron:build` (`… && electron-builder --win`).
> Renderer tweaks require re-running `electron:dev`; use `npm run dev` for fast web iteration.

## Phase 2 — Tier 1 core

- Task CRUD with subtasks (nested, collapsible), drag & drop reorder
- Priority, due date/time, status (Todo / In Progress / Done), tags with colors
- Projects/lists with nesting, icons, colors
- Smart views: Inbox, Today, Upcoming, Overdue, Completed, Important, Trash (restore)
- Zustand store (selector-based), virtualized lists (`@tanstack/react-virtual`)
- Vitest scaffold + DB-layer tests (fake-indexeddb)

## Phase 3 — Tier 1 rest

- Instant local search; filters / sort / group-by
- Command palette (Ctrl/Cmd+K), keyboard shortcuts
- Export / import all data as JSON (Zod-validated, friendly errors + toasts)
- Dark/light mode: manual switch or follow system

## Phase 4 — Tier 2 (small groups, STOP after each group)

1. Markdown notes per task (lazy-loaded, live preview) + wiki-style `[[links]]` with backlinks panel
2. Kanban board + Calendar views (lazy-loaded)
3. Quick-add with natural-language parsing (tested)
4. Recurring tasks (tested) + Electron desktop notifications
5. Undo/redo + rolling local backups
6. Statistics page with lightweight charts (lazy-loaded)
7. Desktop extras: tray, global quick-add shortcut, window size/position memory, single-instance lock

## Phase 5 — Tier 3 + polish (only if performance budget allows)

- Graph view, Pomodoro timer, timeline-lite, saved filters, Markdown export (each optional)
- Animations (CSS first), accessibility pass, performance audit at 10,000 tasks
- Full test suite; final README (Windows + Linux setup/build/packaging)

## Performance budget (checked at the end of every phase)

- Report `out/_next/static` bundle size (JS + CSS)
- Startup impression; smooth interactions target ~60fps @ 10k tasks
- Lazy-load: Markdown editor, graph, charts, calendar, command palette
- Every common query must hit an IndexedDB index

## Decisions log

| Decision | Rationale |
| --- | --- |
| Removed `cacheComponents`, `partialPrefetching` | Server-caching features; useless (and risky) under `output: 'export'` for a pure client app |
| Space Grotesk vendored woff2 in repo | Local-only rule; `next/font/local` gives preload + metric fallback, zero build-time fetches |
| `electron:dev` = static-build mode (user choice) | Closest to production; `npm run dev` remains for fast web iteration |
| Prod renderer served from `127.0.0.1` (not `file://`) | Stable origin required for reliable IndexedDB persistence |
| No Vitest in Phase 1 | Keep phase minimal per spec; tests scaffold lands with the real DB layer in Phase 2 |
