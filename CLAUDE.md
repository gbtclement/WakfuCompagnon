# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

```bash
npm install
npm run build                              # build:renderer (vite) + build:main (tsc)
npm run test                                # vitest run — full suite
npx vitest run tests/main/store.test.ts     # single test file
npx vitest run -t "adds and removes a timer"  # single test by name
npx tsc --noEmit -p tsconfig.main.json      # typecheck main + preload (CommonJS)
npx vue-tsc --noEmit -p tsconfig.json       # typecheck renderer (Vue SFCs)
npm run package                             # full build + electron-builder NSIS installer
```

Launching the built app manually (dev machines running this repo's shell often export
`ELECTRON_RUN_AS_NODE=1`, which breaks `require('electron')` resolution in the main process —
unset it first):

```bash
npm run build && env -u ELECTRON_RUN_AS_NODE npx electron dist/main/main.js
```

There is no lint script configured. Always run both typecheck commands (main and renderer are
separate `tsc` invocations with different module settings — see Gotchas) before committing.

## Architecture

Three-process Electron app, strict one-way data flow: **main → preload → renderer**, all IPC.

- `src/main/` — Node-privileged process. Owns the log watcher, parsers, persistence, and all
  business logic. Nothing here is reachable from the renderer except through explicit
  `ipcMain.handle` channels registered in `ipc.ts`.
- `src/preload/preload.ts` — the *only* file allowed to bridge main and renderer. Exposes a single
  `window.wakfuApi` object via `contextBridge`. `contextIsolation: true` / `nodeIntegration: false`
  are set in `main.ts`'s `BrowserWindow` — do not weaken these.
- `src/renderer/` — Vue 3 + Pinia SPA. Never imports Node/Electron APIs directly; everything goes
  through `window.wakfuApi` (typed via `WakfuApi` exported from `preload.ts`, declared globally in
  `wakfuApi.d.ts`).

### Log parsing pipeline

`LogWatcher` (`src/main/logWatcher.ts`) tails `wakfu.log` incrementally by byte offset (handles
rotation: if the file shrinks below the last known offset, it re-reads from 0). Each new line is
run through an ordered list of pure parser functions in `src/main/parsers/` (`serverConnection.ts`,
`questCompleted.ts`, `achievement.ts` — one file per event type, first match wins). Parsers are
plain functions `(line: string) => WakfuEvent | null`, independently unit-testable with fixtures in
`tests/parsers/fixtures.ts` captured from a real `wakfu.log`. `WakfuEvent` (discriminated union) is
defined in `parsers/types.ts` — every parser and every consumer switches on `.type`.

**There is deliberately no "environmental quest" parser.** An earlier version tried to track
environmental quests via a `Challenge courant : <id>` log line, but that id has no discoverable
name and its real meaning was never confirmed — it was removed entirely (see git history:
"Remove Challenge courant parser..."). Environmental quests are matched by exact string equality
between a user-entered quest name (Admin tab) and the `questName` field on `quest-completed`/
`quest-failed` events, which already carry the real in-game quest name. Do not reintroduce
challenge-id-based tracking.

### Persistence and IPC pattern

`AppStore` (`src/main/store.ts`) wraps `electron-store`. Every mutating method follows the same
shape: mutate one `AppConfig` key, return void (or the created record, for quest/timer creation
where the caller needs the generated id back). `ipc.ts` wraps each store method in
`ipcMain.handle('channel-name', ...)` and, by convention, **every mutating handler returns the
full updated `AppConfig`** (via `store.getConfig()`) rather than a diff — the renderer stores just
replace `this.config` wholesale. Follow this pattern for new mutations rather than inventing partial
updates.

IDs: `TimerRecord.id`, `Archimonster.id`, `Exploit.id`, and `EnvironmentalQuest.id` are all
`crypto.randomUUID()`-generated server-side (main process), never user-supplied. `Exploit` composes
other entities by id reference (`questIds: string[]`, `archimonsterIds: string[]`); removing a
quest or archimonster cascades to strip it from any exploit's reference arrays (see
`removeEnvironmentalQuest`/`removeArchimonster` in `store.ts`) rather than blocking the deletion.

### Renderer state

Four Pinia stores, each with a narrow purpose:
- `appState.ts` — live session state (`liveEvents`, mirrored `AppConfig`), subscribes to
  `onWakfuEvent`/`onTimerExpired` pushes from main and triggers toasts.
- `admin.ts` — CRUD proxy for the Admin tab's three referentials (quests/archimonsters/exploits).
- `theme.ts` — dark/light toggle, persisted to `localStorage` directly (not `electron-store` —
  it's a pure UI preference, doesn't need to round-trip through main).
- `toasts.ts` — in-app toast queue, separate from native OS notifications (`main/notifications.ts`).

Both `appState` and `admin` independently call `getConfig()` on mount and hold their own copy of
`AppConfig` — there is no single shared config store. When adding a view that needs config data,
check whether `appState` or `admin` already loads what you need before adding a third fetch path.

### Update check

`src/main/updateCheck.ts` queries the GitHub Releases API
(`api.github.com/repos/gbtclement/WakfuCompagnon/releases/latest`) via `net.fetch` (Electron's
net module, not global `fetch`, for main-process compatibility). Split into a pure function
(`parseLatestRelease`, unit-tested) and an async wrapper (`checkForUpdate`, does the actual
network call, swallows all errors to `null` — the UI badge simply doesn't appear on failure, never
throws). The renderer's `open-external` IPC channel is restricted to `https://github.com` URLs only
(main-process validation) — do not relax this without adding a reason, since the renderer is the
least-trusted process in Electron's threat model.

## Gotchas

- **TypeScript 7 vs 5**: this environment's `npm install typescript` can resolve to TS7 (a real
  npm dist-tag as of this writing, not a typo), which `vue-tsc@3.3.7` cannot yet parse
  (`ERR_PACKAGE_PATH_NOT_EXPORTED`). `package.json` pins `typescript@^5.9.3` — do not bump past 5.x
  without confirming `vue-tsc` compatibility first.
- **electron-store must stay on 8.x**: v9+ shipped ESM-only (`"type": "module"` in its own
  `package.json`), which breaks `require()` from the CommonJS-compiled main process
  (`tsconfig.main.json` targets `"module": "CommonJS"`). Do not upgrade `electron-store` without
  switching the whole main/preload build to ESM first.
- **`tsconfig.main.json` uses `moduleResolution: "Node"`, not `"Bundler"`** — `"Bundler"` requires
  `module` to be ES2015+, which conflicts with the CommonJS output this project needs. The
  renderer's `tsconfig.json` is a separate, independent config (Vite/ESM) — the two are typechecked
  with two separate commands (see Commands above) and can disagree without either being wrong.
- **Vite `base` must stay `'./'`** (`vite.config.ts`) — an absolute base (Vite's default) emits
  `/assets/...` script tags that resolve to the filesystem root under `file://`, silently producing
  a blank white window when the packaged app loads `index.html` via `loadFile`. This was a real
  regression once; if the packaged app shows a blank window, check this first.
- **`ELECTRON_RUN_AS_NODE`**: if this env var is set (common in some CI/dev-container shells),
  `require('electron')` returns the path string instead of the Electron API object, and
  `app.whenReady is not a function` errors follow. Always `env -u ELECTRON_RUN_AS_NODE` before
  running the built app from this kind of shell.
- Game data (quest lists, archimonster stats) is **not** extractable from the installed game files
  — `%LocalAppData%\Ankama\Wakfu\contents\...` ships proprietary compressed `.bin` blobs inside
  `.jar` archives, undocumented and not worth reverse engineering for this project (see README's
  CGU section). All three referentials (quests, archimonsters, exploits) are manually maintained
  through the Admin tab — don't attempt to auto-populate them from game files.
- The NSIS installer is **unsigned**. Windows SmartScreen / antivirus false positives are expected
  and are a reputation problem, not a code problem — see README for details. Don't "fix" this by
  disabling signature checks or adding exclusions in build scripts.

## Design docs

`docs/superpowers/specs/` holds one design doc per significant change (dated, one topic each);
`docs/superpowers/plans/` holds the corresponding step-by-step implementation plans. When making a
non-trivial change, check whether a relevant spec already exists before re-deriving context from
the code alone.
