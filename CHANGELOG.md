# Changelog

All notable changes to this project are documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to
[Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

Nothing yet.

## [0.1.0] — 2026-10-22

First public release. A local-first todo / task manager that ships as a static
web export and as a desktop app (Electron). **No accounts, no servers, no
telemetry, no network requests of any kind** — every byte of user data stays on
the device it was created on.

### Added

#### Tasks and organisation

- Tasks with subtasks (nested, collapsible), priority, status (Todo / In
  Progress / Done), due date and time, tags with colors
- Projects with nesting, icons and colors; projects can be deleted with a
  cascade to Inbox and an undo step
- Smart views: Inbox, Today, Upcoming, Overdue, Completed, Important, Trash
  (with restore)
- List, Kanban board and month calendar view modes (lazy-loaded)
- Natural-language quick-add: `Submit report !high #work tomorrow 5pm`
- Recurring tasks — completing one reschedules the next occurrence
- Instant local search, filters, sort, group-by and saved filter presets

#### Notes, links and statistics

- Markdown notes per task with `[[wiki links]]` and a backlinks panel
- A `/stats` page with lightweight charts (completions trend, status and
  priority breakdown, tasks per project)

#### Desktop app (Electron)

- System tray integration — closing the window keeps the app running
- Global quick-add shortcut (`Ctrl/Cmd+Alt+N`)
- Window size and position memory, single-instance lock
- OS notifications when tasks come due
- Production renderer served from a loopback-only static server
  (`http://127.0.0.1:41739`) so IndexedDB survives restarts

#### Data and backups

- JSON export / import of all data, plus Markdown export of the current view
  or everything
- Rolling local snapshots (the 5 newest are kept automatically, one per app
  start, at most every ~6 hours) with restore after validation
- Undo / redo (`Ctrl/Cmd+Z`, `Ctrl/Cmd+Shift+Z`, `Ctrl/Cmd+Y`)

#### Interface

- Command palette (`Ctrl/Cmd+K`) and keyboard shortcuts (`Ctrl/Cmd+F` search,
  `Ctrl/Cmd+N` quick-add)
- Dark / light / system theme
- Accessibility: skip-to-content link, focus-managed detail panel, keyboard
  status moves on the board, `prefers-reduced-motion` support
- i18n-ready string table (`t()`), currently English
- Virtualized lists and board columns — smooth at 10,000+ tasks

#### Security

- Strict hash-based Content Security Policy served by the static server
- Electron fuses hardened: `RunAsNode` off, `NODE_OPTIONS` and `--inspect`
  injection off, ASAR integrity validation on, code may only load from inside
  `app.asar`
- Permission lockdown (only notifications granted), non-loopback request
  guard, navigation and popup lockdown, DevTools disabled in production
- SHA-256 checksums published with every release

### Technical

- Next.js 16 with `output: "export"`, Dexie 4 (IndexedDB) with a
  Zod-validated repository layer, Zustand for UI state, Tailwind v4 with
  shadcn/ui, `lucide-react` and a locally bundled Space Grotesk
- TypeScript in strict mode with `noUncheckedIndexedAccess`
- 240 unit tests (Vitest + jsdom + `fake-indexeddb`)
- CI and tag-triggered release workflows on GitHub Actions

[Unreleased]: https://github.com/Marsh-Edge/Omivoid-Todolist/compare/v0.1.0...HEAD
[0.1.0]: https://github.com/Marsh-Edge/Omivoid-Todolist/releases/tag/v0.1.0
