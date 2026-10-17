# PLAN — omivoid-todolist

Local-first Todo / task-management app. Next.js 16 (static export) + Dexie/IndexedDB + Electron.
Rules are permanent and live in `AGENTS.md`. Work phase by phase; **STOP for approval after each phase.**

> **Status honesty note (2026-10-17).** A previous round marked Phases 3–5 complete while
> the features were only scaffolds or missing entirely (the "Phase 4 complete" commit
> changed no files). This revision corrects the record, makes Phase 3 genuinely
> functional, and re-scopes Phases 4–5 as *not started*.
>
> **Follow-up (2026-10-17, Group 7).** The delivered Phase 3–4 work was committed and
> audited: the working tree had **emptied `src/app/globals.css`** (the Tailwind v4
> import + theme tokens), leaving the web build unstyled — restored from `HEAD`, CSS is
> back to ~56 KB. The generated `scripts/*.cjs` perf-seed bundle was excluded from
> ESLint at the time (that ignore and the broken seed bundle were later removed in
> Phase 5 Step 0 — see below). Group 7 (desktop extras) is implemented and verified below.

## Phase status

- [x] **Step 0** — AGENTS.md + PLAN.md
- [x] **Phase 1** — Foundation + Electron proof (no real features)
- [x] **Phase 2** — Tier 1 core: tasks, subtasks, projects, tags, smart views
- [x] **Phase 3** — Tier 1 rest: search, filters, group-by, command palette, shortcuts, import/export, dark/light mode
- [x] **Phase 4** — Tier 2 features, in small groups (Groups 1–7 done)
- [ ] **Phase 5** — Tier 3 (only if performance budget allows), polish, animations, performance audit, tests — **in progress (Step 0 gap fixes + Step 1 perf audit done)**

## Phase 1 — Foundation + Electron proof

Pass condition:
1. `npm run build` works → static export in `out/`
2. `npm run electron:compile` / `npm run electron:dev` compile the Electron shell and open the desktop window
3. Data written through the test screen **survives a full app quit + relaunch** (IndexedDB persistence proof)

Deliverables (done):
- Static export config; `src/` folder structure; Tailwind v4 + shadcn/ui
- Space Grotesk vendored as woff2 via `next/font/local` (no network at build or runtime)
- Dexie schema **v1** with full indexes + migration stubs (v2, v3); Zod-validated repository layer
- Quick-add / list (live query) / complete / delete a task
- Electron shell: `contextIsolation: true`, `nodeIntegration: false`, `sandbox: true`, minimal preload;
  production serves `out/` from a loopback-only local static server (`127.0.0.1:41739`)
- `electron-builder.yml` wired (win nsis + linux AppImage)

Scripts: `dev` (web HMR), `build`, `lint`, `test`, `electron:compile`, `electron:dev` (static-build mode:
`next build` → `tsc` → `electron .`), `electron:build` (`… && electron-builder --win`).
> Renderer tweaks require re-running `electron:dev`; use `npm run dev` for fast web iteration.

## Phase 2 — Tier 1 core (done)

- Task CRUD with subtasks (nested, collapsible), drag & drop reorder
- Priority, due date/time, status (Todo / In Progress / Done), tags with colors
- Projects/lists with nesting, icons, colors
- Smart views: Inbox, Today, Upcoming, Overdue, Completed, Important, Trash (restore)
- Zustand store (selector-based), virtualized lists (`@tanstack/react-virtual`)
- Vitest scaffold + DB-layer tests (fake-indexeddb)

## Phase 3 — Tier 1 rest (done — this revision)

- **Instant local search** over title + notes, applied *after* the index-backed view query
  (never a full-table scan) — `src/lib/taskFilters.ts`, wired through `queryTasksForView`
- **Filters** (status, priority, project, tag OR-match); sidebar tag chips now actually filter
- **Sort / group-by** (project, date buckets, first tag) rendered as virtualized group headers
- **Command palette** (`Ctrl/Cmd+K`) with view navigation, add task, theme, import/export, clear search
- **Keyboard shortcuts** (`Ctrl/Cmd+K`, `Ctrl/Cmd+F`, `Ctrl/Cmd+N`) — `src/hooks/useGlobalShortcuts.ts`
- **Export / import all data as JSON** (Zod-validated, version-tagged, friendly errors + toasts) —
  `src/db/backupRepository.ts`, `src/features/data/backupActions.ts`
- **Dark / light / system theme** with a header toggle (persisted in `localStorage`)
- Lightweight toast system (`src/store/toastStore.ts`, `src/components/ui/toaster.tsx`)

## Phase 4 — Tier 2 (small groups, STOP after each group) — DONE

- [x] **Group 1** — Markdown notes per task (lazy-loaded, live preview) + wiki-style `[[links]]` with backlinks panel
- [x] **Group 2** — Kanban board + Calendar views (lazy-loaded)
- [x] **Group 3** — Quick-add with natural-language parsing (tested)
- [x] **Group 4** — Recurring tasks (tested) + Electron desktop notifications
- [x] **Group 5** — Undo/redo + rolling local backups (tested)
- [x] **Group 6** — Statistics page with lightweight charts (lazy-loaded, tested)
- [x] **Group 7** — Desktop extras: tray, global quick-add shortcut, window size/position memory, single-instance lock

### Group 1 — delivered

- **Task detail panel** (right side, `src/features/tasks/components/TaskDetailPanel.tsx`): opens from a
  task title; shows meta, notes and backlinks. The pencil icon still opens the metadata dialog.
- **Markdown notes editor** (`src/features/notes/components/NotesEditor.tsx`): Edit / Preview / Split,
  debounced autosave (500 ms) + save-on-blur, inline "Insert link" task picker.
- **Lazy preview** (`MarkdownPreview.tsx` via `next/dynamic`, `ssr: false`): `react-markdown` +
  `remark-gfm` stay in a **separate 144 KB chunk** — the initial bundle is unchanged (957 KB).
- **Wiki links** (`src/lib/wikiLinks.ts`, 10 unit tests): `[[Title]]` resolved by trimmed,
  case-insensitive title match; unresolved links stay literal. Preview intercepts internal links to
  open the target; external URLs are rendered inert (local-only guarantee).
- **Backlinks** (`src/features/notes/useTaskNoteReferences.ts`): computed on demand while the panel is
  open; no DB migration (the `notes` column already existed).

Known limitations (deferred): links break on title rename; duplicate titles resolve to the first
match; backlink resolution reads the active-task set while the panel is open (an indexed links table
is the planned follow-up if profiling at 10k tasks demands it).

### Group 2 — delivered

- **View-mode switch** in the view header (`List` / `Board` / `Calendar`) backed by `viewMode` in the
  store — `src/components/views/TaskView.tsx`. List keeps the readable `max-w-3xl`; board/calendar go
  full width.
- **Kanban board** (`src/features/board/components/`, lazy chunk ~5 KB): three status columns
  (To do / In progress / Done), each **individually virtualized** (`@tanstack/react-virtual`). Cards
  show priority, due date, project and tag dots; clicking a card opens the notes panel; dragging a
  card between columns changes its status (via the shared, recurrence-aware `setTaskStatus`). Pure
  grouping helpers live in `src/lib/board.ts`.
- **Month calendar** (`src/features/calendar/components/CalendarView.tsx`, lazy chunk ~4 KB): Sunday-
  or Monday-start month grid with prev/next/Today controls, up to 3 task chips per day plus a
  “+N more” overflow, today highlighted. Pure layout helpers in `src/lib/calendar.ts` (5 tests).
- Both views **reuse `useTasksForView()`**, so they honor the active view, project scope, search and
  filters — and add **no new DB queries or indexes**.

Known limitations (deferred): board/calendar are scoped to the active view (the Done column fills in
the Completed view, matching the list's “completing removes from active view” rule); the calendar
shows only tasks with a due date (the rest are summarized); the board shows top-level tasks only.

### Group 3 — delivered

- **Natural-language quick-add** — `src/lib/naturalLanguage.ts`, a pure `parseQuickAdd(input, nowMs)`
  that recognizes: priority flags (`!high !medium !low`, aliases `!h !m !l`), `#tags`, and a due
  date/time (today/tomorrow/tonight, weekday names, “next week/month”, “in N days/weeks/months”,
  `YYYY-MM-DD`, `M/D[/YYYY]`, “november 1”, and clock times `5pm`/`9:30am`/`17:00`/noon/midnight).
  Recognized tokens are stripped from the title; unrecognized text is left untouched and the parser
  never throws. **13 unit tests** cover every form.
- **Live preview chips** in `TaskForm`: as you type, the detected due date, priority and tags appear
  under the input (progressive disclosure — nothing shows when there's nothing to detect).
- **Tag resolution**: `#tag` names are matched case-insensitively against existing tags and created
  on submit if missing; a failing tag never blocks task creation.

Known limitations (deferred): parsing is a deliberately small English subset (no ranges or “eod”); it
runs on submit/typing rather than in a worker (inputs are short); project assignment still comes from
the selected project, not an `@project` token.

### Group 4 — delivered

- **Recurring tasks** — a flat `recurrence` string on `Task` (`"" `= never; `"weekly"`; `"daily:3"`),
  validated by Zod and added via Dexie **schema v4** (migration backfills `""`). Pure rule logic lives
  in `src/lib/recurrence.ts` (`parseRecurrence`, `formatRecurrence`, `nextDueDate`; **12 tests**).
- **Completion reschedules** — `setTaskStatus` in `src/db/taskRepository.ts`: completing a recurring
  task advances its `dueAt` to the next occurrence (preserving the original time of day, skipping past
  a long overdue backlog) and leaves it active instead of marking it done. The list checkbox and the
  board's drag-to-Done both go through it, so behavior is consistent everywhere.
- **Recurrence UI** — a `Repeat` select in `TaskEditDialog` (Never / Daily / Weekly / Monthly / Yearly;
  non-preset rules such as `weekly:2` stay selectable), a `Repeat` indicator + accessible label on
  `TaskRow`, and a live “Repeats …” chip in the quick-add preview.
- **Natural language** — `parseQuickAdd` now understands `daily/weekly/monthly/yearly`, `every
  day/week/month/year`, and `every N units` → `recurrence` (**+4 tests**, 17 total for the parser).
- **Desktop notifications** — `src/features/notifications/useDueNotifications.ts` (mounted in
  `MainLayout`) polls once a minute and fires an OS notification the first time a task's due time
  passes, for tasks overdue within a 3-day window. Uses the Web `Notification` API (Electron grants it
  by default, so the preload stays minimal); the pure selection is `src/lib/dueNotifications.ts`
  (**8 tests**). Announcements are deduped per `occurrence` in `localStorage`; a command-palette action
  toggles reminders on/off (preference in `src/lib/notificationPrefs.ts`).

Known limitations (deferred): intervals come only from quick-add (`every 3 days`), not the edit dialog;
`nextDueDate` uses date-fns month clamping (Jan 31 → Feb 28); reminders fire on the next poll after the
due time (up to ~60 s late) and are a fixed 3-day look-back; no per-task reminder lead-time or snooze.

### Group 5 — delivered

- **Undo/redo** — a bounded in-memory history (max 100 actions). Every mutating repository call
  (task/project/tag create, edit, status change, trash, restore, permanent delete, move, reorder)
  records a `RowChange` per affected row (before/after image) via `src/db/history.ts`; cascade
  operations (e.g. trashing a parent + descendants) undo as **one step** because images are stored, not
  inverse ops. The pure stack math is `src/lib/undoStack.ts` (**10 tests**); the DB bridge is
  `src/db/history.ts` (**9 tests**). React subscribes with `useSyncExternalStore`
  (`src/features/history/useHistory.ts`) — no coupling from the DB layer to Zustand.
- **UI** — Undo/Redo buttons in the header (disabled when empty, tooltips name the action) and
  `Ctrl/Cmd+Z`, `Ctrl/Cmd+Shift+Z`, `Ctrl/Cmd+Y` shortcuts plus palette actions. Shortcuts are ignored
  inside text fields so native in-field undo still works. Note autosave is **excluded** from history
  (`updateTask(..., { recordHistory: false })`) so a typing session can't flood the stack.
- **Rolling local backups** — `src/db/snapshotRepository.ts` keeps the **5 newest** snapshots
  (`maybeCreateSnapshot` takes one per app start when the newest is >6 h old, skipping an empty DB).
  Metadata and payload live in separate tables (`snapshots`, `snapshotData`) added via Dexie **schema
  v5**, so listing backups never loads task arrays; the prune/interval rules are pure and tested
  (`src/lib/snapshots.ts`, **9 tests**; repo **7 tests**). The dialog lists backups (date + counts),
  offers “Back up now”, restore (with confirm) and delete.
- **Safety** — restoring a backup or importing a JSON file **clears history** first, since prior undo
  entries would reference rows that no longer exist.

Known limitations (deferred): history is in-memory only (cleared on app restart); undo applies whole-row
images, so it can overwrite a row changed by another path since (acceptable for a single-user local
app); snapshots are not encrypted and live in the same IndexedDB origin as the live data.

### Group 6 — delivered

- **Statistics page** at the `/stats` route, reached from a new sidebar entry and a command-palette
  action. The task view and the dashboard now share a client **route-group layout**
  (`src/app/(app)/layout.tsx`), so `MainLayout` (header, sidebar, dialogs, notification/snapshot hooks)
  stays mounted across navigation instead of remounting. The dashboard itself is `next/dynamic`
  (`ssr: false`) and its own route, so **none of the chart code enters the initial bundle**.
- **Hand-rolled charts, no dependency** — vertical bars (`BarChart`) and horizontal bar lists
  (`BarList`) built from Tailwind tokens; each chart exposes a single `role="img"` with a text summary,
  and values are always printed next to the bars so color is never the only signal.
- **Metrics** (global — all non-trashed tasks, independent of the active view/filters): summary cards
  (active, completed, overdue, due today, completion rate), a 30-day completions trend, status and
  priority breakdowns, and top projects (incl. an Inbox bucket).
- **Pure aggregation** in `src/lib/stats.ts` (`summarizeTasks`, `completionTrend`, `countByStatus`,
  `countByPriority`, `topProjects`; **11 tests**) clock-injected and Dexie-free. The hook
  (`src/features/stats/useStats.ts`) reads the existing `[deletedAt+order]` index via `listActiveTasks`
  — **no new index or migration**.

Known limitations (deferred): stats load all non-trashed tasks and aggregate in JS (same cost class as
the list/board/calendar); `nowMs` is captured at mount, so overdue/due-today refresh on data change or
re-navigation rather than at midnight; the trend window (30 days) and project limit (6) are constants,
not user-adjustable.

### Group 7 — delivered

All four items live in the Electron shell (`electron/main.ts`, `electron/windowState.ts`) — **no new
renderer bundle weight** (the only renderer change is a ~0.3 KB IPC hook) and **no new dependencies**.

- **Single-instance lock** — `app.requestSingleInstanceLock()`; a second launch quits immediately and
  the first instance reveals its existing window (`second-instance` handler). This also prevents two
  processes from colliding over the fixed loopback port.
- **Window size/position memory** — `electron/windowState.ts` persists `{ x, y, width, height,
  maximized }` to `window-state.json` in the app's userData folder. It saves debounced (400 ms) on
  `move`/`resize`/`maximize`/`unmaximize` and flushes on `close`; `getNormalBounds()` stores the
  restored bounds so un-maximizing stays sensible. On load, a size below the minimum or a position
  that no longer overlaps any connected display is discarded (the window centers instead). No
  dependency, no network.
- **System tray** — `Tray` with a locally drawn 32×32 icon (`electron/assets/tray.png`, generated from
  a rounded indigo square + check; added to `electron-builder.yml` `files`). Context menu: **Show
  Omivoid** / **Quit Omivoid**; clicking the icon shows the window. **Closing the window hides it to
  the tray** instead of quitting (`close` → `preventDefault` + `hide` unless `isQuitting`), so the app
  keeps running until an explicit quit.
- **Global quick-add shortcut** — `CommandOrControl+Alt+N` registered with `globalShortcut`; it
  reveals/focuses the window and sends the `omivoid:quick-add` IPC channel. The preload exposes a
  single narrow subscription (`onQuickAdd`, returning an unsubscribe fn) and the renderer hook
  `src/hooks/useDesktopBridge.ts` (mounted in `MainLayout`) focuses `#quick-add-input`. A no-op in the
  browser (`window.omivoid` is absent).

Verified by a desktop smoke run (Windows): the window opens and restores exact saved bounds
(`120,120,1000,680`); WM_CLOSE hides it while the process stays alive (tray); an injected
`Ctrl+Alt+N` reveals it again; a second launch exits while the first stays up.

Known limitations (deferred): the tray icon is a single 32×32 PNG (no macOS template image or multi-DPI
set yet — fine for Windows/Linux); quick-add focus is best-effort (if the active view doesn't render
`#quick-add-input`, the window is still revealed); on Linux the tray needs a desktop environment with
AppIndicator support; window placement is validated against display *overlap* only (not full
containment).

## Phase 5 — Tier 3 + polish (only if performance budget allows) — IN PROGRESS

- Graph view, Pomodoro timer, timeline-lite, saved filters, Markdown export (each optional)
- Animations (CSS first), accessibility pass, performance audit at 10,000 tasks
- Full test suite; final README (Windows + Linux setup/build/packaging)

### Step 0 — gap fixes (done)

Four small gaps left over from earlier phases, fixed before starting Tier 3 work.

1. **Seed tool replaced.** The three `scripts/seed-10k.*` files were broken (`title: Task` — a bare
   type used as a value — and unusable anyway: Node has no IndexedDB, so they could never write to
   Dexie). Replaced with **`scripts/seed.mjs`** (`npm run seed`, default **100** tasks, `--count N`,
   `--out file`). It generates a synthetic data set and writes it as a **valid Omivoid backup file**
   (`{ version: 1, exportedAt, tasks, projects, tags }`) into `omivoid-seed.json` (gitignored). The
   user imports it through the app's existing **Ctrl/Cmd+K → “Import data (JSON)”** path, so the data
   flows through the *same* Zod-validated `parseBackupText` gate as any real backup — no schema drift
   possible. Generates 6 projects (with icons + colors), 8 tags, priorities/statuses/due dates/
   recurrences/subtasks/trash spread across the tasks. Output was verified against `backupSchema`
   (200-task run parsed cleanly) with a throwaway test that was then removed (it depended on a
   gitignored file).
2. **Removed unused `@dnd-kit/*`.** `@dnd-kit/core`, `@dnd-kit/sortable` and `@dnd-kit/utilities`
   were dependencies but never imported (the board uses native HTML5 drag & drop). They were blocked
   by a pre-existing peer conflict: `@vitest/ui@^5.0.5` peers `vitest@5`, while the project pins
   `vitest@^3.2.4`. Fixed by pinning **`@vitest/ui` to `3.2.4`** (matching `vitest`/`@vitest/coverage-v8`),
   then `npm install` removed the three packages (23 added / 5 removed in the prune).
3. **Project/tag color + icon UI.** Previously there was no way to set a tag color or a project
   icon/color after creation. Added:
   - `src/lib/colors.ts` (`PRESET_COLORS`, 10 shared swatches) + `src/components/ui/color-swatches.tsx`
     (accessible preset picker with a “default/no color” option).
   - `src/lib/projectIcons.ts` — a **curated 12-icon allowlist** (`PROJECT_ICON_MAP` + `projectIcon()`)
     so icons stay tree-shakeable (no wildcard `lucide-react` import).
   - `src/features/projects/components/ProjectEditDialog.tsx` (name + icon + color) and
     `src/features/tags/components/TagEditDialog.tsx` (name + color), opened by a new **pencil** button
     on each sidebar row. The sidebar now renders a project's chosen **icon** (tinted by its color) or
     falls back to the color dot. Create forms stay name-only (progressive disclosure). New i18n keys
     (`editProject`, `editProjectAria`, `editTag`, `editTagAria`, `nameLabel`, `colorLabel`,
     `colorDefault`, `iconLabel`, `iconNone`).
4. **Packaging icon + a packaging bug fixed.** Added **`build/icon.png`** (512×512, rounded-square +
   check, drawn locally with System.Drawing) — electron-builder auto-detects `buildResources: build`.
   The `/build` line was removed from `.gitignore` so the icon is committed. While validating with
   `electron-builder --dir`, the packaged **`app.asar` was 312 MB**: the `files` whitelist was not
   excluding runtime `node_modules` (all of React/Next/Radix/Markdown), even though the shell needs
   none of it. Added **`!**/node_modules/**/*`** → **`app.asar` is now 1.42 MB** and there is no
   `app.asar.unpacked` (the stray unpacked `esbuild.exe` is gone). Total `win-unpacked` (~370 MB) is
   now just the Electron runtime.

Verification: `npm run build` ✓ (static export), `npm run lint` ✓ (0 errors, the same 2 pre-existing
`react-hooks/incompatible-library` warnings on `useVirtualizer`), `npm test` ✓ (128 tests / 16 files),
`npm run electron:compile` ✓, `electron-builder --dir` ✓ (exe icon applied, asar 1.42 MB). Initial JS
grew ~10 KB (1,007 KB) and CSS ~1 KB (57 KB) — the new dialogs plus the 12-icon set, which must be in
the initial bundle to render project icons in the sidebar.

### Step 1 — performance audit @ 10,000 tasks (findings)

Method: generated a 10,000-task data set (`npm run seed -- --count 10000`), loaded it through
fake-indexeddb in a throwaway Vitest harness, and timed the real query/render path. Numbers below are
fake-indexeddb (pure JS + structured clone), so they are a **conservative upper bound** — native
IndexedDB in Chromium is faster. Relative differences within the same harness are what matter.

**Three correctness bugs found and fixed** (all untested — there was no `queryTasksForView` test):

1. **Inbox / Completed / Important / project views returned *nothing*.** They used
   `between([key, NONE], [key, NONE])`, but Dexie's `between` **excludes the upper bound by default**,
   so an identical lower/upper pair compiles to an *empty* range (measured: 0 rows where 2,607 / 1,939 /
   2,500 rows were expected). Replaced with `.equals([key, NONE])` (the obviously-intended lookup).
   Fix: `src/db/taskQueries.ts`.
2. **Project scope still excluded every task of that project.** It applied `matchesView(task, "inbox")`,
   whose `isInbox` predicate demands `projectId === ""`. A project view now filters to
   *active (non-done) tasks* instead, which matches every other view's "hide done" behaviour.
3. **Trash's compound bound** `between([NONE+1, Dexie.minKey], [Dexie.maxKey, Dexie.maxKey])` threw
   `DataError` under fake-indexeddb (a `Dexie.maxKey` *first* component). Rewritten as
   `.above([NONE, Dexie.maxKey])` — same result, and it is now testable.

**One performance fix (the hot path):**

- `queryParentIdsWithChildren()` — a live query on the **main list**, re-run on every task mutation —
  used `where("parentId").notEqual("")`, which forces Dexie into a full-collection filter: **>20 s
  (timeout) → 7.4 s** even after dropping `notEqual`. A chained Dexie `.filter()` on the range read was
  equally pathological. Now it reads the `parentId` index range with `.above("")` and filters the
  ~1,111 rows in JS: **7,400 ms → 14 ms** (~510×). A full mutation cycle (toggle done + two reads)
  went from **>7.7 s → 312 ms**.

| Operation @ 10k tasks | Before | After |
| --- | --- | --- |
| `queryParentIdsWithChildren()` | >20 000 ms | **14 ms** |
| mutation cycle (toggle + view + parents) | >7 700 ms | **312 ms** |
| Inbox / Completed / Important / project views | 0 rows (broken) | correct rows |

Measured pipeline costs (10k tasks, after fixes) for context: view query 6–32 ms depending on the
view's row count; `listActiveTasks()` 92 ms for 9,696 active rows; pure transforms (sort 0.4 ms,
search/filter 1.0 ms, grouping 0.6–3.2 ms) are negligible because they run over the
already-index-narrowed set. Import (`bulkAdd` of 10k rows) is ~530 ms — a one-time cost.

**Remaining recommendations (not implemented — do these only if a profiling pass agrees):**

- `listActiveTasks()` loads all ~9,696 active rows and re-runs as a live query in **Stats**
  (`useStats`) and **note backlink resolution** (`useTaskNoteReferences`). That is fine while those
  screens are open (stats genuinely needs every task), but worth caching or narrowing if a profiling
  pass shows jank while editing notes.
- View queries return full `Task` objects; the list only needs a subset of columns for rows that are
  off-screen. IndexedDB cannot project columns, so this is bounded by the virtualizer, not by the DB.
- The due-date views (`today`/`upcoming`/`overdue`) range on `dueAt` only, so they read done and
  trashed rows too and let `matchesView` drop them. Cheap enough at 10k (6–17 ms), but a
  `[dueAt+deletedAt]` index would trim the read if profiling ever flags it.
- `useActiveTasks` in `src/features/tasks/useTasks.ts` is **dead code** (no consumers); remove it.

Temp harness files and the generated `omivoid-seed.json` were deleted; only the
`src/db/test/taskQueries.test.ts` regression suite was kept.

Verification after Step 1: `npm run build` ✓ (static export), `npm run lint` ✓ (0 errors, the same 2
pre-existing `useVirtualizer` warnings), `npm test` ✓ (**135 tests / 17 files**, +7 new). Bundle
unchanged (1,007 KB JS / 57 KB CSS) — the fixes touch the DB layer only.

## Performance budget (checked at the end of every phase)

- Report `out/_next/static` bundle size (JS + CSS)
- Startup impression; smooth interactions target ~60fps @ 10k tasks
- Lazy-load: Markdown editor, graph, charts, calendar, command palette
- Every common query must hit an IndexedDB index

### Latest measurement (end of Phase 4 Group 7)

| Milestone | Initial JS | Lazy JS | CSS |
| --- | --- | --- | --- |
| Baseline (before fixes) | 926 KB | — | 51 KB |
| End of Phase 3 | 957 KB | — | 52 KB |
| End of Phase 4 Group 1 | 957 KB | +158 KB (Markdown chunk) | 54 KB |
| End of Phase 4 Group 2 | 963 KB | +9 KB (board + calendar) | 56 KB |
| End of Phase 4 Group 3 | 969 KB | +9 KB (board + calendar) | 56 KB |
| End of Phase 4 Group 4 | 975 KB | +9 KB (board + calendar) | 56 KB |
| End of Phase 4 Group 5 | 986 KB | +9 KB (board + calendar) | 56 KB |
| End of Phase 4 Group 6 | 997 KB | + board + calendar + stats route (171 KB) | 58 KB |
| **End of Phase 4 Group 7** | **997 KB** | +171 KB | **56 KB** |
| **Phase 5 Step 0 (gap fixes)** | **1,007 KB** | +171 KB | **57 KB** |

Group 7 is an Electron-shell group: it adds roughly 0.3 KB to the renderer (the `useDesktopBridge`
IPC hook) and everything else runs in the main process, so the web bundle is unchanged. (Measured
initial JS = 997 KB; CSS = 56 KB. The Group 6 row's 58 KB was an earlier reading; the restored
`globals.css` compiles to 56 KB.)

Group 3 adds the parser and the live preview chips to the initial bundle (+6 KB) — it must be
available the moment the quick-add field renders, so it isn't lazy. Group 4 adds the recurrence
rules + notifications hook eagerly (+6 KB); it reuses `date-fns` (already present); no new
dependencies. Group 5 adds undo/redo (stack + header buttons + shortcuts) and the backups dialog to
the initial bundle (+11 KB); no new dependencies (reuses `date-fns` for formatting). Group 6 adds
`next/link` + the Next client router (route-based navigation) and the sidebar entry (+11 KB); the
dashboard and charts are a separate lazy route chunk. CSS grows ~2 KB because Tailwind emits the
stats utility classes globally (no per-route CSS splitting for utilities). Board, calendar and stats
remain lazy chunks.

Search/filter note: substring text search cannot use an IndexedDB index by nature. It is applied
to the *already index-narrowed* view result, so the candidate set is bounded by the view
(Inbox = non-project active tasks, etc.). Revisit with a token/index table only if profiling at
10k tasks shows it matters.

## Decisions log

| Decision | Rationale |
| --- | --- |
| Removed `cacheComponents`, `partialPrefetching` | Server-caching features; useless (and risky) under `output: 'export'` for a pure client app |
| Space Grotesk vendored woff2 in repo | Local-only rule; `next/font/local` gives preload + metric fallback, zero build-time fetches |
| `electron:dev` = static-build mode (user choice) | Closest to production; `npm run dev` remains for fast web iteration |
| Prod renderer served from `127.0.0.1` (not `file://`) | Stable origin required for reliable IndexedDB persistence |
| Search/filter applied post-index (not in the index) | Substring search is not indexable; the view query already narrows the set, keeping it bounded |
| Backup replaces all data in one transaction | Simple, atomic, and Zod-validated; a failed import leaves existing data untouched |
| Theme persisted in `localStorage`, not IndexedDB | Tiny UI setting; the rules explicitly allow `localStorage` for theme |
| Keep `useVirtualizer` despite React Compiler lint warning | Known TanStack Virtual limitation; memoizing it would break virtualization |
| Wiki links by **title** (not id) | Matches the "wiki-style" intent and reads naturally; duplicate/rename edge cases are documented and deferred |
| Backlinks computed on demand (no links table yet) | Keeps Group 1 small with no migration; the panel only scans while open. Indexed links table is the planned follow-up if 10k-task profiling needs it |
| External links rendered inert in the Markdown preview | The app is local-only — a clickable `http(s)` link would risk a network request |
| Notes autosave debounced (500 ms) + save on blur | Feels instant without a save button or write on every keystroke |
| Board uses native HTML5 drag & drop (no `@dnd-kit`) | Consistent with the list's existing DnD and the "minimal dependencies" rule; cross-column drops only need `dragover`/`drop` |
| Board columns virtualized individually | A single column can hold thousands of cards at 10k tasks; per-column virtualizers keep it ~60fps |
| Board/calendar reuse `useTasksForView()` | No new queries or indexes; they stay consistent with the active view, project scope, search and filters |
| Board and calendar lazy-loaded | Matches the perf budget ("lazy-load … calendar"); initial JS grows only ~6 KB |
| Task status write extracted to a module-level helper | React Compiler's purity rule rejects `Date.now()` inside a render-scoped function |
| NL parsing is a hand-rolled regex/scan, not a dependency | Keeps the "minimal dependencies" rule; the subset is small enough to test exhaustively |
| `parseQuickAdd` takes `nowMs` and returns plain data | Pure and clock-injectable, so the whole grammar is unit-testable |
| Recurrence stored as a flat string (`"weekly"`, `"daily:3"`), not a nested object | Matches the schema's flat/sentinel style, needs no index, and is trivially Zod-validated |
| Recurring tasks reschedule instead of completing | The expected "done for now, comes back" behavior; keeps one active row rather than spawning history |
| `setTaskStatus` is the single completion path (list + board) | Guarantees recurring reschedule applies everywhere; removed the board's old `statusPatch` |
| Reminders via the Web `Notification` API in the renderer, not IPC | Electron grants it by default; keeps the preload minimal (contextBridge only) and the app local-only |
| Reminder dedupe keyed by `taskId → dueAt` in `localStorage` | `localStorage` is explicitly allowed for tiny UI state; the key auto-invalidates when a recurring task advances |
| Reminder look-back window (3 days) | Prevents a notification flood for work that has sat overdue for weeks |
| Parser runs only in change/submit handlers, preview stored in state | React Compiler's purity rule forbids `Date.now()` during render |
| `#tags` are auto-created on submit | Matches the natural-language intent; failures are swallowed so a bad tag never blocks the task |
| Undo stores full row **images** (before/after), not inverse operations | Cascades (trash, permanent delete, reorder) undo correctly with no per-operation special cases; memory is bounded by the 100-action cap |
| History lives in `src/db/history.ts` (module singleton) + `useSyncExternalStore` | Keeps the "repository layer owns Dexie" rule; React subscribes without the DB importing Zustand (no cycle) |
| Note autosave excluded from history (`recordHistory: false`) | A debounced per-keystroke write would flood the 100-entry stack and make undo useless |
| History cleared after restore/import | Replaced rows make prior undo entries unsafe to apply; a stale image could resurrect deleted data |
| Snapshots split into `snapshots` (meta) + `snapshotData` (payload) tables | Listing backups stays cheap (metadata only); the payload is loaded only on restore |
| Rolling backups capped at 5, taken at most every ~6 h per app start | Bounds storage while still providing a safety net; automatic trigger avoids user effort |
| `undo`/`redo`/shortcuts ignore editable fields | Preserves native `Ctrl+Z` text editing; app-level undo only acts on non-input focus |
| Statistics is its own `/stats` route (not a view-mode) | Stats is global, while view modes describe the active view's tasks; a route also code-splits the charts cleanly |
| Shared `MainLayout` moved into a route-group layout | Keeps header/sidebar/dialogs/hooks mounted across navigation instead of remounting per route |
| Charts hand-rolled with SVG/Tailwind (no library) | Honors the minimal-dependency + local-only rules; fully theme-aware and small |
| Stats aggregate in JS from the existing `[deletedAt+order]` read | Avoids a new `completedAt` index/migration; same cost class as the list/board/calendar |
| Chart values always printed next to bars | Keeps the dashboard readable without relying on color/height alone (accessibility) |
| Window state persisted to `window-state.json` in userData (not `localStorage`/IndexedDB) | The main process owns window geometry before any renderer exists; a tiny JSON file needs no dependency and avoids coupling the shell to the renderer store |
| Off-screen/too-small window state discarded on load | Prevents an unreachable window after a monitor is disconnected; falls back to Electron centering |
| Store `getNormalBounds()` + a maximized flag | Un-maximizing later returns to the user's pre-maximize size instead of the full-screen bounds |
| Close hides to tray (`preventDefault` unless `isQuitting`) | The expected desktop behavior for a tray app; the tray menu's Quit is the explicit exit path |
| Global quick-add via `globalShortcut` + one IPC channel | `Ctrl/Cmd+Alt+N` works from any app; the preload exposes only a narrow `onQuickAdd` subscription so the bridge stays minimal |
| Tray icon drawn locally (32×32 PNG, no generator/asset pipeline) | Honors the local-only + minimal-dependency rules; one committed PNG is enough for Windows/Linux |
| Seed tool emits a **backup JSON** instead of writing IndexedDB | Node has no IndexedDB, and a generated backup flows through the app's existing Zod-validated import — one schema, no drift, works in both web and Electron |
| `@vitest/ui` pinned to `3.2.4` (not `^`) | `@vitest/ui@3.2.x` pins `vitest` to an exact peer; an exact pin avoids the ERESOLVE that also blocked removing the unused `@dnd-kit` packages |
| Project icons limited to a curated 12-icon allowlist | Keeps `lucide-react` tree-shakeable; a wildcard import would pull the whole set into the bundle |
| Color/icon editing lives in edit dialogs, not the create forms | Progressive disclosure (sidebar stays uncluttered); the sidebar row already provides the pencil affordance |
| Packaging excludes `node_modules` (`!**/node_modules/**/*`) | The Electron shell uses only built-ins and serves static files, so runtime deps are dead weight — this shrank `app.asar` from 312 MB to 1.42 MB |
| `build/icon.png` un-ignored from `/build` | electron-builder auto-detects `buildResources: build`; the icon must be committed for reproducible packaging |
