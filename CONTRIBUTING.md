# Contributing to Omivoid

Thanks for your interest in improving Omivoid. This document explains how to
set the project up, what the project rules are, and what a good pull request
looks like.

Omivoid is a **local-first** task manager: every byte of user data stays on the
user's device. That single promise drives almost every design decision in the
code base, so please read the rules below before opening a pull request.

---

## Quick start

```bash
git clone https://github.com/Marsh-Edge/Omivoid-Todolist.git
cd Omivoid-Todolist
npm install
npm run dev            # web dev server with HMR at http://localhost:3000
```

Requirements:

- **Node.js 20.9+** (this is the minimum Next.js 16 accepts)
- npm 10+
- Windows or Linux for packaging the desktop app

> On Windows PowerShell the execution policy may block `npm.ps1` — invoke
> `npm.cmd` / `npx.cmd` instead.

### Install scripts and npm 12+

npm 12 only runs a dependency's install lifecycle scripts when the package is
covered by the project's `allowScripts` policy in `package.json`. The approved
packages are `unrs-resolver`, `esbuild` and `electron-winstaller`; check with:

```bash
npm approve-scripts --allow-scripts-pending   # lists anything still blocked
```

Electron 44 does **not** download its runtime in a `postinstall` script — the
`electron` CLI fetches it on first use. So the first `npm run electron:dev`
after a fresh install downloads the runtime (~100 MB, once). The web build
(`npm run dev` / `npm run build`) never needs it.

## Commands

| Command | What it does |
| --- | --- |
| `npm run dev` | Next.js dev server with hot reload (web only) |
| `npm run build` | Production static export into `out/` |
| `npm run serve` | Serves `out/` on `http://127.0.0.1:3000` (loopback only) |
| `npm run lint` | ESLint (Next.js core-web-vitals + TypeScript rules) |
| `npm run typecheck` | `tsc --noEmit` for the renderer code |
| `npm run electron:typecheck` | `tsc --noEmit` for the Electron shell |
| `npm run test` | Vitest (jsdom + `fake-indexeddb` for the DB layer) |
| `npm run test:coverage` | Coverage report (informational, no threshold gate) |
| `npm run verify` | Lint + typecheck + test in one go |
| `npm run seed` | Writes a synthetic `omivoid-seed.json` you can import |
| `npm run electron:compile` | Compiles the Electron main/preload shell |
| `npm run electron:dev` | Static build → compile → launch the desktop app |
| `npm run electron:build` | Packages the Windows installer into `release/` |
| `npm run release:checksums` | Writes `release/SHA256SUMS.txt` |

`npm run electron:dev` uses a full static build, so renderer changes need a
re-run. Use `npm run dev` for fast iteration and `npm run electron:dev` to
verify the desktop shell.

## Project rules

These rules are permanent and apply to every change. They are also recorded in
[`AGENTS.md`](AGENTS.md).

### Locality (non-negotiable)

- **No network requests, no CDN, no analytics, no telemetry, no external APIs.**
  Not at runtime, not at build time. Fonts and icons must be bundled locally
  (the project ships Space Grotesk and `lucide-react` for exactly this reason).
- Storage is **IndexedDB only**, accessed through Dexie. `localStorage` is for
  tiny UI settings (the theme) and nothing else.
- Next.js runs with `output: "export"`. No API routes, no server actions, no
  SSR-only features.
- The desktop app is Electron with `contextIsolation: true`,
  `nodeIntegration: false` and a minimal `contextBridge`-only preload.
- The production renderer is served from a **loopback-only** static server
  (`http://127.0.0.1:41739`), never from `file://`, because IndexedDB needs a
  stable origin.

### Performance

- Keep dependencies minimal; every new runtime dependency needs a clear reason.
- Heavy features (Markdown editor, board, calendar, charts, command palette)
  are lazy-loaded, and long lists are virtualized. The app stays smooth at
  10,000+ tasks.
- Prefer Zustand selectors and Dexie live queries over broad re-renders.

### Code quality

- TypeScript is **strict**, and `any` is not allowed.
- **All data entering IndexedDB is validated with Zod.** The repository layer
  (`src/db/*Repository.ts`) is the only code that touches Dexie; UI components
  never do.
- Users never see raw error messages — friendly text only, technical details
  to the console.
- User-facing copy goes through `t()` in `src/lib/i18n.ts` so the app stays
  i18n-ready.
- Keep the UI uncluttered; advanced options belong behind progressive
  disclosure.

## Making a change

1. **Open an issue first** for anything larger than a bug fix, so the design
   can be discussed before the code is written.
2. **Branch from `main`**: `feature/short-description`, `fix/short-description`
   or `chore/short-description`.
3. **Write code and tests together.** New logic in `src/lib/` should come with
   unit tests in `src/lib/test/`; new repository behaviour with tests in
   `src/db/test/`.
4. **Keep the database forward-compatible.** Existing `this.version(n)` blocks
   in `src/db/index.ts` are immutable once shipped — a schema change is always
   a new `this.version(n + 1).stores(...).upgrade(...)`.
5. **Run the checks** (`npm run verify`, `npm run build`, `npm run electron:dev`).
6. **Open a pull request** and fill in the template, including the rule
   checklist.

### Commit messages

Follow the Conventional Commits style already used in the history:

```
feat(board): add swimlane grouping
fix(calendar): place completed tasks by completion date
docs(readme): document the release workflow
chore(deps): bump zod to 4.6.7
```

### Scope

Phases are planned in [`PLAN.md`](PLAN.md); the phase status there is the
single source of truth for what is done and what is next.

## Reporting bugs

Open an issue using the **Bug report** template. Never attach an exported
backup or paste database contents — Omivoid's data is private by design.

Security problems should be reported privately; see
[`SECURITY.md`](SECURITY.md).

## Code of conduct

By participating you agree to the [Code of Conduct](CODE_OF_CONDUCT.md).

## License

Omivoid is released under the [MIT License](LICENSE). Contributions are
accepted under the same terms.
