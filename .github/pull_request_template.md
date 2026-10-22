## What changed

<!-- One or two sentences. What does this PR do? -->

## Why

<!-- The problem this solves. Link the issue if there is one: "Closes #123" -->

## How it was verified

<!--
Required before a PR can be merged:

- [ ] `npm run lint` — no errors
- [ ] `npm run typecheck` — clean
- [ ] `npm run test` — all tests pass
- [ ] `npm run build` — static export succeeds
- [ ] `npm run electron:dev` — the desktop app still launches
-->

- [ ] `npm run lint` — no errors
- [ ] `npm run typecheck` — clean
- [ ] `npm run test` — all tests pass
- [ ] `npm run build` — static export succeeds
- [ ] `npm run electron:dev` — the desktop app still launches

## Project rules

<!-- Tick the boxes that apply. See AGENTS.md. -->

- [ ] The change keeps the app **local-only** (no network requests, no CDN, no analytics, no telemetry, no external APIs).
- [ ] The change touches no fonts, icons or images that are not bundled locally.
- [ ] Storage still goes through the repository layer and is validated with Zod; the UI does not talk to Dexie directly.
- [ ] TypeScript is strict and contains no `any`.
- [ ] Raw errors are not shown to users; friendly messages only, technical details to the console.
- [ ] No new runtime dependency was added (or, if unavoidable, the reason is explained above).

## Notes for the reviewer

<!-- Anything worth a second look, screenshots before/after, known trade-offs. -->
