# One-Click Auto-Update Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the current "click badge → opens GitHub release page" update flow with a true
one-click flow: download the update in the background, then install and restart automatically,
without ever leaving Wakfu Companion.

**Architecture:** `electron-updater` replaces the hand-rolled `updateCheck.ts` GitHub-Releases-API
polling. A new `src/main/autoUpdate.ts` wraps `autoUpdater`, relays its events to the renderer over
the same IPC-push pattern already used for `wakfu-event-pushed`/`timer-expired`. `UpdateBadge.vue`
gains a small state machine (`idle | available | downloading | ready | error`) driven by those
pushed events instead of a single `updateInfo` value.

**Tech Stack:** `electron-updater` (new dependency, pinned `^6.8.9`), Electron's `autoUpdater`
GitHub provider, `electron-builder`'s `publish` config for `latest.yml` generation.

## Global Constraints

- The installer stays unsigned (accepted risk per spec — no code-signing certificate purchase in
  this plan). SmartScreen may interfere with automatic download/install more than a manual
  double-click; this is a known, accepted trade-off, not a bug to fix here.
- Update check runs once at app startup — no periodic polling.
- After download completes, the app installs and restarts immediately with no
  "restart later" confirmation step (the initial badge click is the user's confirmation).
- On any failure (network, SmartScreen block, corrupt download), the badge must return to a
  clickable "update available" state with a visible error indicator — never fail silently or leave
  the badge stuck in a non-interactive state.
- `src/main/updateCheck.ts` and `tests/main/updateCheck.test.ts` are deleted — fully superseded,
  not kept alongside the new mechanism.
- Every future GitHub release must upload `latest.yml` (and its blockmap) alongside the `.exe` —
  `electron-updater` cannot detect updates without it.

---

## File Structure

```
src/main/
  autoUpdate.ts          # NEW — wraps electron-updater, relays events over IPC-push
  updateCheck.ts          # DELETED
  ipc.ts                   # MODIFY — remove check-for-update handler, add update-download handler
  main.ts                   # MODIFY — call registerAutoUpdate() at startup instead of nothing

src/preload/
  preload.ts                # MODIFY — remove checkForUpdate, add onUpdateAvailable/
                             #          onUpdateDownloadProgress/onUpdateDownloaded/onUpdateError/
                             #          downloadUpdate

src/renderer/
  components/
    UpdateBadge.vue           # MODIFY — state machine driven by pushed events

electron-builder.yml           # MODIFY — add publish: block

tests/
  main/
    updateCheck.test.ts         # DELETED
    autoUpdate.test.ts           # NEW — tests the pure event-relay logic in isolation
```

**Interfaces summary (for cross-task reference):**
- `src/main/autoUpdate.ts` exports `registerAutoUpdate(getWindow: () => BrowserWindow | null):
  void` (wires `autoUpdater` listeners, called once from `main.ts`) and
  `downloadUpdate(): Promise<void>` (thin wrapper over `autoUpdater.downloadUpdate()`, called from
  the new IPC handler).
- Renderer push events (channel names, mirroring `wakfu-event-pushed` style):
  `update-available-pushed` → payload `{ version: string }`;
  `update-download-progress-pushed` → payload `{ percent: number }`;
  `update-downloaded-pushed` → no payload (installer about to run);
  `update-error-pushed` → payload `{ message: string }`.
- `window.wakfuApi` gains: `onUpdateAvailable(cb: (info: {version: string}) => void): void`,
  `onUpdateDownloadProgress(cb: (info: {percent: number}) => void): void`,
  `onUpdateDownloaded(cb: () => void): void`,
  `onUpdateError(cb: (info: {message: string}) => void): void`,
  `downloadUpdate(): Promise<void>`.

---

### Task 1: Add and configure `electron-updater`

**Files:**
- Modify: `package.json`
- Modify: `electron-builder.yml`

**Interfaces:**
- Consumes: nothing.
- Produces: the `electron-updater` package available for import in Task 2; `publish` config so
  `npm run package` emits `latest.yml`.

- [ ] **Step 1: Install `electron-updater`**

Run: `npm install electron-updater@^6.8.9`

Expected: `package.json` `dependencies` gains `"electron-updater": "^6.8.9"`, `package-lock.json`
updated.

- [ ] **Step 2: Add the `publish` block to `electron-builder.yml`**

Current file:

```yaml
appId: com.wakfucompanion.app
productName: Wakfu Companion
directories:
  output: release
files:
  - dist/**/*
win:
  target: nsis
nsis:
  oneClick: false
  allowToChangeInstallationDirectory: true
```

New file:

```yaml
appId: com.wakfucompanion.app
productName: Wakfu Companion
directories:
  output: release
files:
  - dist/**/*
win:
  target: nsis
nsis:
  oneClick: false
  allowToChangeInstallationDirectory: true
publish:
  provider: github
  owner: gbtclement
  repo: WakfuCompagnon
```

- [ ] **Step 3: Verify the package script still runs and now emits `latest.yml`**

Run: `npm run build && npx electron-builder --publish never`
Expected: succeeds (exit 0); `release/latest.yml` is created alongside the usual
`release/Wakfu Companion Setup <version>.exe`. `--publish never` prevents electron-builder from
attempting to upload to GitHub itself (this plan uploads manually via `gh release`, matching the
existing release process) — without this flag electron-builder would try to auto-publish using a
`GH_TOKEN` env var that isn't set up for this workflow.

- [ ] **Step 4: Commit**

```bash
git add package.json package-lock.json electron-builder.yml
git commit -m "build: add electron-updater dependency and publish config"
```

---

### Task 2: `autoUpdate.ts` — wrap `autoUpdater` and relay events

**Files:**
- Create: `src/main/autoUpdate.ts`
- Test: `tests/main/autoUpdate.test.ts`

**Interfaces:**
- Consumes: `electron-updater`'s `autoUpdater` singleton; `BrowserWindow` from `electron`.
- Produces: `registerAutoUpdate(getWindow: () => BrowserWindow | null): void`,
  `downloadUpdate(): Promise<void>` — used by Task 3 (`main.ts`) and Task 4 (`ipc.ts`).

`autoUpdater` itself (network calls, actual download, NSIS invocation) is a third-party dependency
we trust the contract of — same convention as `electron-store`/`net.fetch` elsewhere in this repo
(see CLAUDE.md: main-process Electron APIs aren't re-tested, only the code we write around them).
What *is* ours to test is the event-relay logic: given a fake emitter standing in for
`autoUpdater`, does `registerAutoUpdate` wire the right channel name to the right payload shape on
the right window? We inject a fake "autoUpdater-like" object into a testable factory function
rather than mocking the real module, keeping the test fast and dependency-free.

- [ ] **Step 1: Write the failing test**

```typescript
// tests/main/autoUpdate.test.ts
import { describe, it, expect, vi } from 'vitest'
import { EventEmitter } from 'events'
import { createAutoUpdateRegistrar } from '../../src/main/autoUpdate'

function fakeWindow() {
  return { webContents: { send: vi.fn() } }
}

describe('createAutoUpdateRegistrar', () => {
  it('relays update-available with the version', () => {
    const fakeUpdater = new EventEmitter() as EventEmitter & { checkForUpdates: () => void; downloadUpdate: () => void; quitAndInstall: () => void }
    fakeUpdater.checkForUpdates = vi.fn()
    fakeUpdater.downloadUpdate = vi.fn()
    fakeUpdater.quitAndInstall = vi.fn()

    const win = fakeWindow()
    const { registerAutoUpdate } = createAutoUpdateRegistrar(fakeUpdater as never)
    registerAutoUpdate(() => win as never)

    fakeUpdater.emit('update-available', { version: '1.2.3' })

    expect(win.webContents.send).toHaveBeenCalledWith('update-available-pushed', { version: '1.2.3' })
  })

  it('relays download-progress with the percent', () => {
    const fakeUpdater = new EventEmitter() as EventEmitter & { checkForUpdates: () => void; downloadUpdate: () => void; quitAndInstall: () => void }
    fakeUpdater.checkForUpdates = vi.fn()
    fakeUpdater.downloadUpdate = vi.fn()
    fakeUpdater.quitAndInstall = vi.fn()

    const win = fakeWindow()
    const { registerAutoUpdate } = createAutoUpdateRegistrar(fakeUpdater as never)
    registerAutoUpdate(() => win as never)

    fakeUpdater.emit('download-progress', { percent: 42.7 })

    expect(win.webContents.send).toHaveBeenCalledWith('update-download-progress-pushed', { percent: 42.7 })
  })

  it('relays update-downloaded and then calls quitAndInstall', () => {
    const fakeUpdater = new EventEmitter() as EventEmitter & { checkForUpdates: () => void; downloadUpdate: () => void; quitAndInstall: () => void }
    fakeUpdater.checkForUpdates = vi.fn()
    fakeUpdater.downloadUpdate = vi.fn()
    fakeUpdater.quitAndInstall = vi.fn()

    const win = fakeWindow()
    const { registerAutoUpdate } = createAutoUpdateRegistrar(fakeUpdater as never)
    registerAutoUpdate(() => win as never)

    fakeUpdater.emit('update-downloaded')

    expect(win.webContents.send).toHaveBeenCalledWith('update-downloaded-pushed')
    expect(fakeUpdater.quitAndInstall).toHaveBeenCalled()
  })

  it('relays error with a message string', () => {
    const fakeUpdater = new EventEmitter() as EventEmitter & { checkForUpdates: () => void; downloadUpdate: () => void; quitAndInstall: () => void }
    fakeUpdater.checkForUpdates = vi.fn()
    fakeUpdater.downloadUpdate = vi.fn()
    fakeUpdater.quitAndInstall = vi.fn()

    const win = fakeWindow()
    const { registerAutoUpdate } = createAutoUpdateRegistrar(fakeUpdater as never)
    registerAutoUpdate(() => win as never)

    fakeUpdater.emit('error', new Error('network down'))

    expect(win.webContents.send).toHaveBeenCalledWith('update-error-pushed', { message: 'network down' })
  })

  it('does nothing when the window is null', () => {
    const fakeUpdater = new EventEmitter() as EventEmitter & { checkForUpdates: () => void; downloadUpdate: () => void; quitAndInstall: () => void }
    fakeUpdater.checkForUpdates = vi.fn()
    fakeUpdater.downloadUpdate = vi.fn()
    fakeUpdater.quitAndInstall = vi.fn()

    const { registerAutoUpdate } = createAutoUpdateRegistrar(fakeUpdater as never)
    registerAutoUpdate(() => null)

    expect(() => fakeUpdater.emit('update-available', { version: '1.2.3' })).not.toThrow()
  })

  it('calls checkForUpdates when registered', () => {
    const fakeUpdater = new EventEmitter() as EventEmitter & { checkForUpdates: () => void; downloadUpdate: () => void; quitAndInstall: () => void }
    fakeUpdater.checkForUpdates = vi.fn()
    fakeUpdater.downloadUpdate = vi.fn()
    fakeUpdater.quitAndInstall = vi.fn()

    const { registerAutoUpdate } = createAutoUpdateRegistrar(fakeUpdater as never)
    registerAutoUpdate(() => fakeWindow() as never)

    expect(fakeUpdater.checkForUpdates).toHaveBeenCalled()
  })

  it('downloadUpdate calls the underlying autoUpdater.downloadUpdate', async () => {
    const fakeUpdater = new EventEmitter() as EventEmitter & { checkForUpdates: () => void; downloadUpdate: () => void; quitAndInstall: () => void }
    fakeUpdater.checkForUpdates = vi.fn()
    fakeUpdater.downloadUpdate = vi.fn()
    fakeUpdater.quitAndInstall = vi.fn()

    const { downloadUpdate } = createAutoUpdateRegistrar(fakeUpdater as never)
    await downloadUpdate()

    expect(fakeUpdater.downloadUpdate).toHaveBeenCalled()
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/main/autoUpdate.test.ts`
Expected: FAIL — `src/main/autoUpdate.ts` does not exist.

- [ ] **Step 3: Write `src/main/autoUpdate.ts`**

```typescript
import { autoUpdater as realAutoUpdater } from 'electron-updater'
import type { BrowserWindow } from 'electron'

interface UpdaterLike {
  on(event: 'update-available', listener: (info: { version: string }) => void): unknown
  on(event: 'download-progress', listener: (info: { percent: number }) => void): unknown
  on(event: 'update-downloaded', listener: () => void): unknown
  on(event: 'error', listener: (err: Error) => void): unknown
  checkForUpdates(): unknown
  downloadUpdate(): unknown
  quitAndInstall(): unknown
}

export function createAutoUpdateRegistrar(updater: UpdaterLike) {
  function registerAutoUpdate(getWindow: () => BrowserWindow | null): void {
    updater.on('update-available', (info) => {
      getWindow()?.webContents.send('update-available-pushed', { version: info.version })
    })

    updater.on('download-progress', (info) => {
      getWindow()?.webContents.send('update-download-progress-pushed', { percent: info.percent })
    })

    updater.on('update-downloaded', () => {
      getWindow()?.webContents.send('update-downloaded-pushed')
      updater.quitAndInstall()
    })

    updater.on('error', (err) => {
      getWindow()?.webContents.send('update-error-pushed', { message: err.message })
    })

    updater.checkForUpdates()
  }

  async function downloadUpdate(): Promise<void> {
    await updater.downloadUpdate()
  }

  return { registerAutoUpdate, downloadUpdate }
}

const defaultRegistrar = createAutoUpdateRegistrar(realAutoUpdater as unknown as UpdaterLike)

export const registerAutoUpdate = defaultRegistrar.registerAutoUpdate
export const downloadUpdate = defaultRegistrar.downloadUpdate
```

**Typing caveat:** `realAutoUpdater as unknown as UpdaterLike` sidesteps structural checking
against `electron-updater`'s real event payloads. Its actual `update-available` event passes a
richer `UpdateInfo` object (version, release notes, files, etc.), not just `{ version: string }` —
the narrower `UpdaterLike` interface here only requires that the real payload be *assignable to* a
subset of its fields, which holds because `UpdateInfo` has a `version: string` property among
others structurally. Same reasoning applies to `error`, which `electron-updater` emits as a plain
`Error` — matches `UpdaterLike`'s `(err: Error) => void` exactly. Verify this against the installed
package's `.d.ts` (`node_modules/electron-updater/out/main.d.ts` after Task 1's `npm install`)
before assuming it still holds on a future `electron-updater` version bump.

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run tests/main/autoUpdate.test.ts`
Expected: PASS

- [ ] **Step 5: Typecheck**

Run: `npx tsc --noEmit -p tsconfig.main.json`
Expected: no errors.

- [ ] **Step 6: Commit**

```bash
git add src/main/autoUpdate.ts tests/main/autoUpdate.test.ts
git commit -m "client: add autoUpdate module wrapping electron-updater"
```

---

### Task 3: Wire `registerAutoUpdate` into `main.ts`, remove old update check plumbing

**Files:**
- Modify: `src/main/main.ts`
- Delete: `src/main/updateCheck.ts`
- Delete: `tests/main/updateCheck.test.ts`

**Interfaces:**
- Consumes: `registerAutoUpdate` (Task 2).
- Produces: the app calls `registerAutoUpdate(() => mainWindow)` once at startup, replacing the
  removed `checkForUpdate` import.

- [ ] **Step 1: Delete the old update-check files**

Run: `rm src/main/updateCheck.ts tests/main/updateCheck.test.ts`

- [ ] **Step 2: Modify `src/main/main.ts`**

Add the import, alongside the existing ones:

```typescript
import { registerAutoUpdate } from './autoUpdate'
```

Add the call at the end of the `app.whenReady().then(() => { ... })` block, after
`registerIpcHandlers(...)`:

```typescript
  registerIpcHandlers(store, watcher, timerManager, () => mainWindow)
  registerAutoUpdate(() => mainWindow)
})
```

- [ ] **Step 3: Run the full test suite to confirm nothing references the deleted files**

Run: `npm run test`
Expected: all PASS — no test file should still import `updateCheck`.

- [ ] **Step 4: Typecheck**

Run: `npx tsc --noEmit -p tsconfig.main.json`
Expected: no errors (confirms nothing else imports the deleted `updateCheck.ts`).

- [ ] **Step 5: Commit**

```bash
git add src/main/main.ts
git rm src/main/updateCheck.ts tests/main/updateCheck.test.ts
git commit -m "client: wire auto-update into app startup, remove legacy update check"
```

---

### Task 4: IPC handler for triggering the download

**Files:**
- Modify: `src/main/ipc.ts`

**Interfaces:**
- Consumes: `downloadUpdate` (Task 2).
- Produces: IPC channel `update-download`, replacing the removed `check-for-update` handler.

- [ ] **Step 1: Modify `src/main/ipc.ts`**

Remove this import (no longer exists after Task 3):

```typescript
import { checkForUpdate } from './updateCheck'
```

Remove this handler:

```typescript
  ipcMain.handle('check-for-update', () => checkForUpdate(app.getVersion()))
```

Add this import:

```typescript
import { downloadUpdate } from './autoUpdate'
```

Add this handler in the same place the removed one was (near the top, after `get-config`):

```typescript
  ipcMain.handle('update-download', () => downloadUpdate())
```

Note: `app` (from `electron`) is still used elsewhere in this file for nothing else currently — if
`app.getVersion()` was its only use in `ipc.ts`, check whether `app` is still imported/used after
this removal; if the import becomes unused, remove `app` from the `import { ipcMain, shell, app,
dialog, BrowserWindow } from 'electron'` line to keep the typecheck clean (unused imports don't
fail `tsc` by default in this project's config, but remove it for cleanliness since it's now dead).

- [ ] **Step 2: Typecheck**

Run: `npx tsc --noEmit -p tsconfig.main.json`
Expected: no errors.

- [ ] **Step 3: Run the full test suite**

Run: `npm run test`
Expected: all PASS.

- [ ] **Step 4: Commit**

```bash
git add src/main/ipc.ts
git commit -m "client: add update-download IPC handler, remove check-for-update"
```

---

### Task 5: Expose the new methods through preload

**Files:**
- Modify: `src/preload/preload.ts`

**Interfaces:**
- Consumes: nothing new (channels from Tasks 2 and 4).
- Produces: `window.wakfuApi.onUpdateAvailable`, `.onUpdateDownloadProgress`,
  `.onUpdateDownloaded`, `.onUpdateError`, `.downloadUpdate` — used by Task 6 (`UpdateBadge.vue`).

- [ ] **Step 1: Modify `src/preload/preload.ts`**

Remove this import (the type no longer exists after Task 3):

```typescript
import type { UpdateInfo } from '../main/updateCheck'
```

Remove this line from the `api` object:

```typescript
  checkForUpdate: (): Promise<UpdateInfo | null> => ipcRenderer.invoke('check-for-update'),
```

Add these entries to the `api` object, after `removeExploit` (or after the last entry, wherever
that lands post-Task-9-of-the-previous-plan — append at the end of the object):

```typescript
  downloadUpdate: (): Promise<void> => ipcRenderer.invoke('update-download'),
  onUpdateAvailable: (callback: (info: { version: string }) => void): void => {
    ipcRenderer.on('update-available-pushed', (_event, payload: { version: string }) => callback(payload))
  },
  onUpdateDownloadProgress: (callback: (info: { percent: number }) => void): void => {
    ipcRenderer.on('update-download-progress-pushed', (_event, payload: { percent: number }) => callback(payload))
  },
  onUpdateDownloaded: (callback: () => void): void => {
    ipcRenderer.on('update-downloaded-pushed', () => callback())
  },
  onUpdateError: (callback: (info: { message: string }) => void): void => {
    ipcRenderer.on('update-error-pushed', (_event, payload: { message: string }) => callback(payload))
  }
```

- [ ] **Step 2: Typecheck**

Run: `npx tsc --noEmit -p tsconfig.main.json`
Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add src/preload/preload.ts
git commit -m "client: expose auto-update methods on window.wakfuApi"
```

---

### Task 6: `UpdateBadge.vue` state machine

**Files:**
- Modify: `src/renderer/components/UpdateBadge.vue`

**Interfaces:**
- Consumes: `window.wakfuApi.onUpdateAvailable/onUpdateDownloadProgress/onUpdateDownloaded/
  onUpdateError/downloadUpdate` (Task 5).
- Produces: nothing further downstream — this is the UI leaf.

- [ ] **Step 1: Rewrite `src/renderer/components/UpdateBadge.vue`**

```vue
<template>
  <button
    v-if="state !== 'idle'"
    class="update-badge"
    :class="{ 'update-badge-error': state === 'error' }"
    :disabled="state === 'downloading' || state === 'ready'"
    @click="onClick"
  >
    <span class="update-dot"></span>
    <span v-if="state === 'available'">Mise à jour disponible ({{ version }})</span>
    <span v-else-if="state === 'downloading'">Téléchargement... {{ Math.round(percent) }}%</span>
    <span v-else-if="state === 'ready'">Redémarrage en cours...</span>
    <span v-else-if="state === 'error'">Échec de la mise à jour — réessayer ({{ version }})</span>
  </button>
</template>

<script setup lang="ts">
import { onMounted, ref } from 'vue'

type UpdateState = 'idle' | 'available' | 'downloading' | 'ready' | 'error'

const state = ref<UpdateState>('idle')
const version = ref('')
const percent = ref(0)

onMounted(() => {
  window.wakfuApi.onUpdateAvailable((info) => {
    version.value = info.version
    state.value = 'available'
  })
  window.wakfuApi.onUpdateDownloadProgress((info) => {
    percent.value = info.percent
    state.value = 'downloading'
  })
  window.wakfuApi.onUpdateDownloaded(() => {
    state.value = 'ready'
  })
  window.wakfuApi.onUpdateError(() => {
    state.value = 'error'
  })
})

function onClick(): void {
  if (state.value !== 'available' && state.value !== 'error') return
  state.value = 'downloading'
  percent.value = 0
  window.wakfuApi.downloadUpdate()
}
</script>

<style scoped>
.update-badge {
  position: fixed;
  top: 14px;
  right: 18px;
  z-index: 90;
  display: flex;
  align-items: center;
  gap: 8px;
  background: var(--gold-soft);
  color: var(--gold);
  border: 1px solid color-mix(in srgb, var(--gold) 45%, transparent);
  border-radius: 20px;
  padding: 7px 14px;
  font-size: 12.5px;
  font-weight: 700;
  cursor: pointer;
  box-shadow: 0 0 10px color-mix(in srgb, var(--gold) 25%, transparent);
}

.update-badge:disabled {
  cursor: default;
  opacity: 0.85;
}

.update-badge-error {
  background: color-mix(in srgb, var(--danger, #d9534f) 18%, transparent);
  color: var(--danger, #d9534f);
  border-color: color-mix(in srgb, var(--danger, #d9534f) 45%, transparent);
}

.update-dot {
  width: 7px;
  height: 7px;
  border-radius: 50%;
  background: currentColor;
  box-shadow: 0 0 8px currentColor;
  flex-shrink: 0;
}
</style>
```

Note on the error state: clicking it re-attempts `downloadUpdate()` directly (the "available"
version is still known from the earlier push), matching the spec's requirement that the badge
"return to a clickable update available state" — implemented here as a distinct but equally
clickable `error` state that retries the same download rather than resetting to `available` and
losing the error indicator before the user has seen it.

- [ ] **Step 2: Typecheck**

Run: `npx vue-tsc --noEmit -p tsconfig.json`
Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add src/renderer/components/UpdateBadge.vue
git commit -m "client: rewrite UpdateBadge as a download/install state machine"
```

---

### Task 7: Full verification pass

**Files:** none (verification only).

**Interfaces:** none.

- [ ] **Step 1: Run the full test suite**

Run: `npm run test`
Expected: all PASS.

- [ ] **Step 2: Typecheck both main and renderer**

Run: `npx tsc --noEmit -p tsconfig.main.json && npx vue-tsc --noEmit -p tsconfig.json`
Expected: no errors.

- [ ] **Step 3: Full package build**

Run: `npm run package`
Expected: succeeds; `release/` contains the new installer `.exe`, its `.blockmap`, and
`latest.yml`. (This uses the default `publish` behavior from `electron-builder.yml`'s new block —
if this attempts to actually publish to GitHub and fails due to missing credentials, that's
expected in a dev environment; the artifacts in `release/` are still produced locally before any
publish attempt. Use `npm run build && npx electron-builder --publish never` instead if the plain
`npm run package` errors out on publish, to confirm local artifact generation works.)

- [ ] **Step 4: Report results**

Summarize pass/fail for each step above. Do not mark this task complete if any step failed.

---

## Post-plan note

This plan does not itself cut a new release. Once merged, the next release published via
`gh release create` must upload **both** `Wakfu Companion Setup <version>.exe` and `latest.yml`
(found in `release/` after `npm run package`) — `electron-updater` has nothing to detect updates
against without the `.yml` file. Update the release process to include:

```bash
gh release create v<version> "release/Wakfu Companion Setup <version>.exe" "release/latest.yml" --title "v<version>" --notes "..."
```

The very first release cut with this plan's changes will be the first one existing installs (still
running the old `openExternal`-based badge) can't auto-update *into* — users on the old badge still
need one manual GitHub visit to get this version. Every release after that one benefits from the
full one-click flow.