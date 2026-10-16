<!-- BEGIN:nextjs-agent-rules -->

## This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->

# omivoid-todolist — permanent project rules

These rules apply to the entire project, every phase. Do not remove them.

## Locality (non-negotiable)
- The app is **LOCAL-ONLY**. No network requests, no CDN, no analytics, no telemetry, no external APIs — ever. This includes fonts, icons, and images at build time and runtime.
- Storage is **IndexedDB ONLY**, via Dexie.js. No other database. `localStorage` only for tiny UI settings (e.g. theme).
- Next.js uses **static export** (`output: 'export'`). No API routes, no server actions, no SSR-only features.
- Desktop is packaged with **Electron**: `contextIsolation: true`, `nodeIntegration: false`, minimal preload (contextBridge only).
- Production renderer origin is a loopback-only static server (`127.0.0.1`) serving the `out/` folder — never `file://` (IndexedDB needs a stable origin).

## Performance first
- Minimal dependencies. Lazy-load heavy parts (Markdown editor, graph view, charts, calendar view, command palette). Virtualize long lists (`@tanstack/react-virtual`).
- Avoid unnecessary re-renders; Zustand selectors + Dexie live queries.
- Never add a dependency without a clear reason.
- Hard budget: smooth ~60fps interactions at 10,000+ tasks; small initial JS bundle; IndexedDB indexes for every common query (no full-table scans).
- If a feature hurts startup time, memory, or smoothness: make it lazy/lighter, postpone it, and report it.

## Code quality
- TypeScript **strict**, no `any`.
- **Validate all data entering IndexedDB with Zod** (repository layer is the only code that touches Dexie; UI never talks to the DB directly).
- Never show raw errors to users: friendly messages only; technical details go to the console only.
- All fonts and icons are bundled locally and free (Space Grotesk, lucide-react).
- Keep the UI simple and uncluttered — progressive disclosure for advanced features.
- i18n-ready strings (English now; RTL support later).

## Working method
- Work **phase by phase** (see PLAN.md) and **STOP for approval after each phase**.
- After every phase: `npm run build` and `npm run electron:dev` must still work; update PLAN.md; report what was done, bundle size, problems, next step.

## Windows shell note
- PowerShell execution policy blocks `npm.ps1`/`npx.ps1` — invoke npm as `npm.cmd` / `npx.cmd`.
