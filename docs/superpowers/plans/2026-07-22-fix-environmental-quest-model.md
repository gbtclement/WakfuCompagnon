# Fix Environmental Quest Model Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Remove the "Challenge courant" concept entirely (parser, event type, all display) and rebuild environmental quest tracking around the real, human-readable quest names already present in `quest-completed`/`quest-failed` log events.

**Architecture:** Same three-process Electron app. `EnvironmentalQuest.id` changes from a numeric log-derived challenge id to a generated uuid (matching the `Archimonster` pattern). Quest-encounter detection changes from watching for a `Challenge courant` id change to matching `quest-completed`/`quest-failed` event `questName` against followed quest names by exact string equality. The `environmental-quest` parser and `WakfuEvent` variant are deleted outright — there is no replacement parser, since `quest-completed`/`quest-failed` already exist and already carry the name.

**Tech Stack:** Same as existing app — TypeScript, Electron main/preload/renderer, Vue 3 + Pinia, electron-store, Vitest.

## Global Constraints

- No parsing, storage, or display of "Challenge courant" / `challengeId` anywhere in the codebase after this change (spec: "Décision").
- `EnvironmentalQuest.id` is a generated uuid (`crypto.randomUUID()`), not a user-supplied number — the Admin quest form has no ID field, only a name field (spec: "Écrans impactés — AdminView").
- `followedQuestIds` and `Exploit.questIds` become `string[]` (spec: "Changements de modèle").
- Quest-encounter matching is exact string equality between `EnvironmentalQuest.name` and `WakfuEvent.questName` on `quest-completed` or `quest-failed` events (spec: "Détection de rencontre").
- On first run after this update, any store data still shaped like the old numeric-id model is wiped rather than migrated — old challenge ids/names have no informational value (spec: "Migration des données existantes").
- Every store method touched needs its Vitest test updated to the new types; the deleted parser's tests and fixtures are removed, not left dangling (spec: "Tests").

---

## File Structure

```
src/main/
  parsers/
    types.ts                → remove 'environmental-quest' variant from WakfuEvent (MODIFY)
    environmentalQuest.ts    → DELETE
  logWatcher.ts              → remove parseEnvironmentalQuest from PARSERS list (MODIFY)
  store.ts                   → EnvironmentalQuest.id: string; followedQuestIds: string[]; Exploit.questIds: string[] (MODIFY)
  ipc.ts                     → add-environmental-quest takes only name; quest-encounter notify logic rewritten around quest-completed/quest-failed (MODIFY)
  main.ts                    → replace old JSON-seed-if-empty logic with a wipe-if-old-shape migration (MODIFY)
src/preload/
  preload.ts                 → addEnvironmentalQuest(name) instead of (id, name); id params become string (MODIFY)
src/renderer/
  stores/
    admin.ts                 → addQuest(name) instead of (id, name); id params become string (MODIFY)
    appState.ts               → quest-encounter toast logic rewritten around quest-completed/quest-failed (MODIFY)
  views/
    AdminView.vue             → remove quest ID input field (MODIFY)
    ExploitsView.vue          → quest progress computed from quest-completed/quest-failed name match (MODIFY)
    HistoryView.vue           → remove 'environmental-quest' case from typeLabel/badgeClass/describe (MODIFY)
    ServerStatusView.vue      → remove 'environmental-quest' case from dotClass/describe (MODIFY)
tests/
  main/store.test.ts          → update quest/exploit tests to string ids (MODIFY)
  parsers/
    fixtures.ts                → remove ENVIRONMENTAL_QUEST_LINES (MODIFY)
    environmentalQuest.test.ts → DELETE
```

`src/main/data/environmentalQuests.json` is no longer referenced anywhere after Task 5 — it is left on disk (harmless, unused) rather than deleted, since removing it isn't necessary for correctness and isn't called for by the spec.

---

### Task 1: Remove the environmental-quest parser and event type

**Files:**
- Modify: `src/main/parsers/types.ts`
- Delete: `src/main/parsers/environmentalQuest.ts`
- Delete: `tests/parsers/environmentalQuest.test.ts`
- Modify: `tests/parsers/fixtures.ts`
- Modify: `src/main/logWatcher.ts`

**Interfaces:**
- Produces: `WakfuEvent` without the `environmental-quest` variant, consumed by every file in later tasks that pattern-matches on `WakfuEvent['type']`.

- [ ] **Step 1: Remove the `environmental-quest` variant from `WakfuEvent`**

In `src/main/parsers/types.ts`, replace the full contents:

```ts
export type WakfuEvent =
  | { type: 'server-connection'; server: string; timestamp: string }
  | { type: 'quest-completed'; questName: string; timestamp: string }
  | { type: 'quest-failed'; questName: string; timestamp: string }
  | { type: 'achievement'; achievementId: number; timestamp: string }

export type LineParser = (line: string) => WakfuEvent | null
```

- [ ] **Step 2: Delete the parser file**

```bash
rm src/main/parsers/environmentalQuest.ts
```

- [ ] **Step 3: Delete its test file**

```bash
rm tests/parsers/environmentalQuest.test.ts
```

- [ ] **Step 4: Remove `ENVIRONMENTAL_QUEST_LINES` from the shared fixtures**

In `tests/parsers/fixtures.ts`, replace the full contents:

```ts
export const SERVER_CONNECTION_LINES = {
  dispatcher: ' INFO 18:26:45,738 [AWT-EventQueue-0] (aVj:62) - Connexion au proxy :wakfu-dispatcher.ankama-games.com:5558 / ssl : true',
  ogrest: ' INFO 18:26:49,060 [AWT-EventQueue-0] (aVj:62) - Connexion au proxy :wakfu-ogrest.ankama-games.com:5556 / ssl : true'
}

export const QUEST_COMPLETED_LINES = {
  won: ' INFO 18:22:57,585 [AWT-EventQueue-0] (aPV:174) - [Information (jeu)] Vous venez de remporter la quête "Course : Salbatroce Voyageur"',
  failed: ' INFO 20:05:36,472 [AWT-EventQueue-0] (aPV:174) - [Information (jeu)] Quête échouée: "Collaboratif : Hordes de Vandaliénés"'
}

export const ACHIEVEMENT_LINES = {
  activated: ' INFO 16:29:51,226 [AWT-EventQueue-0] (ber:341) - Achievement activated : 4267',
  objectiveCompleted: ' INFO 21:03:16,003 [AWT-EventQueue-0] (ber:318) - Achievement objective completed : 9388'
}

export const UNRELATED_LINES = [
  ' WARN 20:05:40,092 [AWT-EventQueue-0] (ME:157) - Unable to get value for key content.151.10001',
  ' INFO 20:05:41,264 [AWT-EventQueue-0] (ftK:272) - Update de chaos du protecteur 311, chaos = false'
]
```

- [ ] **Step 5: Remove `parseEnvironmentalQuest` from `LogWatcher`'s parser list**

In `src/main/logWatcher.ts`, replace the full contents:

```ts
import { EventEmitter } from 'events'
import { openSync, closeSync, readSync, statSync, existsSync } from 'fs'
import { LineParser, WakfuEvent } from './parsers/types'
import { parseServerConnection } from './parsers/serverConnection'
import { parseQuestCompleted } from './parsers/questCompleted'
import { parseAchievement } from './parsers/achievement'

const PARSERS: LineParser[] = [
  parseServerConnection,
  parseQuestCompleted,
  parseAchievement
]

interface LogWatcherOptions {
  pollIntervalMs?: number
}

export class LogWatcher extends EventEmitter {
  private offset = 0
  private timer: NodeJS.Timeout | null = null
  private readonly pollIntervalMs: number

  constructor(private readonly logPath: string, options: LogWatcherOptions = {}) {
    super()
    this.pollIntervalMs = options.pollIntervalMs ?? 1000
  }

  start(): void {
    if (existsSync(this.logPath)) {
      this.offset = statSync(this.logPath).size
    }
    this.timer = setInterval(() => this.poll(), this.pollIntervalMs)
  }

  stop(): void {
    if (this.timer) clearInterval(this.timer)
    this.timer = null
  }

  private poll(): void {
    if (!existsSync(this.logPath)) return

    const size = statSync(this.logPath).size
    if (size < this.offset) {
      this.offset = 0
    }
    if (size === this.offset) return

    const fd = openSync(this.logPath, 'r')
    try {
      const length = size - this.offset
      const buffer = Buffer.alloc(length)
      readSync(fd, buffer, 0, length, this.offset)
      this.offset = size

      const text = buffer.toString('utf-8')
      const lines = text.split('\n').filter((l) => l.trim().length > 0)
      for (const line of lines) {
        const event = this.parseLine(line)
        if (event) this.emit('wakfu-event', event)
      }
    } finally {
      closeSync(fd)
    }
  }

  private parseLine(line: string): WakfuEvent | null {
    for (const parser of PARSERS) {
      const event = parser(line)
      if (event) return event
    }
    return null
  }
}
```

- [ ] **Step 6: Run the full test suite to confirm the removed parser leaves no dangling references**

Run: `npx vitest run`
Expected: PASS (27 tests: 30 minus the 3 deleted `environmentalQuest.test.ts` tests)

- [ ] **Step 7: Typecheck main**

Run: `npx tsc --noEmit -p tsconfig.main.json`
Expected: FAIL — `src/main/store.ts` and `src/main/ipc.ts` still reference the removed `environmental-quest` type and `challengeId` (this is expected; Tasks 2–3 fix it). Confirm the only errors are in those two files.

- [ ] **Step 8: Commit**

```bash
git add src/main/parsers/types.ts src/main/logWatcher.ts tests/parsers/fixtures.ts
git rm src/main/parsers/environmentalQuest.ts tests/parsers/environmentalQuest.test.ts
git commit -m "Remove Challenge courant parser and environmental-quest event type"
```

---

### Task 2: Store — EnvironmentalQuest/Exploit id model to string, quest CRUD without numeric id

**Files:**
- Modify: `src/main/store.ts`
- Test: `tests/main/store.test.ts`

**Interfaces:**
- Consumes: `randomUUID` from `crypto` (Node builtin).
- Produces: `EnvironmentalQuest { id: string; name: string }`, `AppConfig.followedQuestIds: string[]`, `Exploit.questIds: string[]`. New `AppStore` method signatures: `addEnvironmentalQuest(name: string): EnvironmentalQuest` (now generates its own id and returns the created record — a shape change from the old caller-supplied-id version), `updateEnvironmentalQuest(id: string, name: string): void`, `removeEnvironmentalQuest(id: string): void`, `addFollowedQuest(id: string): void`, `removeFollowedQuest(id: string): void`. Consumed by `ipc.ts` (Task 3).

- [ ] **Step 1: Update the failing tests first**

Replace the full contents of `tests/main/store.test.ts`:

```ts
import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { mkdtempSync, rmSync } from 'fs'
import { join } from 'path'
import { tmpdir } from 'os'
import { AppStore } from '../../src/main/store'

describe('AppStore', () => {
  let cwd: string
  let store: AppStore

  beforeEach(() => {
    cwd = mkdtempSync(join(tmpdir(), 'wakfu-store-test-'))
    store = new AppStore(cwd)
  })

  afterEach(() => {
    rmSync(cwd, { recursive: true, force: true })
  })

  it('starts with an empty default config', () => {
    expect(store.getConfig()).toEqual({
      logPath: null,
      followedQuestIds: [],
      timers: [],
      history: [],
      environmentalQuests: [],
      archimonsters: [],
      exploits: []
    })
  })

  it('persists a log path', () => {
    store.setLogPath('C:\\fake\\wakfu.log')
    expect(store.getConfig().logPath).toBe('C:\\fake\\wakfu.log')
  })

  it('adds and removes a followed quest id without duplicates', () => {
    store.addFollowedQuest('q1')
    store.addFollowedQuest('q1')
    expect(store.getConfig().followedQuestIds).toEqual(['q1'])
    store.removeFollowedQuest('q1')
    expect(store.getConfig().followedQuestIds).toEqual([])
  })

  it('adds and removes a timer', () => {
    store.addTimer({ id: 't1', name: 'Boss X', endsAt: 123456, durationMs: 60000 })
    expect(store.getConfig().timers).toEqual([{ id: 't1', name: 'Boss X', endsAt: 123456, durationMs: 60000 }])
    store.removeTimer('t1')
    expect(store.getConfig().timers).toEqual([])
  })

  it('appends events to history', () => {
    const event = { type: 'achievement' as const, achievementId: 1, timestamp: '00:00:00,000' }
    store.appendHistoryEvent(event)
    expect(store.getConfig().history).toEqual([event])
  })

  it('adds, updates, and removes an environmental quest with a generated id', () => {
    const created = store.addEnvironmentalQuest('Solo : Crocodailles de la Banquise')
    expect(created.name).toBe('Solo : Crocodailles de la Banquise')
    expect(typeof created.id).toBe('string')
    expect(store.getConfig().environmentalQuests).toEqual([created])

    store.updateEnvironmentalQuest(created.id, 'Nom corrigé')
    expect(store.getConfig().environmentalQuests).toEqual([{ id: created.id, name: 'Nom corrigé' }])

    store.removeEnvironmentalQuest(created.id)
    expect(store.getConfig().environmentalQuests).toEqual([])
  })

  it('adds, updates, and removes an archimonster', () => {
    store.addArchimonster({ id: 'a1', name: 'Comte Harebourg', respawnMinutes: 30 })
    expect(store.getConfig().archimonsters).toEqual([{ id: 'a1', name: 'Comte Harebourg', respawnMinutes: 30 }])

    store.updateArchimonster('a1', 'Comte Harebourg', 45)
    expect(store.getConfig().archimonsters).toEqual([{ id: 'a1', name: 'Comte Harebourg', respawnMinutes: 45 }])

    store.removeArchimonster('a1')
    expect(store.getConfig().archimonsters).toEqual([])
  })

  it('adds, updates, and removes an exploit', () => {
    store.addExploit({ id: 'e1', name: 'Maître des Silènes', questIds: ['q1'], archimonsterIds: ['a1'] })
    expect(store.getConfig().exploits).toEqual([{ id: 'e1', name: 'Maître des Silènes', questIds: ['q1'], archimonsterIds: ['a1'] }])

    store.updateExploit('e1', 'Maître des Silènes', ['q1', 'q2'], ['a1'])
    expect(store.getConfig().exploits).toEqual([{ id: 'e1', name: 'Maître des Silènes', questIds: ['q1', 'q2'], archimonsterIds: ['a1'] }])

    store.removeExploit('e1')
    expect(store.getConfig().exploits).toEqual([])
  })

  it('removing an environmental quest strips it from exploits that reference it', () => {
    store.addExploit({ id: 'e1', name: 'Maître des Silènes', questIds: ['q1', 'q2'], archimonsterIds: [] })
    store.removeEnvironmentalQuest('q1')
    expect(store.getConfig().exploits).toEqual([{ id: 'e1', name: 'Maître des Silènes', questIds: ['q2'], archimonsterIds: [] }])
  })

  it('removing an archimonster strips it from exploits that reference it', () => {
    store.addExploit({ id: 'e1', name: 'Maître des Silènes', questIds: [], archimonsterIds: ['a1', 'a2'] })
    store.removeArchimonster('a1')
    expect(store.getConfig().exploits).toEqual([{ id: 'e1', name: 'Maître des Silènes', questIds: [], archimonsterIds: ['a2'] }])
  })
})
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run tests/main/store.test.ts`
Expected: FAIL — `store.addFollowedQuest('q1')` type error at compile time is not how Vitest fails; since this is plain JS at runtime, the test will fail on assertions instead (e.g. `addEnvironmentalQuest` returning `undefined` instead of a record, or `followedQuestIds` still being typed/behaving as before). Confirm failures reference `addEnvironmentalQuest`/`followedQuestIds` behavior mismatches, not unrelated tests.

- [ ] **Step 3: Update `src/main/store.ts`**

Replace the full contents:

```ts
import { randomUUID } from 'crypto'
import Store from 'electron-store'
import { WakfuEvent } from './parsers/types'

export interface TimerRecord {
  id: string
  name: string
  endsAt: number
  durationMs: number
}

export interface EnvironmentalQuest {
  id: string
  name: string
}

export interface Archimonster {
  id: string
  name: string
  respawnMinutes: number
}

export interface Exploit {
  id: string
  name: string
  questIds: string[]
  archimonsterIds: string[]
}

export interface AppConfig {
  logPath: string | null
  followedQuestIds: string[]
  timers: TimerRecord[]
  history: WakfuEvent[]
  environmentalQuests: EnvironmentalQuest[]
  archimonsters: Archimonster[]
  exploits: Exploit[]
}

const DEFAULTS: AppConfig = {
  logPath: null,
  followedQuestIds: [],
  timers: [],
  history: [],
  environmentalQuests: [],
  archimonsters: [],
  exploits: []
}

export class AppStore {
  private store: Store<AppConfig>

  constructor(cwd?: string) {
    this.store = new Store<AppConfig>({ defaults: DEFAULTS, cwd })
  }

  getConfig(): AppConfig {
    return {
      logPath: this.store.get('logPath'),
      followedQuestIds: this.store.get('followedQuestIds'),
      timers: this.store.get('timers'),
      history: this.store.get('history'),
      environmentalQuests: this.store.get('environmentalQuests'),
      archimonsters: this.store.get('archimonsters'),
      exploits: this.store.get('exploits')
    }
  }

  setLogPath(path: string): void {
    this.store.set('logPath', path)
  }

  addFollowedQuest(id: string): void {
    const ids = this.store.get('followedQuestIds')
    if (!ids.includes(id)) {
      this.store.set('followedQuestIds', [...ids, id])
    }
  }

  removeFollowedQuest(id: string): void {
    const ids = this.store.get('followedQuestIds')
    this.store.set('followedQuestIds', ids.filter((existing) => existing !== id))
  }

  addTimer(timer: TimerRecord): void {
    this.store.set('timers', [...this.store.get('timers'), timer])
  }

  removeTimer(id: string): void {
    this.store.set('timers', this.store.get('timers').filter((t) => t.id !== id))
  }

  appendHistoryEvent(event: WakfuEvent): void {
    this.store.set('history', [...this.store.get('history'), event])
  }

  addEnvironmentalQuest(name: string): EnvironmentalQuest {
    const quest: EnvironmentalQuest = { id: randomUUID(), name }
    this.store.set('environmentalQuests', [...this.store.get('environmentalQuests'), quest])
    return quest
  }

  updateEnvironmentalQuest(id: string, name: string): void {
    const quests = this.store.get('environmentalQuests').map((q) => (q.id === id ? { ...q, name } : q))
    this.store.set('environmentalQuests', quests)
  }

  removeEnvironmentalQuest(id: string): void {
    this.store.set('environmentalQuests', this.store.get('environmentalQuests').filter((q) => q.id !== id))
    const exploits = this.store.get('exploits').map((e) => ({
      ...e,
      questIds: e.questIds.filter((qid) => qid !== id)
    }))
    this.store.set('exploits', exploits)
  }

  addArchimonster(archimonster: Archimonster): void {
    this.store.set('archimonsters', [...this.store.get('archimonsters'), archimonster])
  }

  updateArchimonster(id: string, name: string, respawnMinutes: number): void {
    const archimonsters = this.store.get('archimonsters').map((a) => (a.id === id ? { ...a, name, respawnMinutes } : a))
    this.store.set('archimonsters', archimonsters)
  }

  removeArchimonster(id: string): void {
    this.store.set('archimonsters', this.store.get('archimonsters').filter((a) => a.id !== id))
    const exploits = this.store.get('exploits').map((e) => ({
      ...e,
      archimonsterIds: e.archimonsterIds.filter((aid) => aid !== id)
    }))
    this.store.set('exploits', exploits)
  }

  addExploit(exploit: Exploit): void {
    this.store.set('exploits', [...this.store.get('exploits'), exploit])
  }

  updateExploit(id: string, name: string, questIds: string[], archimonsterIds: string[]): void {
    const exploits = this.store.get('exploits').map((e) => (e.id === id ? { ...e, name, questIds, archimonsterIds } : e))
    this.store.set('exploits', exploits)
  }

  removeExploit(id: string): void {
    this.store.set('exploits', this.store.get('exploits').filter((e) => e.id !== id))
  }
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx vitest run tests/main/store.test.ts`
Expected: PASS (10 tests)

- [ ] **Step 5: Run the full suite**

Run: `npx vitest run`
Expected: PASS (27 tests)

- [ ] **Step 6: Commit**

```bash
git add src/main/store.ts tests/main/store.test.ts
git commit -m "Change EnvironmentalQuest to a generated-id record; followedQuestIds/Exploit.questIds become string[]"
```

---

### Task 3: Main process — IPC channels and quest-encounter notification logic

**Files:**
- Modify: `src/main/ipc.ts`
- Modify: `src/main/main.ts`

**Interfaces:**
- Consumes: `AppStore`, `EnvironmentalQuest` from `src/main/store.ts` (Task 2).
- Produces: `ipcMain.handle('add-environmental-quest', ...)` now takes only `(name: string)` and returns `AppConfig` (the created quest is available via the returned config's `environmentalQuests` array — matches the existing pattern where every mutating channel returns the full updated config, so the renderer doesn't need a separate "get the new id back" channel). `'update-environmental-quest'` and `'remove-environmental-quest'` now take a `string` id instead of `number`. `'follow-quest'`/`'unfollow-quest'` now take a `string` id. Consumed by `preload.ts` (Task 4).

- [ ] **Step 1: Replace the full contents of `src/main/ipc.ts`**

```ts
import { randomUUID } from 'crypto'
import { ipcMain, dialog, BrowserWindow } from 'electron'
import { AppStore } from './store'
import { LogWatcher } from './logWatcher'
import { TimerManager } from './timers'
import { notify } from './notifications'

export function registerIpcHandlers(
  store: AppStore,
  watcher: LogWatcher,
  timerManager: TimerManager,
  getWindow: () => BrowserWindow | null
): void {
  ipcMain.handle('get-config', () => store.getConfig())

  ipcMain.handle('set-log-path', (_event, path: string) => {
    store.setLogPath(path)
    return store.getConfig()
  })

  ipcMain.handle('follow-quest', (_event, id: string) => {
    store.addFollowedQuest(id)
    return store.getConfig()
  })

  ipcMain.handle('unfollow-quest', (_event, id: string) => {
    store.removeFollowedQuest(id)
    return store.getConfig()
  })

  ipcMain.handle('create-timer', (_event, name: string, durationMs: number) => {
    return timerManager.createTimer(name, durationMs)
  })

  ipcMain.handle('cancel-timer', (_event, id: string) => {
    timerManager.cancelTimer(id)
    return store.getConfig()
  })

  ipcMain.handle('browse-log-file', async () => {
    const result = await dialog.showOpenDialog({
      properties: ['openFile'],
      filters: [{ name: 'Log files', extensions: ['log'] }]
    })
    if (result.canceled || result.filePaths.length === 0) return null
    const path = result.filePaths[0]
    store.setLogPath(path)
    return path
  })

  ipcMain.handle('add-environmental-quest', (_event, name: string) => {
    store.addEnvironmentalQuest(name)
    return store.getConfig()
  })

  ipcMain.handle('update-environmental-quest', (_event, id: string, name: string) => {
    store.updateEnvironmentalQuest(id, name)
    return store.getConfig()
  })

  ipcMain.handle('remove-environmental-quest', (_event, id: string) => {
    store.removeEnvironmentalQuest(id)
    return store.getConfig()
  })

  ipcMain.handle('add-archimonster', (_event, name: string, respawnMinutes: number) => {
    store.addArchimonster({ id: randomUUID(), name, respawnMinutes })
    return store.getConfig()
  })

  ipcMain.handle('update-archimonster', (_event, id: string, name: string, respawnMinutes: number) => {
    store.updateArchimonster(id, name, respawnMinutes)
    return store.getConfig()
  })

  ipcMain.handle('remove-archimonster', (_event, id: string) => {
    store.removeArchimonster(id)
    return store.getConfig()
  })

  ipcMain.handle('add-exploit', (_event, name: string, questIds: string[], archimonsterIds: string[]) => {
    store.addExploit({ id: randomUUID(), name, questIds, archimonsterIds })
    return store.getConfig()
  })

  ipcMain.handle('update-exploit', (_event, id: string, name: string, questIds: string[], archimonsterIds: string[]) => {
    store.updateExploit(id, name, questIds, archimonsterIds)
    return store.getConfig()
  })

  ipcMain.handle('remove-exploit', (_event, id: string) => {
    store.removeExploit(id)
    return store.getConfig()
  })

  watcher.on('wakfu-event', (event) => {
    store.appendHistoryEvent(event)
    getWindow()?.webContents.send('wakfu-event-pushed', event)

    if (event.type === 'quest-completed' || event.type === 'quest-failed') {
      const followedIds = store.getConfig().followedQuestIds
      const quest = store.getConfig().environmentalQuests.find(
        (q) => q.name === event.questName && followedIds.includes(q.id)
      )
      if (quest) {
        notify('Quête environnementale rencontrée', quest.name)
      }
    }

    if (event.type === 'server-connection') {
      notify('Connecté au serveur', event.server)
    }
  })
}
```

- [ ] **Step 2: Replace the migration seed in `src/main/main.ts` with a wipe-if-old-shape check**

Read the current file, then replace the full contents:

```ts
import { app, BrowserWindow } from 'electron'
import { join } from 'path'
import { AppStore } from './store'
import { LogWatcher } from './logWatcher'
import { TimerManager } from './timers'
import { notify } from './notifications'
import { registerIpcHandlers } from './ipc'
import { detectDefaultLogPath, ZAAP_LOG_PATH } from './logPathDetection'
import { existsSync } from 'fs'

let mainWindow: BrowserWindow | null = null

function createWindow(): void {
  mainWindow = new BrowserWindow({
    width: 1280,
    height: 800,
    minWidth: 960,
    minHeight: 600,
    webPreferences: {
      preload: join(__dirname, '../preload/preload.js'),
      contextIsolation: true,
      nodeIntegration: false
    }
  })

  if (process.env.VITE_DEV_SERVER_URL) {
    mainWindow.loadURL(process.env.VITE_DEV_SERVER_URL)
  } else {
    mainWindow.loadFile(join(__dirname, '../renderer/index.html'))
  }

  mainWindow.on('closed', () => {
    mainWindow = null
  })
}

app.whenReady().then(() => {
  createWindow()

  const store = new AppStore()

  const hasOldNumericQuestIds = store.getConfig().environmentalQuests.some(
    (q) => typeof (q as { id: unknown }).id === 'number'
  )
  if (hasOldNumericQuestIds) {
    const config = store.getConfig()
    for (const quest of config.environmentalQuests) {
      store.removeEnvironmentalQuest(quest.id)
    }
    for (const followedId of config.followedQuestIds) {
      store.removeFollowedQuest(followedId)
    }
  }

  const configuredPath = store.getConfig().logPath ?? detectDefaultLogPath((p) => existsSync(p))
  if (configuredPath && !store.getConfig().logPath) {
    store.setLogPath(configuredPath)
  }

  const watcher = new LogWatcher(configuredPath ?? ZAAP_LOG_PATH)
  if (configuredPath) watcher.start()

  const timerManager = new TimerManager(store, (timer) => {
    notify('Timer expiré', timer.name)
    mainWindow?.webContents.send('timer-expired', timer)
  })
  timerManager.start()

  registerIpcHandlers(store, watcher, timerManager, () => mainWindow)
})

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit()
})
```

(The wipe loop calls `removeEnvironmentalQuest`/`removeFollowedQuest` per entry rather than writing to the store directly, reusing the existing cascade-cleanup behavior in `removeEnvironmentalQuest` so any stale `Exploit.questIds` referencing old numeric ids are cleaned up too.)

- [ ] **Step 3: Typecheck**

Run: `npx tsc --noEmit -p tsconfig.main.json`
Expected: no errors

- [ ] **Step 4: Manual verification of the wipe**

This project's dev environment sets `ELECTRON_RUN_AS_NODE=1` by default, which breaks `require('electron')` resolution in the main process — unset it first. Run: `npm run build && env -u ELECTRON_RUN_AS_NODE npx electron dist/main/main.js`. Check the persisted config file (unpackaged dev run default: `%APPDATA%\Electron\config.json`) — `environmentalQuests` and `followedQuestIds` should now be empty arrays (the old "Challenge #XXXX" placeholder entries are gone). Close the app afterward.

- [ ] **Step 5: Commit**

```bash
git add src/main/ipc.ts src/main/main.ts
git commit -m "Rework IPC quest channels to string ids; wipe old numeric-id quest data instead of migrating it"
```

---

### Task 4: Preload bridge — update quest/follow signatures

**Files:**
- Modify: `src/preload/preload.ts`

**Interfaces:**
- Consumes: IPC channel names from Task 3, `AppConfig` (type-only) from `src/main/store.ts`.
- Produces: `window.wakfuApi.followQuest(id: string): Promise<AppConfig>`, `unfollowQuest(id: string): Promise<AppConfig>`, `addEnvironmentalQuest(name: string): Promise<AppConfig>`, `updateEnvironmentalQuest(id: string, name: string): Promise<AppConfig>`, `removeEnvironmentalQuest(id: string): Promise<AppConfig>`. Consumed by `src/renderer/stores/admin.ts` and `appState.ts` (Task 5).

- [ ] **Step 1: Replace the full contents of `src/preload/preload.ts`**

```ts
import { contextBridge, ipcRenderer } from 'electron'
import type { AppConfig, TimerRecord } from '../main/store'
import type { WakfuEvent } from '../main/parsers/types'

const api = {
  getConfig: (): Promise<AppConfig> => ipcRenderer.invoke('get-config'),
  setLogPath: (path: string): Promise<AppConfig> => ipcRenderer.invoke('set-log-path', path),
  browseLogFile: (): Promise<string | null> => ipcRenderer.invoke('browse-log-file'),
  followQuest: (id: string): Promise<AppConfig> => ipcRenderer.invoke('follow-quest', id),
  unfollowQuest: (id: string): Promise<AppConfig> => ipcRenderer.invoke('unfollow-quest', id),
  createTimer: (name: string, durationMs: number): Promise<TimerRecord> =>
    ipcRenderer.invoke('create-timer', name, durationMs),
  cancelTimer: (id: string): Promise<AppConfig> => ipcRenderer.invoke('cancel-timer', id),
  onWakfuEvent: (callback: (event: WakfuEvent) => void): void => {
    ipcRenderer.on('wakfu-event-pushed', (_event, payload: WakfuEvent) => callback(payload))
  },
  onTimerExpired: (callback: (timer: TimerRecord) => void): void => {
    ipcRenderer.on('timer-expired', (_event, payload: TimerRecord) => callback(payload))
  },
  addEnvironmentalQuest: (name: string): Promise<AppConfig> =>
    ipcRenderer.invoke('add-environmental-quest', name),
  updateEnvironmentalQuest: (id: string, name: string): Promise<AppConfig> =>
    ipcRenderer.invoke('update-environmental-quest', id, name),
  removeEnvironmentalQuest: (id: string): Promise<AppConfig> =>
    ipcRenderer.invoke('remove-environmental-quest', id),
  addArchimonster: (name: string, respawnMinutes: number): Promise<AppConfig> =>
    ipcRenderer.invoke('add-archimonster', name, respawnMinutes),
  updateArchimonster: (id: string, name: string, respawnMinutes: number): Promise<AppConfig> =>
    ipcRenderer.invoke('update-archimonster', id, name, respawnMinutes),
  removeArchimonster: (id: string): Promise<AppConfig> =>
    ipcRenderer.invoke('remove-archimonster', id),
  addExploit: (name: string, questIds: string[], archimonsterIds: string[]): Promise<AppConfig> =>
    ipcRenderer.invoke('add-exploit', name, questIds, archimonsterIds),
  updateExploit: (id: string, name: string, questIds: string[], archimonsterIds: string[]): Promise<AppConfig> =>
    ipcRenderer.invoke('update-exploit', id, name, questIds, archimonsterIds),
  removeExploit: (id: string): Promise<AppConfig> =>
    ipcRenderer.invoke('remove-exploit', id)
}

export type WakfuApi = typeof api

contextBridge.exposeInMainWorld('wakfuApi', api)
```

- [ ] **Step 2: Typecheck**

Run: `npx tsc --noEmit -p tsconfig.main.json`
Expected: no errors (renderer typecheck is expected to still fail until Task 5 — do not run `vue-tsc` yet)

- [ ] **Step 3: Commit**

```bash
git add src/preload/preload.ts
git commit -m "Update preload bridge quest signatures to string ids and name-only creation"
```

---

### Task 5: Renderer stores — admin.ts and appState.ts

**Files:**
- Modify: `src/renderer/stores/admin.ts`
- Modify: `src/renderer/stores/appState.ts`

**Interfaces:**
- Consumes: `window.wakfuApi.*` from Task 4, `AppConfig` (type-only) from `src/main/store.ts`.
- Produces: `useAdminStore().addQuest(name: string): Promise<void>` (signature change — no more `id` param), `updateQuest(id: string, name: string): Promise<void>`, `removeQuest(id: string): Promise<void>`. `useAppStore().followQuest(id: string): Promise<void>`, `unfollowQuest(id: string): Promise<void>`. Consumed by `AdminView.vue` and `ExploitsView.vue` (Task 6).

- [ ] **Step 1: Update `src/renderer/stores/admin.ts`**

Replace the full contents:

```ts
import { defineStore } from 'pinia'
import type { AppConfig } from '../../main/store'

interface AdminStateShape {
  config: AppConfig
}

export const useAdminStore = defineStore('admin', {
  state: (): AdminStateShape => ({
    config: {
      logPath: null,
      followedQuestIds: [],
      timers: [],
      history: [],
      environmentalQuests: [],
      archimonsters: [],
      exploits: []
    }
  }),
  actions: {
    async load(): Promise<void> {
      this.config = await window.wakfuApi.getConfig()
    },
    async addQuest(name: string): Promise<void> {
      this.config = await window.wakfuApi.addEnvironmentalQuest(name)
    },
    async updateQuest(id: string, name: string): Promise<void> {
      this.config = await window.wakfuApi.updateEnvironmentalQuest(id, name)
    },
    async removeQuest(id: string): Promise<void> {
      this.config = await window.wakfuApi.removeEnvironmentalQuest(id)
    },
    async addArchimonster(name: string, respawnMinutes: number): Promise<void> {
      this.config = await window.wakfuApi.addArchimonster(name, respawnMinutes)
    },
    async updateArchimonster(id: string, name: string, respawnMinutes: number): Promise<void> {
      this.config = await window.wakfuApi.updateArchimonster(id, name, respawnMinutes)
    },
    async removeArchimonster(id: string): Promise<void> {
      this.config = await window.wakfuApi.removeArchimonster(id)
    },
    async addExploit(name: string, questIds: string[], archimonsterIds: string[]): Promise<void> {
      this.config = await window.wakfuApi.addExploit(name, questIds, archimonsterIds)
    },
    async updateExploit(id: string, name: string, questIds: string[], archimonsterIds: string[]): Promise<void> {
      this.config = await window.wakfuApi.updateExploit(id, name, questIds, archimonsterIds)
    },
    async removeExploit(id: string): Promise<void> {
      this.config = await window.wakfuApi.removeExploit(id)
    }
  }
})
```

- [ ] **Step 2: Update `src/renderer/stores/appState.ts`**

Replace the full contents:

```ts
import { defineStore } from 'pinia'
import type { AppConfig, TimerRecord } from '../../main/store'
import type { WakfuEvent } from '../../main/parsers/types'
import { useToastStore } from './toasts'

interface AppStateShape {
  config: AppConfig
  liveEvents: WakfuEvent[]
}

export const useAppStore = defineStore('app', {
  state: (): AppStateShape => ({
    config: {
      logPath: null,
      followedQuestIds: [],
      timers: [],
      history: [],
      environmentalQuests: [],
      archimonsters: [],
      exploits: []
    },
    liveEvents: []
  }),
  actions: {
    async load(): Promise<void> {
      this.config = await window.wakfuApi.getConfig()
      const toastStore = useToastStore()

      window.wakfuApi.onWakfuEvent((event) => {
        this.liveEvents = [event, ...this.liveEvents]

        if (event.type === 'server-connection') {
          toastStore.push('info', 'Connecté au serveur', event.server)
        }
        if (event.type === 'quest-completed' || event.type === 'quest-failed') {
          const isFollowedEnvironmentalQuest = this.config.environmentalQuests.some(
            (q) => q.name === event.questName && this.config.followedQuestIds.includes(q.id)
          )
          if (isFollowedEnvironmentalQuest) {
            toastStore.push('success', 'Quête environnementale rencontrée', event.questName)
          }
        }
        if (event.type === 'quest-completed') {
          toastStore.push('success', 'Quête remportée', event.questName)
        }
        if (event.type === 'quest-failed') {
          toastStore.push('warning', 'Quête échouée', event.questName)
        }
      })
      window.wakfuApi.onTimerExpired((timer) => {
        this.config.timers = this.config.timers.filter((t: TimerRecord) => t.id !== timer.id)
        toastStore.push('warning', 'Timer expiré', timer.name)
      })
    },
    async setLogPath(path: string): Promise<void> {
      this.config = await window.wakfuApi.setLogPath(path)
    },
    async browseLogFile(): Promise<void> {
      const path = await window.wakfuApi.browseLogFile()
      if (path) this.config = await window.wakfuApi.getConfig()
    },
    async followQuest(id: string): Promise<void> {
      this.config = await window.wakfuApi.followQuest(id)
    },
    async unfollowQuest(id: string): Promise<void> {
      this.config = await window.wakfuApi.unfollowQuest(id)
    },
    async createTimer(name: string, durationMs: number): Promise<void> {
      const timer = await window.wakfuApi.createTimer(name, durationMs)
      this.config.timers = [...this.config.timers, timer]
    },
    async cancelTimer(id: string): Promise<void> {
      this.config = await window.wakfuApi.cancelTimer(id)
    }
  }
})
```

(Note: this produces two separate toasts on a followed-quest encounter — one generic "Quête remportée"/"Quête échouée" and one "Quête environnementale rencontrée" — matching the existing pattern where quest-completed/quest-failed always toast regardless of follow status, same as before this change.)

- [ ] **Step 3: Typecheck**

Run: `npx vue-tsc --noEmit -p tsconfig.json`
Expected: FAIL — `AdminView.vue`, `ExploitsView.vue`, `HistoryView.vue`, `ServerStatusView.vue` still reference the removed `environmental-quest` type and old numeric-id quest APIs (expected; Tasks 6–7 fix these). Confirm errors are confined to those four files.

- [ ] **Step 4: Commit**

```bash
git add src/renderer/stores/admin.ts src/renderer/stores/appState.ts
git commit -m "Update renderer stores for string-id quests and name-based encounter detection"
```

---

### Task 6: AdminView and ExploitsView — string ids, no ID input, name-based progress

**Files:**
- Modify: `src/renderer/views/AdminView.vue`
- Modify: `src/renderer/views/ExploitsView.vue`

**Interfaces:**
- Consumes: `useAdminStore` (Task 5) for `config.environmentalQuests: EnvironmentalQuest[]` (id is now `string`), `useAppStore` (Task 5) for `liveEvents: WakfuEvent[]`.
- Produces: nothing consumed elsewhere — both are leaf views.

- [ ] **Step 1: Replace the quest panel markup and script in `src/renderer/views/AdminView.vue`**

Replace the full contents:

```vue
<template>
  <div>
    <div class="page-header">
      <h1 class="h1">Admin</h1>
      <p class="subtitle">Gestion des quêtes environnementales, archimonstres et exploits</p>
    </div>

    <div class="panel">
      <h2 class="h2">Quêtes environnementales</h2>
      <div v-for="quest in admin.config.environmentalQuests" :key="quest.id" class="row">
        <span class="row-name">{{ quest.name }}</span>
        <button class="delete-btn" @click="admin.removeQuest(quest.id)">Retirer</button>
      </div>
      <form class="create-form" @submit.prevent="submitQuest">
        <input v-model="newQuestName" placeholder="Nom exact de la quête (ex: Solo : Crocodailles de la Banquise)" class="field" required />
        <button type="submit" class="primary-btn">Ajouter</button>
      </form>
    </div>

    <div class="panel">
      <h2 class="h2">Archimonstres</h2>
      <div v-for="mob in admin.config.archimonsters" :key="mob.id" class="row">
        <span class="row-name">{{ mob.name }}</span>
        <span class="row-meta">{{ mob.respawnMinutes }} min</span>
        <button class="delete-btn" @click="admin.removeArchimonster(mob.id)">Retirer</button>
      </div>
      <form class="create-form" @submit.prevent="submitArchimonster">
        <input v-model="newMobName" placeholder="Nom de l'archimonstre" class="field" required />
        <input v-model.number="newMobRespawn" type="number" min="1" placeholder="Respawn (min)" class="id-field" required />
        <button type="submit" class="primary-btn">Ajouter</button>
      </form>
    </div>

    <div class="panel">
      <h2 class="h2">Exploits</h2>
      <div v-for="exploit in admin.config.exploits" :key="exploit.id" class="row exploit-row">
        <span class="row-name">{{ exploit.name }}</span>
        <span class="row-meta">{{ exploit.questIds.length }} quête(s), {{ exploit.archimonsterIds.length }} archi(s)</span>
        <button class="delete-btn" @click="admin.removeExploit(exploit.id)">Retirer</button>
      </div>
      <form class="create-form exploit-form" @submit.prevent="submitExploit">
        <input v-model="newExploitName" placeholder="Nom de l'exploit" class="field" required />

        <div class="checkbox-group">
          <span class="checkbox-group-label">Quêtes environnementales</span>
          <label v-for="quest in admin.config.environmentalQuests" :key="quest.id" class="checkbox-item">
            <input type="checkbox" :value="quest.id" v-model="newExploitQuestIds" />
            {{ quest.name }}
          </label>
        </div>

        <div class="checkbox-group">
          <span class="checkbox-group-label">Archimonstres</span>
          <label v-for="mob in admin.config.archimonsters" :key="mob.id" class="checkbox-item">
            <input type="checkbox" :value="mob.id" v-model="newExploitArchimonsterIds" />
            {{ mob.name }}
          </label>
        </div>

        <button type="submit" class="primary-btn">Créer l'exploit</button>
      </form>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref } from 'vue'
import { useAdminStore } from '../stores/admin'

const admin = useAdminStore()

const newQuestName = ref('')

function submitQuest(): void {
  admin.addQuest(newQuestName.value)
  newQuestName.value = ''
}

const newMobName = ref('')
const newMobRespawn = ref(30)

function submitArchimonster(): void {
  admin.addArchimonster(newMobName.value, newMobRespawn.value)
  newMobName.value = ''
  newMobRespawn.value = 30
}

const newExploitName = ref('')
const newExploitQuestIds = ref<string[]>([])
const newExploitArchimonsterIds = ref<string[]>([])

function submitExploit(): void {
  admin.addExploit(newExploitName.value, newExploitQuestIds.value, newExploitArchimonsterIds.value)
  newExploitName.value = ''
  newExploitQuestIds.value = []
  newExploitArchimonsterIds.value = []
}
</script>

<style scoped>
.page-header {
  margin-bottom: 24px;
}

.h1 {
  font-family: 'Cinzel', serif;
  font-weight: 700;
  font-size: 28px;
  color: var(--text-primary);
  letter-spacing: 0.3px;
}

.subtitle {
  font-size: 14px;
  color: var(--text-secondary);
  margin: 6px 0 0 0;
}

.panel {
  background: var(--panel-bg);
  border: 2px solid var(--border);
  border-radius: 10px;
  box-shadow: inset 0 0 0 1px color-mix(in srgb, var(--border-strong) 20%, transparent);
  padding: 20px 22px;
  margin-bottom: 18px;
}

.h2 {
  font-family: 'Cinzel', serif;
  font-weight: 600;
  font-size: 16px;
  color: var(--gold);
  margin: 0 0 14px 0;
}

.row {
  display: flex;
  align-items: center;
  gap: 14px;
  padding: 9px 4px;
  border-bottom: 1px solid color-mix(in srgb, var(--border) 33%, transparent);
}

.row-name {
  flex: 1;
  color: var(--text-primary);
  font-size: 13.5px;
  font-weight: 600;
}

.row-meta {
  font-size: 12px;
  color: var(--text-secondary);
  flex-shrink: 0;
}

.delete-btn {
  background: transparent;
  color: var(--danger);
  border: 1px solid color-mix(in srgb, var(--danger) 33%, transparent);
  border-radius: 7px;
  padding: 6px 12px;
  font-size: 12px;
  font-weight: 600;
  cursor: pointer;
  flex-shrink: 0;
}

.create-form {
  display: flex;
  gap: 10px;
  margin-top: 14px;
  align-items: center;
}

.exploit-form {
  flex-direction: column;
  align-items: stretch;
}

.field {
  flex: 1;
}

.id-field {
  width: 140px;
}

.primary-btn {
  background: var(--accent);
  color: var(--on-accent);
  border: none;
  border-radius: 7px;
  padding: 10px 18px;
  font-weight: 700;
  font-size: 13.5px;
  cursor: pointer;
  white-space: nowrap;
}

.checkbox-group {
  display: flex;
  flex-direction: column;
  gap: 6px;
  background: var(--card-bg);
  border: 1px solid var(--border);
  border-radius: 7px;
  padding: 10px 12px;
  max-height: 160px;
  overflow-y: auto;
}

.checkbox-group-label {
  font-size: 11.5px;
  color: var(--text-secondary);
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.5px;
  margin-bottom: 2px;
}

.checkbox-item {
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 13px;
  color: var(--text-primary);
  cursor: pointer;
}
</style>
```

(Only the quest panel changed — the `row-id` span and `newQuestId` ref are removed; the archimonster and exploit panels are unchanged from before, reproduced here in full per the plan's no-partial-file-edits convention.)

- [ ] **Step 2: Replace `src/renderer/views/ExploitsView.vue`'s progress computation**

Replace the full contents:

```vue
<template>
  <div>
    <div class="page-header">
      <h1 class="h1">Exploits</h1>
      <p class="subtitle">Suis la progression de tes exploits en jeu</p>
    </div>

    <div v-if="admin.config.exploits.length === 0" class="empty-panel">
      Aucun exploit défini pour l'instant. Va dans l'onglet Admin pour en créer un.
    </div>

    <div v-for="exploit in exploitsWithProgress" :key="exploit.id" class="card exploit-card">
      <h2 class="exploit-name">{{ exploit.name }}</h2>

      <div v-if="exploit.quests.length > 0" class="sub-section">
        <span class="sub-label">Quêtes environnementales</span>
        <div v-for="quest in exploit.quests" :key="quest.id" class="sub-row">
          <span class="badge" :class="quest.encountered ? 'badge-following' : 'badge-pending'">
            {{ quest.encountered ? 'Rencontrée' : 'En attente' }}
          </span>
          <span class="sub-name">{{ quest.name }}</span>
        </div>
      </div>

      <div v-if="exploit.archimonsters.length > 0" class="sub-section">
        <span class="sub-label">Archimonstres</span>
        <div v-for="mob in exploit.archimonsters" :key="mob.id" class="sub-row">
          <span class="badge" :class="mob.hasActiveTimer ? 'badge-following' : 'badge-pending'">
            {{ mob.hasActiveTimer ? 'Timer actif' : 'Pas de timer' }}
          </span>
          <span class="sub-name">{{ mob.name }}</span>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import { useAppStore } from '../stores/appState'
import { useAdminStore } from '../stores/admin'

const app = useAppStore()
const admin = useAdminStore()

const encounteredQuestNames = computed(() => {
  const names = new Set<string>()
  for (const event of app.liveEvents) {
    if (event.type === 'quest-completed' || event.type === 'quest-failed') {
      names.add(event.questName)
    }
  }
  return names
})

const activeTimerNames = computed(() => new Set(admin.config.timers.map((t) => t.name)))

const exploitsWithProgress = computed(() =>
  admin.config.exploits.map((exploit) => ({
    ...exploit,
    quests: exploit.questIds.map((id) => {
      const quest = admin.config.environmentalQuests.find((q) => q.id === id)
      const name = quest?.name ?? 'Quête inconnue'
      return {
        id,
        name,
        encountered: encounteredQuestNames.value.has(name)
      }
    }),
    archimonsters: exploit.archimonsterIds.map((id) => {
      const mob = admin.config.archimonsters.find((a) => a.id === id)
      const name = mob?.name ?? 'Archimonstre inconnu'
      return {
        id,
        name,
        hasActiveTimer: activeTimerNames.value.has(name)
      }
    })
  }))
)
</script>

<style scoped>
.page-header {
  margin-bottom: 24px;
}

.h1 {
  font-family: 'Cinzel', serif;
  font-weight: 700;
  font-size: 28px;
  color: var(--text-primary);
  letter-spacing: 0.3px;
}

.subtitle {
  font-size: 14px;
  color: var(--text-secondary);
  margin: 6px 0 0 0;
}

.empty-panel {
  font-size: 13.5px;
  color: var(--text-secondary);
  padding: 16px 0;
}

.card {
  background: var(--card-bg);
  border: 1.5px solid var(--border);
  border-radius: 9px;
  box-shadow: 0 2px 6px rgba(0, 0, 0, 0.25);
}

.exploit-card {
  padding: 16px 18px;
  margin-bottom: 14px;
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.exploit-name {
  font-family: 'Cinzel', serif;
  font-weight: 700;
  font-size: 17px;
  color: var(--text-primary);
}

.sub-section {
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.sub-label {
  font-size: 11.5px;
  color: var(--text-secondary);
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.5px;
}

.sub-row {
  display: flex;
  align-items: center;
  gap: 10px;
}

.sub-name {
  font-size: 13.5px;
  color: var(--text-primary);
}

.badge {
  font-size: 11px;
  font-weight: 700;
  border-radius: 20px;
  padding: 3px 10px;
  white-space: nowrap;
  flex-shrink: 0;
  border: 1px solid transparent;
}

.badge-following {
  color: var(--accent);
  background: var(--accent-soft);
  border-color: color-mix(in srgb, var(--accent) 33%, transparent);
}

.badge-pending {
  color: var(--text-secondary);
  background: transparent;
  border-color: var(--border);
}
</style>
```

- [ ] **Step 3: Typecheck**

Run: `npx vue-tsc --noEmit -p tsconfig.json`
Expected: FAIL — `HistoryView.vue` and `ServerStatusView.vue` still reference `environmental-quest` (expected; Task 7 fixes these). Confirm errors are confined to those two files.

- [ ] **Step 4: Commit**

```bash
git add src/renderer/views/AdminView.vue src/renderer/views/ExploitsView.vue
git commit -m "Update AdminView quest form and ExploitsView progress to name-based matching"
```

---

### Task 7: HistoryView and ServerStatusView — remove environmental-quest display case

**Files:**
- Modify: `src/renderer/views/HistoryView.vue`
- Modify: `src/renderer/views/ServerStatusView.vue`

**Interfaces:**
- Consumes: `WakfuEvent` (type-only) from `src/main/parsers/types.ts` (Task 1) — now without the `environmental-quest` variant, so the `switch`/`if` statements in both files no longer need (and no longer compile with) a case for it.
- Produces: nothing consumed elsewhere — both are leaf views. This is the final task; after this, the whole app should typecheck clean.

- [ ] **Step 1: Remove the `environmental-quest` case from `src/renderer/views/HistoryView.vue`**

Replace the full contents:

```vue
<template>
  <div>
    <div class="page-header">
      <h1 class="h1">Historique de la session</h1>
      <p class="subtitle">Événements détectés depuis le lancement de l'application</p>
    </div>

    <div class="panel">
      <div v-if="store.liveEvents.length === 0" class="empty-text">Aucun événement pour l'instant.</div>
      <div v-for="(event, index) in store.liveEvents" :key="index" class="history-row">
        <span class="history-time">{{ event.timestamp }}</span>
        <span class="type-badge" :class="badgeClass(event)">{{ typeLabel(event) }}</span>
        <span class="history-text">{{ describe(event) }}</span>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { useAppStore } from '../stores/appState'
import type { WakfuEvent } from '../../main/parsers/types'

const store = useAppStore()

function typeLabel(event: WakfuEvent): string {
  switch (event.type) {
    case 'server-connection':
      return 'Serveur'
    case 'quest-completed':
      return 'Quête'
    case 'quest-failed':
      return 'Quête'
    case 'achievement':
      return 'Haut fait'
  }
}

function badgeClass(event: WakfuEvent): string {
  if (event.type === 'quest-completed' || event.type === 'achievement') return 'type-badge-gold'
  if (event.type === 'quest-failed') return 'type-badge-danger'
  return 'type-badge-accent'
}

function describe(event: WakfuEvent): string {
  switch (event.type) {
    case 'server-connection':
      return `Connexion au serveur ${event.server}`
    case 'quest-completed':
      return `Quête remportée : ${event.questName}`
    case 'quest-failed':
      return `Quête échouée : ${event.questName}`
    case 'achievement':
      return `Haut fait débloqué : #${event.achievementId}`
  }
}
</script>

<style scoped>
.page-header {
  margin-bottom: 24px;
}

.h1 {
  font-family: 'Cinzel', serif;
  font-weight: 700;
  font-size: 28px;
  color: var(--text-primary);
  letter-spacing: 0.3px;
}

.subtitle {
  font-size: 14px;
  color: var(--text-secondary);
  margin: 6px 0 0 0;
}

.panel {
  background: var(--panel-bg);
  border: 2px solid var(--border);
  border-radius: 10px;
  box-shadow: inset 0 0 0 1px color-mix(in srgb, var(--border-strong) 20%, transparent);
  padding: 20px 22px;
  margin-bottom: 18px;
}

.empty-text {
  font-size: 13.5px;
  color: var(--text-secondary);
}

.history-row {
  display: flex;
  align-items: center;
  gap: 14px;
  padding: 9px 4px;
  border-bottom: 1px solid color-mix(in srgb, var(--border) 33%, transparent);
}

.history-row:last-child {
  border-bottom: none;
}

.history-time {
  font-size: 12px;
  color: var(--text-secondary);
  width: 74px;
  flex-shrink: 0;
}

.type-badge {
  font-size: 11.5px;
  font-weight: 700;
  border-radius: 6px;
  padding: 3px 9px;
  width: 70px;
  text-align: center;
  flex-shrink: 0;
}

.type-badge-gold {
  color: var(--gold);
  background: var(--gold-soft);
}

.type-badge-accent {
  color: var(--accent);
  background: var(--accent-soft);
}

.type-badge-danger {
  color: var(--danger);
  background: color-mix(in srgb, var(--danger) 16%, transparent);
}

.history-text {
  color: var(--text-primary);
  font-size: 13.5px;
  flex: 1;
}
</style>
```

- [ ] **Step 2: Remove the `environmental-quest` case from `src/renderer/views/ServerStatusView.vue`**

Replace the full contents:

```vue
<template>
  <div>
    <div class="page-header">
      <h1 class="h1">Tableau de bord</h1>
      <p class="subtitle">Vue d'ensemble de l'activité détectée en jeu</p>
    </div>

    <div class="stat-grid">
      <div class="card stat-card">
        <span class="stat-label">Serveur</span>
        <span class="stat-value">{{ currentServer ?? 'Non détecté' }}</span>
        <span class="stat-sub" :class="currentServer ? 'stat-sub-success' : ''">
          {{ currentServer ? '● En ligne' : 'En attente de connexion' }}
        </span>
      </div>
      <div class="card stat-card">
        <span class="stat-label">Connexion aux logs</span>
        <span class="stat-value">{{ store.config.logPath ? 'Active' : 'Non configurée' }}</span>
        <span class="stat-sub">{{ store.config.logPath ?? 'Configure le chemin dans Paramètres' }}</span>
      </div>
      <div class="card stat-card">
        <span class="stat-label">Timers actifs</span>
        <span class="stat-value">{{ store.config.timers.length }}</span>
        <span class="stat-sub">archimonstres en cours</span>
      </div>
    </div>

    <div class="panel">
      <h2 class="h2">Derniers événements</h2>
      <div v-if="recentEvents.length === 0" class="empty-text">Rien à signaler pour l'instant.</div>
      <div v-for="(event, index) in recentEvents" :key="index" class="event-row">
        <span class="event-dot" :class="dotClass(event)"></span>
        <span class="event-text">{{ describe(event) }}</span>
        <span class="event-time">{{ event.timestamp }}</span>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import { useAppStore } from '../stores/appState'
import type { WakfuEvent } from '../../main/parsers/types'

const store = useAppStore()

const currentServer = computed(() => {
  const event = store.liveEvents.find((e) => e.type === 'server-connection')
  return event && event.type === 'server-connection' ? event.server : null
})

const recentEvents = computed(() => store.liveEvents.slice(0, 5))

function dotClass(event: WakfuEvent): string {
  if (event.type === 'quest-completed' || event.type === 'achievement') return 'event-dot-gold'
  if (event.type === 'quest-failed') return 'event-dot-danger'
  return 'event-dot-accent'
}

function describe(event: WakfuEvent): string {
  switch (event.type) {
    case 'server-connection':
      return `Connexion au serveur ${event.server}`
    case 'quest-completed':
      return `Quête remportée : ${event.questName}`
    case 'quest-failed':
      return `Quête échouée : ${event.questName}`
    case 'achievement':
      return `Haut fait débloqué : #${event.achievementId}`
  }
}
</script>

<style scoped>
.page-header {
  margin-bottom: 24px;
}

.h1 {
  font-family: 'Cinzel', serif;
  font-weight: 700;
  font-size: 28px;
  color: var(--text-primary);
  letter-spacing: 0.3px;
}

.subtitle {
  font-size: 14px;
  color: var(--text-secondary);
  margin: 6px 0 0 0;
}

.stat-grid {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 18px;
  margin-bottom: 22px;
}

.card {
  background: var(--card-bg);
  border: 1.5px solid var(--border);
  border-radius: 9px;
  box-shadow: 0 2px 6px rgba(0, 0, 0, 0.25);
}

.stat-card {
  display: flex;
  flex-direction: column;
  gap: 5px;
  padding: 16px 18px;
  min-width: 0;
}

.stat-label {
  font-size: 12px;
  color: var(--text-secondary);
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 0.5px;
}

.stat-value {
  font-family: 'Cinzel', serif;
  font-size: 19px;
  font-weight: 700;
  color: var(--text-primary);
}

.stat-sub {
  font-size: 12.5px;
  color: var(--text-secondary);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.stat-sub-success {
  color: var(--success);
}

.panel {
  background: var(--panel-bg);
  border: 2px solid var(--border);
  border-radius: 10px;
  box-shadow: inset 0 0 0 1px color-mix(in srgb, var(--border-strong) 20%, transparent);
  padding: 20px 22px;
  margin-bottom: 18px;
}

.h2 {
  font-family: 'Cinzel', serif;
  font-weight: 600;
  font-size: 16px;
  color: var(--gold);
  margin: 0 0 14px 0;
}

.empty-text {
  font-size: 13.5px;
  color: var(--text-secondary);
}

.event-row {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 10px 4px;
  border-bottom: 1px solid color-mix(in srgb, var(--border) 33%, transparent);
}

.event-row:last-child {
  border-bottom: none;
}

.event-dot {
  width: 8px;
  height: 8px;
  border-radius: 50%;
  flex-shrink: 0;
}

.event-dot-accent {
  background: var(--accent);
  box-shadow: 0 0 8px var(--accent);
}

.event-dot-gold {
  background: var(--gold);
  box-shadow: 0 0 8px var(--gold);
}

.event-dot-danger {
  background: var(--danger);
  box-shadow: 0 0 8px var(--danger);
}

.event-text {
  flex: 1;
  color: var(--text-primary);
  font-size: 14px;
}

.event-time {
  font-size: 12px;
  color: var(--text-secondary);
}
</style>
```

- [ ] **Step 3: Full typecheck**

Run: `npx tsc --noEmit -p tsconfig.main.json && npx vue-tsc --noEmit -p tsconfig.json`
Expected: no errors from either command

- [ ] **Step 4: Full test suite**

Run: `npx vitest run`
Expected: PASS (27 tests)

- [ ] **Step 5: Full build**

Run: `npm run build`
Expected: builds successfully, no errors

- [ ] **Step 6: Commit**

```bash
git add src/renderer/views/HistoryView.vue src/renderer/views/ServerStatusView.vue
git commit -m "Remove Challenge courant display from history and dashboard views"
```

---

### Task 8: Manual end-to-end verification

**Files:** none (verification only)

- [ ] **Step 1: Launch the app**

Run: `npm run build && env -u ELECTRON_RUN_AS_NODE npx electron dist/main/main.js` (unset `ELECTRON_RUN_AS_NODE` first if set in the shell)

- [ ] **Step 2: Verify the Admin quest panel has no ID field**

Navigate to Admin. Confirm the "Quêtes environnementales" creation form has only a name input (no numeric ID field). Add a quest named exactly "Solo : Crocodailles de la Banquise" (or any name currently visible in the History tab's quest events, if the game is running and one is available). Confirm it appears in the list without any "#" id prefix shown.

- [ ] **Step 3: Verify quest-encounter detection uses the real quest name**

Follow the quest just created (this requires the Exploits/quest-follow UI — if a standalone follow button doesn't exist outside of exploits in the current UI, skip to Step 4 and verify via an Exploit instead, noting this in the report). Trigger or wait for a `quest-completed`/`quest-failed` log line with a matching name (real gameplay, or by appending a matching line to a copy of the log file). Confirm the toast "Quête environnementale rencontrée" appears with the exact quest name, not a "Challenge #" placeholder.

- [ ] **Step 4: Verify History and Dashboard no longer show "Challenge actif"**

Navigate to Historique and Serveur (dashboard). Confirm no entry anywhere reads "Challenge actif : #..." or "Aucun challenge actif" — only Serveur/Quête/Haut fait entries should appear.

- [ ] **Step 5: Verify the old placeholder quest data was wiped**

If the dev machine's store still had the 13 "Challenge #XXXX" entries from before this change, confirm they're gone from the Admin quest list after this build's first launch (already covered in Task 3 Step 4, but re-confirm here in the full running app UI).

- [ ] **Step 6: Report results**

Summarize what was verified and any discrepancies found. Do not claim success without having actually run the app and performed these steps.

---

## Self-Review Notes

- **Spec coverage:** parser/type removal (Task 1), store model change to generated-id quests + string-typed follow/exploit ids (Task 2), IPC + main-process wipe migration (Task 3), preload bridge (Task 4), renderer stores (Task 5), Admin/Exploits UI (Task 6), History/Dashboard display cleanup (Task 7), manual verification (Task 8). Every spec section ("Décision", "Changements de modèle", "Écrans impactés", "Migration des données existantes", "Tests") has a corresponding task.
- **Placeholder scan:** no TBD/TODO markers; every step has complete, runnable code or an exact shell command.
- **Type consistency:** `EnvironmentalQuest { id: string; name: string }` is consistent across `store.ts` (Task 2), `ipc.ts`/`preload.ts` (Tasks 3–4), `admin.ts`/`appState.ts` (Task 5), and `AdminView.vue`/`ExploitsView.vue` (Task 6). `followedQuestIds: string[]` and `Exploit.questIds: string[]` match everywhere they're read or written. `WakfuEvent` without `environmental-quest` (Task 1) is consumed identically by `HistoryView.vue` and `ServerStatusView.vue` (Task 7) — both switch statements list exactly the four remaining variants (`server-connection`, `quest-completed`, `quest-failed`, `achievement`), matching `parsers/types.ts`.
- **Known transient typecheck failures:** Tasks 1, 3 (preload only), 5, and 6 each note that `tsc`/`vue-tsc` will still fail on files not yet updated in that task — this is intentional, one-concern-per-task sequencing. Task 7 Step 3 is the first point a fully clean double typecheck is expected.
