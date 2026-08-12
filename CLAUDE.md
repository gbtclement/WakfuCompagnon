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

Backend (`server/`) has its own independent `package.json`/build — see "Backend" section below.

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
- `server/` — separate backend (Node + Fastify + PostgreSQL), own `package.json`, deployed
  independently. See "Backend" section below.

### Log parsing pipeline

`LogWatcher` (`src/main/logWatcher.ts`) tails `wakfu.log` incrementally by byte offset (handles
rotation: if the file shrinks below the last known offset, it re-reads from 0). Each new line is
run through an ordered list of pure parser functions in `src/main/parsers/` (`serverConnection.ts`,
`questCompleted.ts`, `achievement.ts`, `jobLevelUp.ts` — one file per event type, first match
wins). Parsers are
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

`jobLevelUp.ts` detects lines like `Trappeur : +1 041 points d'XP.  +1 niveau.` — captures the job
name and levels gained (variable, not just +1). Job names are validated against `JOB_NAMES` in
`src/main/jobs.ts`; an unrecognized name returns `null` rather than throwing, same as any
unmatched line. See "Accounts, friends, and job tracking" below for what consumes this event.

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

`AppConfig.authToken`/`currentUser` hold the logged-in session (see below) — `authToken` is
encrypted via `safeStorage` before being written to `electron-store`; `AppStore.getSession()`
decrypts on read. Never expose the raw encrypted field to the renderer through the normal
`getConfig()` path expectation — only `getSession()`/the `auth-*` IPC channels decrypt it.

### Renderer state

Seven Pinia stores, each with a narrow purpose:
- `appState.ts` — live session state (`liveEvents`, mirrored `AppConfig`), subscribes to
  `onWakfuEvent`/`onTimerExpired` pushes from main and triggers toasts.
- `admin.ts` — CRUD proxy for the Admin tab's three referentials (quests/archimonsters/exploits).
- `theme.ts` — dark/light toggle, persisted to `localStorage` directly (not `electron-store` —
  it's a pure UI preference, doesn't need to round-trip through main).
- `toasts.ts` — in-app toast queue, separate from native OS notifications (`main/notifications.ts`).
- `auth.ts` — session state (`isLoggedIn`, `user`, `isAdmin` getter), register/login/logout actions.
- `friends.ts` — friends list + their job levels, pending requests, send/accept/reject actions.
- `adminUsers.ts` — admin-only account list/edit/delete, proxies `/admin/users` via IPC.

Both `appState` and `admin` independently call `getConfig()` on mount and hold their own copy of
`AppConfig` — there is no single shared config store. When adding a view that needs config data,
check whether `appState` or `admin` already loads what you need before adding a third fetch path.

### Accounts, friends, and job tracking

Optional layer on top of the otherwise fully-offline app — nothing below is required for the
core timer/quest/archimonster features to work. A logged-out user sees none of this UI.

- **Backend** (`server/`, separate Fastify app, deployed to Render.com at
  `wakfu-companion-server.onrender.com`, PostgreSQL on Supabase) exposes `/auth/register`,
  `/auth/login`, `/me/jobs`, `/friends/*`, `/admin/users/*`. See `server/README.md` and
  `docs/superpowers/specs/2026-08-09-accounts-friends-jobs-design.md` /
  `2026-08-10-admin-roles-design.md` for full design.
- **`src/main/apiClient.ts`** wraps `net.fetch` to that backend. Exposed via a **lazy singleton**
  (`getApiClient()`), not a module-level `export const` — see Gotchas below for why.
- **Roles**: every account has `role: 'player' | 'admin'`, embedded in the JWT at login/register
  time. The Admin tab is hidden client-side (`authStore.isAdmin`) for non-admins; the backend also
  enforces it server-side (`requireAdmin` middleware) — never rely on client-side hiding alone.
  **There is no UI to change a role** — promotion is manual-only, direct SQL against the
  production database (`UPDATE users SET role = 'admin' WHERE username = '...'`). A role change
  only takes effect on the user's *next login* — the JWT already issued still carries the old role
  until it's refreshed.
- **Job levels** sync automatically: when `jobLevelUp.ts` fires and a session is active, `ipc.ts`
  reads the player's current level for that job from the backend, adds the parsed delta, and PUTs
  the new total back — the backend has no concept of "increment", only "set to this value".

### Update check (auto-update)

`src/main/autoUpdate.ts` wraps `electron-updater` (GitHub provider) — this fully replaced the old
hand-rolled `updateCheck.ts` (deleted). `registerAutoUpdate()` is called once at startup; on
`update-available` the renderer badge (`UpdateBadge.vue`) shows a one-click download button, on
`update-downloaded` the app quits and installs automatically (no "restart later" step — see
`docs/superpowers/specs/2026-08-10-auto-update-design.md`). `createAutoUpdateRegistrar()` takes an
injectable updater so the event-relay logic is unit-testable without touching the real
`electron-updater` singleton (which, like `apiClient`, can't be imported at module scope under
vitest — see Gotchas).

**Every release must upload TWO files, or auto-update silently breaks:** the installer `.exe` and
`release/latest.yml` (both produced by `npm run package`). `electron-updater` reads `latest.yml`
to know what to download — without it, the update check finds nothing.

The renderer's `open-external` IPC channel is restricted to `https://github.com` URLs only
(main-process validation) — do not relax this without adding a reason, since the renderer is the
least-trusted process in Electron's threat model.

## Backend (`server/`)

Independent Fastify + PostgreSQL app, own `package.json`/`tsconfig.json`/`vitest.config.ts` at
`server/`. Never share a workspace/build step with the client — deploy and version separately.

- `src/app.ts` assembles plugins: `authPlugin`, `jobsRoutesPlugin`, `friendsPlugin`, `adminPlugin`.
- `src/auth/jwt.ts` — `requireAuth` (sets `request.userId`/`userRole`), `requireAdmin` (also
  requires `role === 'admin'`, 403 otherwise).
- `src/db.ts` — a single `pg.Pool`, connection string from `DATABASE_URL` env var.
- `migrations/*.sql` — plain numbered SQL files, applied via `scripts/migrate.ts`
  (`npx ts-node scripts/migrate.ts`), tracked in a `_migrations` table. No migration framework.
- **Deployed on Render.com**, connected to **Supabase Postgres via the connection pooler**
  (`aws-*.pooler.supabase.com:6543`), *not* the direct connection string
  (`db.*.supabase.co:5432`) — the direct string resolves to IPv6 and Render can't route to it
  (`ENETUNREACH`). Always grab the "Transaction pooler" URL from Supabase's connection string
  page.
- Local dev: a Postgres container (`docker run ... postgres:16`, named
  `wakfu-companion-postgres` in past sessions) + `server/.env` with `DATABASE_URL`/`JWT_SECRET`.
  Tests `TRUNCATE` all tables in `beforeEach` — never point `server/.env` at the production
  Supabase database while running tests.

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
- **`electron`'s `net`/`safeStorage`/`app`, and `electron-updater`'s `autoUpdater`, are only
  usable inside a running Electron process** — under vitest (plain Node), importing them at module
  scope throws immediately (`Cannot read properties of undefined`) or crashes on first use, before
  any test runs. Pattern used throughout this codebase to work around it: wrap the real singleton
  behind a lazy accessor (`getApiClient()` in `apiClient.ts`, `getDefaultRegistrar()` in
  `autoUpdate.ts`) that only touches the real module on first actual call — never
  `export const x = realThing` at module scope for anything that touches these APIs.
  `session.ts`'s `encryptToken`/`decryptToken` guard similarly with
  `typeof safeStorage !== 'undefined'`, falling back to base64 under vitest.
- **GitHub release assets: spaces become dots.** `electron-builder` produces
  `Wakfu Companion Setup X.Y.Z.exe` (spaces) locally, and `latest.yml` embeds that exact filename
  (electron-builder itself dash-encodes it internally as `Wakfu-Companion-Setup-X.Y.Z.exe` in the
  YAML). But `gh release upload`/GitHub's own upload path silently rewrites spaces to dots
  (`Wakfu.Companion.Setup.X.Y.Z.exe`) when the asset lands on the release. Result: the URL
  `electron-updater` tries to download 404s, and the badge shows a generic "update failed" with no
  useful detail. **Before uploading, rename the local file to match what `latest.yml` expects**
  (dashes, no spaces) so GitHub's rewrite doesn't create a mismatch — do not upload the
  space-named file directly.
- **`npm run test` at the repo root only runs the client suite** — the backend has its own
  independent test run (`cd server && npx vitest run`) with its own `.env`/database. CI-equivalent
  local verification means running both, separately.
- **`server/vitest.config.ts` needs `fileParallelism: false`**: route test files share one real
  Postgres and each `beforeEach` truncates all tables — running files in parallel (vitest's
  default) causes concurrent `TRUNCATE`s to deadlock. Also needs a `setupFiles` entry loading
  `dotenv/config` before any test file imports `src/db.ts` (which reads `DATABASE_URL` at module
  load) — otherwise import order between test files can leave `DATABASE_URL` undefined.

## Design docs

`docs/superpowers/specs/` holds one design doc per significant change (dated, one topic each);
`docs/superpowers/plans/` holds the corresponding step-by-step implementation plans. When making a
non-trivial change, check whether a relevant spec already exists before re-deriving context from
the code alone.

## Release process

1. Bump `version` in `package.json`.
2. `npm run test && npx tsc --noEmit -p tsconfig.main.json && npx vue-tsc --noEmit -p
   tsconfig.json` — must be green.
3. `npm run build && npx electron-builder --publish never` — produces `release/Wakfu Companion
   Setup X.Y.Z.exe`, its `.blockmap`, and `release/latest.yml`.
4. Commit the version bump, `git tag vX.Y.Z`, push both (`git push` + `git push --tags` or
   equivalent).
5. Rename the local `.exe` to replace spaces with dashes (see Gotchas) before uploading.
6. `gh release create vX.Y.Z <renamed .exe> release/latest.yml --title vX.Y.Z --notes "..."` —
   **both files required**, not just the installer.
7. If the backend changed too: apply any new `server/migrations/*.sql` against the production
   Supabase database (point `server/.env` at production `DATABASE_URL` temporarily,
   `npx ts-node scripts/migrate.ts`) — Render redeploys the backend automatically on push to
   `main`, but migrations are not run automatically.
