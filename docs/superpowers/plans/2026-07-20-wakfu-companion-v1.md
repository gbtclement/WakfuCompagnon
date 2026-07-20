# Wakfu Companion V1 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a Windows desktop app (Electron + Vue 3 + TS) that tails the local `wakfu.log` file, parses server-connection / environmental-quest / achievement events with pure testable parsers, tracks followed quests and manual boss timers, and fires native Windows notifications — packaged as an NSIS installer.

**Architecture:** Three-process Electron app. Main process owns `logWatcher` (incremental tail with rotation handling), a set of pure-function parsers (one per event type), `electron-store`-backed persistence, and `Notification`-based alerts. Preload exposes a narrow typed `contextBridge` API. Renderer is a Vue 3 + Pinia SPA that only talks to main via IPC — no direct filesystem access from the renderer.

**Tech Stack:** Electron, TypeScript, Vue 3, Vue Router, Pinia, Vite, `electron-store`, `electron-builder` (NSIS target), Vitest.

## Global Constraints

- No `nodeIntegration` in the renderer; all main-process access goes through `contextBridge` in preload (spec: Flux de données, point 4).
- Parsers are pure functions `parse(line: string): Event | null`, independently testable without Electron running (spec: Architecture, Flux de données point 2; Points d'attention).
- Unrecognized log lines are silently ignored (debug-log only, no thrown error) — the game's log format can change at any time (spec: Gestion d'erreurs).
- No player-identifying data is stored or transmitted (spec: Points d'attention).
- Log path auto-detection tries the Zaap path first, then Steam path, then falls back to manual selection via native dialog (spec: Gestion d'erreurs).
- Regex patterns are calibrated against real log lines captured from the user's actual `wakfu.log` (see fixtures in Task 2) — not invented from the generic examples in the original prompt.
- `dispatcher` proxy connections must be filtered out of server-detection events (spec: Formats de logs — Connexion serveur).
- Persistence via `electron-store` (JSON), not SQLite (spec: Stack technique retenue).
- Tail implementation uses `fs` incremental offset reads, not `chokidar` (spec: Stack technique retenue).

---

## File Structure

```
/src
  /main
    logWatcher.ts
    parsers/
      types.ts
      serverConnection.ts
      environmentalQuest.ts
      questCompleted.ts
      achievement.ts
    data/
      environmentalQuests.json
    store.ts
    notifications.ts
    timers.ts
    ipc.ts
    logPathDetection.ts
    main.ts
  /preload
    preload.ts
  /renderer
    App.vue
    main.ts
    router.ts
    /stores
      appState.ts
    /views
      ServerStatusView.vue
      QuestsView.vue
      TimersView.vue
      HistoryView.vue
      SettingsView.vue
    /components
      NavBar.vue
/tests
  /parsers
    fixtures.ts
    serverConnection.test.ts
    environmentalQuest.test.ts
    questCompleted.test.ts
    achievement.test.ts
  /main
    logPathDetection.test.ts
    logWatcher.test.ts
    timers.test.ts
/electron-builder.yml
/package.json
/vite.config.ts
/tsconfig.json
```

---

### Task 1: Project scaffolding

**Files:**
- Create: `package.json`, `tsconfig.json`, `tsconfig.node.json`, `vite.config.ts`, `.gitignore`
- Create: `src/main/main.ts` (stub), `src/preload/preload.ts` (stub), `src/renderer/main.ts`, `src/renderer/App.vue`, `src/renderer/index.html`
- Create: `electron-builder.yml`

**Interfaces:**
- Produces: an `npm run dev` script that launches Vite for the renderer and an `npm run build` script; a working empty Electron window on `npm run dev`.

- [ ] **Step 1: Init npm project and install dependencies**

```bash
cd /c/Users/Utilisateur/Desktop/wakfu-companion
npm init -y
npm install -D electron electron-builder vite typescript vue-tsc @vitejs/plugin-vue vitest
npm install vue vue-router pinia electron-store
```

- [ ] **Step 2: Write `.gitignore`**

```
node_modules/
dist/
dist-electron/
release/
*.log
.DS_Store
```

- [ ] **Step 3: Write `tsconfig.json`**

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "ESNext",
    "moduleResolution": "Bundler",
    "strict": true,
    "esModuleInterop": true,
    "skipLibCheck": true,
    "forceConsistentCasingInFileNames": true,
    "resolveJsonModule": true,
    "jsx": "preserve",
    "lib": ["ES2022", "DOM"],
    "types": ["vite/client", "node"]
  },
  "include": ["src"]
}
```

- [ ] **Step 4: Write `vite.config.ts`** (renderer-only Vite config; main/preload built separately via `tsc` in Task 8 packaging)

```ts
import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'
import { resolve } from 'path'

export default defineConfig({
  root: 'src/renderer',
  plugins: [vue()],
  build: {
    outDir: '../../dist/renderer',
    emptyOutDir: true
  },
  resolve: {
    alias: {
      '@': resolve(__dirname, 'src/renderer')
    }
  }
})
```

- [ ] **Step 5: Write `src/renderer/index.html`**

```html
<!DOCTYPE html>
<html lang="fr">
  <head>
    <meta charset="UTF-8" />
    <title>Wakfu Companion</title>
  </head>
  <body>
    <div id="app"></div>
    <script type="module" src="/main.ts"></script>
  </body>
</html>
```

- [ ] **Step 6: Write `src/renderer/App.vue`**

```vue
<template>
  <div>Wakfu Companion</div>
</template>
```

- [ ] **Step 7: Write `src/renderer/main.ts`**

```ts
import { createApp } from 'vue'
import App from './App.vue'

createApp(App).mount('#app')
```

- [ ] **Step 8: Write `src/main/main.ts` (stub main process)**

```ts
import { app, BrowserWindow } from 'electron'
import { join } from 'path'

function createWindow(): void {
  const win = new BrowserWindow({
    width: 1000,
    height: 700,
    webPreferences: {
      preload: join(__dirname, '../preload/preload.js'),
      contextIsolation: true,
      nodeIntegration: false
    }
  })

  if (process.env.VITE_DEV_SERVER_URL) {
    win.loadURL(process.env.VITE_DEV_SERVER_URL)
  } else {
    win.loadFile(join(__dirname, '../renderer/index.html'))
  }
}

app.whenReady().then(createWindow)

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit()
})
```

- [ ] **Step 9: Write `src/preload/preload.ts` (stub)**

```ts
import { contextBridge } from 'electron'

contextBridge.exposeInMainWorld('wakfuApi', {})
```

- [ ] **Step 10: Write `electron-builder.yml`**

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

- [ ] **Step 11: Add npm scripts to `package.json`**

Edit `package.json` to add:

```json
{
  "type": "commonjs",
  "main": "dist/main/main.js",
  "scripts": {
    "dev:renderer": "vite",
    "build:renderer": "vite build",
    "build:main": "tsc -p tsconfig.main.json",
    "build": "npm run build:renderer && npm run build:main",
    "test": "vitest run",
    "package": "npm run build && electron-builder"
  }
}
```

- [ ] **Step 12: Write `tsconfig.main.json`** (separate CommonJS build for main/preload, since renderer uses Vite/ESM)

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "CommonJS",
    "moduleResolution": "Node",
    "outDir": "dist",
    "rootDir": "src",
    "strict": true,
    "esModuleInterop": true,
    "skipLibCheck": true,
    "resolveJsonModule": true,
    "types": ["node"]
  },
  "include": ["src/main", "src/preload"]
}
```

- [ ] **Step 13: Verify the app builds and launches**

Run: `npm run build && npx electron dist/main/main.js`
Expected: a window titled "Wakfu Companion" opens showing the text "Wakfu Companion". Close the window to exit.

- [ ] **Step 14: Commit**

```bash
git add -A
git commit -m "Scaffold Electron + Vue + Vite project skeleton"
```

---

### Task 2: Parser types and fixtures

**Files:**
- Create: `src/main/parsers/types.ts`
- Create: `tests/parsers/fixtures.ts`

**Interfaces:**
- Produces: `WakfuEvent` discriminated union type, consumed by every parser task (3-6) and by `logWatcher.ts` (Task 7).

- [ ] **Step 1: Write `src/main/parsers/types.ts`**

```ts
export type WakfuEvent =
  | { type: 'server-connection'; server: string; timestamp: string }
  | { type: 'environmental-quest'; challengeId: number; timestamp: string }
  | { type: 'quest-completed'; questName: string; timestamp: string }
  | { type: 'quest-failed'; questName: string; timestamp: string }
  | { type: 'achievement'; achievementId: number; timestamp: string }

export type LineParser = (line: string) => WakfuEvent | null
```

- [ ] **Step 2: Write `tests/parsers/fixtures.ts`** with real captured log lines

```ts
export const SERVER_CONNECTION_LINES = {
  dispatcher: ' INFO 18:26:45,738 [AWT-EventQueue-0] (aVj:62) - Connexion au proxy :wakfu-dispatcher.ankama-games.com:5558 / ssl : true',
  ogrest: ' INFO 18:26:49,060 [AWT-EventQueue-0] (aVj:62) - Connexion au proxy :wakfu-ogrest.ankama-games.com:5556 / ssl : true'
}

export const ENVIRONMENTAL_QUEST_LINES = {
  active1123: ' INFO 20:05:41,377 [AWT-EventQueue-0] (chJ:254) - Challenge courant : -1123 (dans 0s)',
  active1134: ' INFO 20:05:46,312 [AWT-EventQueue-0] (chJ:254) - Challenge courant : -1134 (dans 0s)',
  none: ' INFO 20:07:15,962 [AWT-EventQueue-0] (chJ:254) - Challenge courant : -1 (dans 0s)'
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

- [ ] **Step 2b: Run typecheck**

Run: `npx tsc --noEmit -p tsconfig.main.json`
Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add src/main/parsers/types.ts tests/parsers/fixtures.ts
git commit -m "Add parser event types and real-log test fixtures"
```

---

### Task 3: Server connection parser

**Files:**
- Create: `src/main/parsers/serverConnection.ts`
- Test: `tests/parsers/serverConnection.test.ts`

**Interfaces:**
- Consumes: `WakfuEvent`, `LineParser` from `src/main/parsers/types.ts`.
- Produces: `parseServerConnection: LineParser`, consumed by `logWatcher.ts` (Task 7).

- [ ] **Step 1: Write the failing test**

```ts
// tests/parsers/serverConnection.test.ts
import { describe, it, expect } from 'vitest'
import { parseServerConnection } from '../../src/main/parsers/serverConnection'
import { SERVER_CONNECTION_LINES, UNRELATED_LINES } from './fixtures'

describe('parseServerConnection', () => {
  it('extracts the server name from a proxy connection line', () => {
    const event = parseServerConnection(SERVER_CONNECTION_LINES.ogrest)
    expect(event).toEqual({ type: 'server-connection', server: 'ogrest', timestamp: '18:26:49,060' })
  })

  it('ignores the dispatcher lobby proxy', () => {
    expect(parseServerConnection(SERVER_CONNECTION_LINES.dispatcher)).toBeNull()
  })

  it('returns null for unrelated lines', () => {
    for (const line of UNRELATED_LINES) {
      expect(parseServerConnection(line)).toBeNull()
    }
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/parsers/serverConnection.test.ts`
Expected: FAIL — cannot find module `../../src/main/parsers/serverConnection`

- [ ] **Step 3: Write minimal implementation**

```ts
// src/main/parsers/serverConnection.ts
import { LineParser } from './types'

const PATTERN = /^\s*INFO\s+(\d{2}:\d{2}:\d{2},\d{3}).*Connexion au proxy\s*:wakfu-([a-z0-9-]+)\.ankama-games\.com/

export const parseServerConnection: LineParser = (line) => {
  const match = PATTERN.exec(line)
  if (!match) return null

  const [, timestamp, server] = match
  if (server === 'dispatcher') return null

  return { type: 'server-connection', server, timestamp }
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run tests/parsers/serverConnection.test.ts`
Expected: PASS (3 tests)

- [ ] **Step 5: Commit**

```bash
git add src/main/parsers/serverConnection.ts tests/parsers/serverConnection.test.ts
git commit -m "Add server connection parser"
```

---

### Task 4: Environmental quest (challenge) parser

**Files:**
- Create: `src/main/parsers/environmentalQuest.ts`
- Test: `tests/parsers/environmentalQuest.test.ts`

**Interfaces:**
- Consumes: `WakfuEvent`, `LineParser` from `types.ts`.
- Produces: `parseEnvironmentalQuest: LineParser`, consumed by `logWatcher.ts` (Task 7). Note: the caller in `logWatcher.ts` is responsible for de-duplicating repeated identical challenge IDs (this parser emits an event for every matching line, including `-1`; state-diffing happens in Task 7).

- [ ] **Step 1: Write the failing test**

```ts
// tests/parsers/environmentalQuest.test.ts
import { describe, it, expect } from 'vitest'
import { parseEnvironmentalQuest } from '../../src/main/parsers/environmentalQuest'
import { ENVIRONMENTAL_QUEST_LINES, UNRELATED_LINES } from './fixtures'

describe('parseEnvironmentalQuest', () => {
  it('extracts a negative challenge id', () => {
    const event = parseEnvironmentalQuest(ENVIRONMENTAL_QUEST_LINES.active1123)
    expect(event).toEqual({ type: 'environmental-quest', challengeId: -1123, timestamp: '20:05:41,377' })
  })

  it('extracts the "no challenge" id of -1', () => {
    const event = parseEnvironmentalQuest(ENVIRONMENTAL_QUEST_LINES.none)
    expect(event).toEqual({ type: 'environmental-quest', challengeId: -1, timestamp: '20:07:15,962' })
  })

  it('returns null for unrelated lines', () => {
    for (const line of UNRELATED_LINES) {
      expect(parseEnvironmentalQuest(line)).toBeNull()
    }
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/parsers/environmentalQuest.test.ts`
Expected: FAIL — cannot find module `../../src/main/parsers/environmentalQuest`

- [ ] **Step 3: Write minimal implementation**

```ts
// src/main/parsers/environmentalQuest.ts
import { LineParser } from './types'

const PATTERN = /^\s*INFO\s+(\d{2}:\d{2}:\d{2},\d{3}).*Challenge courant\s*:\s*(-?\d+)/

export const parseEnvironmentalQuest: LineParser = (line) => {
  const match = PATTERN.exec(line)
  if (!match) return null

  const [, timestamp, idStr] = match
  return { type: 'environmental-quest', challengeId: Number(idStr), timestamp }
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run tests/parsers/environmentalQuest.test.ts`
Expected: PASS (3 tests)

- [ ] **Step 5: Commit**

```bash
git add src/main/parsers/environmentalQuest.ts tests/parsers/environmentalQuest.test.ts
git commit -m "Add environmental quest (challenge) parser"
```

---

### Task 5: Quest completed/failed parser

**Files:**
- Create: `src/main/parsers/questCompleted.ts`
- Test: `tests/parsers/questCompleted.test.ts`

**Interfaces:**
- Consumes: `WakfuEvent`, `LineParser` from `types.ts`.
- Produces: `parseQuestCompleted: LineParser`, consumed by `logWatcher.ts` (Task 7).

- [ ] **Step 1: Write the failing test**

```ts
// tests/parsers/questCompleted.test.ts
import { describe, it, expect } from 'vitest'
import { parseQuestCompleted } from '../../src/main/parsers/questCompleted'
import { QUEST_COMPLETED_LINES, UNRELATED_LINES } from './fixtures'

describe('parseQuestCompleted', () => {
  it('extracts the quest name on a win', () => {
    const event = parseQuestCompleted(QUEST_COMPLETED_LINES.won)
    expect(event).toEqual({
      type: 'quest-completed',
      questName: 'Course : Salbatroce Voyageur',
      timestamp: '18:22:57,585'
    })
  })

  it('extracts the quest name on a failure', () => {
    const event = parseQuestCompleted(QUEST_COMPLETED_LINES.failed)
    expect(event).toEqual({
      type: 'quest-failed',
      questName: 'Collaboratif : Hordes de Vandaliénés',
      timestamp: '20:05:36,472'
    })
  })

  it('returns null for unrelated lines', () => {
    for (const line of UNRELATED_LINES) {
      expect(parseQuestCompleted(line)).toBeNull()
    }
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/parsers/questCompleted.test.ts`
Expected: FAIL — cannot find module `../../src/main/parsers/questCompleted`

- [ ] **Step 3: Write minimal implementation**

```ts
// src/main/parsers/questCompleted.ts
import { LineParser } from './types'

const WON_PATTERN = /^\s*INFO\s+(\d{2}:\d{2}:\d{2},\d{3}).*Vous venez de remporter la quête\s*"([^"]+)"/
const FAILED_PATTERN = /^\s*INFO\s+(\d{2}:\d{2}:\d{2},\d{3}).*Quête échouée\s*:\s*"([^"]+)"/

export const parseQuestCompleted: LineParser = (line) => {
  const won = WON_PATTERN.exec(line)
  if (won) {
    const [, timestamp, questName] = won
    return { type: 'quest-completed', questName, timestamp }
  }

  const failed = FAILED_PATTERN.exec(line)
  if (failed) {
    const [, timestamp, questName] = failed
    return { type: 'quest-failed', questName, timestamp }
  }

  return null
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run tests/parsers/questCompleted.test.ts`
Expected: PASS (3 tests)

- [ ] **Step 5: Commit**

```bash
git add src/main/parsers/questCompleted.ts tests/parsers/questCompleted.test.ts
git commit -m "Add quest completed/failed parser"
```

---

### Task 6: Achievement parser

**Files:**
- Create: `src/main/parsers/achievement.ts`
- Test: `tests/parsers/achievement.test.ts`

**Interfaces:**
- Consumes: `WakfuEvent`, `LineParser` from `types.ts`.
- Produces: `parseAchievement: LineParser`, consumed by `logWatcher.ts` (Task 7).

- [ ] **Step 1: Write the failing test**

```ts
// tests/parsers/achievement.test.ts
import { describe, it, expect } from 'vitest'
import { parseAchievement } from '../../src/main/parsers/achievement'
import { ACHIEVEMENT_LINES, UNRELATED_LINES } from './fixtures'

describe('parseAchievement', () => {
  it('extracts the id from "Achievement activated"', () => {
    const event = parseAchievement(ACHIEVEMENT_LINES.activated)
    expect(event).toEqual({ type: 'achievement', achievementId: 4267, timestamp: '16:29:51,226' })
  })

  it('extracts the id from "Achievement objective completed"', () => {
    const event = parseAchievement(ACHIEVEMENT_LINES.objectiveCompleted)
    expect(event).toEqual({ type: 'achievement', achievementId: 9388, timestamp: '21:03:16,003' })
  })

  it('returns null for unrelated lines', () => {
    for (const line of UNRELATED_LINES) {
      expect(parseAchievement(line)).toBeNull()
    }
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/parsers/achievement.test.ts`
Expected: FAIL — cannot find module `../../src/main/parsers/achievement`

- [ ] **Step 3: Write minimal implementation**

```ts
// src/main/parsers/achievement.ts
import { LineParser } from './types'

const PATTERN = /^\s*INFO\s+(\d{2}:\d{2}:\d{2},\d{3}).*Achievement (?:activated|objective completed)\s*:\s*(\d+)/

export const parseAchievement: LineParser = (line) => {
  const match = PATTERN.exec(line)
  if (!match) return null

  const [, timestamp, idStr] = match
  return { type: 'achievement', achievementId: Number(idStr), timestamp }
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run tests/parsers/achievement.test.ts`
Expected: PASS (3 tests)

- [ ] **Step 5: Commit**

```bash
git add src/main/parsers/achievement.ts tests/parsers/achievement.test.ts
git commit -m "Add achievement parser"
```

---

### Task 7: Log path detection

**Files:**
- Create: `src/main/logPathDetection.ts`
- Test: `tests/main/logPathDetection.test.ts`

**Interfaces:**
- Produces: `detectDefaultLogPath(fileExists: (path: string) => boolean): string | null`, consumed by `logWatcher.ts` (Task 8) and `SettingsView.vue` (Task 12) via IPC. Takes an injectable existence-check function so the test doesn't touch the real filesystem.

- [ ] **Step 1: Write the failing test**

```ts
// tests/main/logPathDetection.test.ts
import { describe, it, expect } from 'vitest'
import { detectDefaultLogPath, ZAAP_LOG_PATH, STEAM_LOG_PATH } from '../../src/main/logPathDetection'

describe('detectDefaultLogPath', () => {
  it('returns the Zaap path when it exists', () => {
    const exists = (p: string) => p === ZAAP_LOG_PATH
    expect(detectDefaultLogPath(exists)).toBe(ZAAP_LOG_PATH)
  })

  it('falls back to the Steam path when Zaap path is missing', () => {
    const exists = (p: string) => p === STEAM_LOG_PATH
    expect(detectDefaultLogPath(exists)).toBe(STEAM_LOG_PATH)
  })

  it('returns null when neither path exists', () => {
    expect(detectDefaultLogPath(() => false)).toBeNull()
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/main/logPathDetection.test.ts`
Expected: FAIL — cannot find module `../../src/main/logPathDetection`

- [ ] **Step 3: Write minimal implementation**

```ts
// src/main/logPathDetection.ts
import { join } from 'path'

export const ZAAP_LOG_PATH = join(
  process.env.APPDATA ?? '',
  'zaap', 'gamesLogs', 'wakfu', 'logs', 'wakfu.log'
)

export const STEAM_LOG_PATH =
  'C:\\Program Files (x86)\\Steam\\steamapps\\common\\Wakfu\\logs\\wakfu.log'

export function detectDefaultLogPath(fileExists: (path: string) => boolean): string | null {
  if (fileExists(ZAAP_LOG_PATH)) return ZAAP_LOG_PATH
  if (fileExists(STEAM_LOG_PATH)) return STEAM_LOG_PATH
  return null
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run tests/main/logPathDetection.test.ts`
Expected: PASS (3 tests)

- [ ] **Step 5: Commit**

```bash
git add src/main/logPathDetection.ts tests/main/logPathDetection.test.ts
git commit -m "Add default log path detection with Zaap/Steam fallback"
```

---

### Task 8: Log watcher (incremental tail with rotation handling)

**Files:**
- Create: `src/main/logWatcher.ts`
- Test: `tests/main/logWatcher.test.ts`

**Interfaces:**
- Consumes: `WakfuEvent`, `LineParser` from `parsers/types.ts`; the four parser functions from Tasks 3-6.
- Produces: `class LogWatcher` with `start(): void`, `stop(): void`, and an `on(event: 'wakfu-event', cb: (e: WakfuEvent) => void)` emitter method (extends Node's `EventEmitter`). Consumed by `ipc.ts` (Task 10) and `main.ts` (Task 11).

**Design notes:** Uses real filesystem + `fs.watchFile` against a temp file created and appended to in-test — no mocking of `fs`, since the spec calls for robustness against real rotation behavior. Tracks a byte offset; on each poll, reads only new bytes since the last offset, splits on `\n`. On rotation (file size shrinks below last known offset, i.e. truncation/replacement), resets offset to 0 and re-reads from the start of the new file.

- [ ] **Step 1: Write the failing test**

```ts
// tests/main/logWatcher.test.ts
import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { writeFileSync, appendFileSync, mkdtempSync, rmSync } from 'fs'
import { join } from 'path'
import { tmpdir } from 'os'
import { LogWatcher } from '../../src/main/logWatcher'
import { WakfuEvent } from '../../src/main/parsers/types'
import { ACHIEVEMENT_LINES, SERVER_CONNECTION_LINES } from '../parsers/fixtures'

describe('LogWatcher', () => {
  let dir: string
  let logPath: string
  let watcher: LogWatcher

  beforeEach(() => {
    dir = mkdtempSync(join(tmpdir(), 'wakfu-log-test-'))
    logPath = join(dir, 'wakfu.log')
    writeFileSync(logPath, '')
  })

  afterEach(() => {
    watcher?.stop()
    rmSync(dir, { recursive: true, force: true })
  })

  it('emits a parsed event for each new appended line', async () => {
    watcher = new LogWatcher(logPath, { pollIntervalMs: 50 })
    const received: WakfuEvent[] = []
    watcher.on('wakfu-event', (e) => received.push(e))
    watcher.start()

    appendFileSync(logPath, ACHIEVEMENT_LINES.activated + '\n')

    await new Promise((resolve) => setTimeout(resolve, 200))

    expect(received).toEqual([{ type: 'achievement', achievementId: 4267, timestamp: '16:29:51,226' }])
  })

  it('resumes from the new content after file truncation (rotation)', async () => {
    appendFileSync(logPath, SERVER_CONNECTION_LINES.dispatcher + '\n')
    watcher = new LogWatcher(logPath, { pollIntervalMs: 50 })
    const received: WakfuEvent[] = []
    watcher.on('wakfu-event', (e) => received.push(e))
    watcher.start()

    await new Promise((resolve) => setTimeout(resolve, 150))

    writeFileSync(logPath, ACHIEVEMENT_LINES.activated + '\n')

    await new Promise((resolve) => setTimeout(resolve, 200))

    expect(received).toEqual([{ type: 'achievement', achievementId: 4267, timestamp: '16:29:51,226' }])
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/main/logWatcher.test.ts`
Expected: FAIL — cannot find module `../../src/main/logWatcher`

- [ ] **Step 3: Write minimal implementation**

```ts
// src/main/logWatcher.ts
import { EventEmitter } from 'events'
import { openSync, closeSync, readSync, statSync, existsSync } from 'fs'
import { LineParser, WakfuEvent } from './parsers/types'
import { parseServerConnection } from './parsers/serverConnection'
import { parseEnvironmentalQuest } from './parsers/environmentalQuest'
import { parseQuestCompleted } from './parsers/questCompleted'
import { parseAchievement } from './parsers/achievement'

const PARSERS: LineParser[] = [
  parseServerConnection,
  parseEnvironmentalQuest,
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

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run tests/main/logWatcher.test.ts`
Expected: PASS (2 tests)

- [ ] **Step 5: Commit**

```bash
git add src/main/logWatcher.ts tests/main/logWatcher.test.ts
git commit -m "Add incremental log watcher with rotation handling"
```

---

### Task 9: Environmental quest reference data + store

**Files:**
- Create: `src/main/data/environmentalQuests.json`
- Create: `src/main/store.ts`
- Test: `tests/main/store.test.ts`

**Interfaces:**
- Produces: `interface AppConfig { logPath: string | null; followedQuestIds: number[]; timers: TimerRecord[]; history: WakfuEvent[] }`, `interface TimerRecord { id: string; name: string; endsAt: number }`, `class AppStore` wrapping `electron-store` with typed getters/setters: `getConfig(): AppConfig`, `setLogPath(path: string): void`, `addFollowedQuest(id: number): void`, `removeFollowedQuest(id: number): void`, `addTimer(timer: TimerRecord): void`, `removeTimer(id: string): void`, `appendHistoryEvent(event: WakfuEvent): void`. Consumed by `ipc.ts` (Task 10), `timers.ts` (Task 13), `notifications.ts` (Task 10).
- Consumes: `WakfuEvent` from `parsers/types.ts`.

- [ ] **Step 1: Write `src/main/data/environmentalQuests.json`** (seeded with real IDs observed in the user's logs, plus placeholder names)

```json
{
  "-1123": "Challenge #1123",
  "-1134": "Challenge #1134",
  "-1863": "Challenge #1863",
  "-1622": "Challenge #1622",
  "-1621": "Challenge #1621",
  "-1802": "Challenge #1802",
  "-1841": "Challenge #1841",
  "-1765": "Challenge #1765",
  "-1620": "Challenge #1620",
  "-1826": "Challenge #1826",
  "-1843": "Challenge #1843",
  "-1825": "Challenge #1825",
  "-1619": "Challenge #1619"
}
```

- [ ] **Step 2: Write the failing test**

```ts
// tests/main/store.test.ts
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
      history: []
    })
  })

  it('persists a log path', () => {
    store.setLogPath('C:\\fake\\wakfu.log')
    expect(store.getConfig().logPath).toBe('C:\\fake\\wakfu.log')
  })

  it('adds and removes a followed quest id without duplicates', () => {
    store.addFollowedQuest(-1123)
    store.addFollowedQuest(-1123)
    expect(store.getConfig().followedQuestIds).toEqual([-1123])
    store.removeFollowedQuest(-1123)
    expect(store.getConfig().followedQuestIds).toEqual([])
  })

  it('adds and removes a timer', () => {
    store.addTimer({ id: 't1', name: 'Boss X', endsAt: 123456 })
    expect(store.getConfig().timers).toEqual([{ id: 't1', name: 'Boss X', endsAt: 123456 }])
    store.removeTimer('t1')
    expect(store.getConfig().timers).toEqual([])
  })

  it('appends events to history', () => {
    const event = { type: 'achievement' as const, achievementId: 1, timestamp: '00:00:00,000' }
    store.appendHistoryEvent(event)
    expect(store.getConfig().history).toEqual([event])
  })
})
```

- [ ] **Step 3: Run test to verify it fails**

Run: `npx vitest run tests/main/store.test.ts`
Expected: FAIL — cannot find module `../../src/main/store`

- [ ] **Step 4: Write minimal implementation**

```ts
// src/main/store.ts
import Store from 'electron-store'
import { WakfuEvent } from './parsers/types'

export interface TimerRecord {
  id: string
  name: string
  endsAt: number
}

export interface AppConfig {
  logPath: string | null
  followedQuestIds: number[]
  timers: TimerRecord[]
  history: WakfuEvent[]
}

const DEFAULTS: AppConfig = {
  logPath: null,
  followedQuestIds: [],
  timers: [],
  history: []
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
      history: this.store.get('history')
    }
  }

  setLogPath(path: string): void {
    this.store.set('logPath', path)
  }

  addFollowedQuest(id: number): void {
    const ids = this.store.get('followedQuestIds')
    if (!ids.includes(id)) {
      this.store.set('followedQuestIds', [...ids, id])
    }
  }

  removeFollowedQuest(id: number): void {
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
}
```

- [ ] **Step 5: Run test to verify it passes**

Run: `npx vitest run tests/main/store.test.ts`
Expected: PASS (5 tests)

- [ ] **Step 6: Commit**

```bash
git add src/main/data/environmentalQuests.json src/main/store.ts tests/main/store.test.ts
git commit -m "Add environmental quest reference data and persistent app store"
```

---

### Task 10: Boss timers logic

**Files:**
- Create: `src/main/timers.ts`
- Test: `tests/main/timers.test.ts`

**Interfaces:**
- Consumes: `AppStore`, `TimerRecord` from `store.ts`.
- Produces: `class TimerManager` with `constructor(store: AppStore, onExpire: (timer: TimerRecord) => void)`, `createTimer(name: string, durationMs: number): TimerRecord`, `cancelTimer(id: string): void`, `start(): void` (re-arms timers from persisted store on startup, e.g. after app restart), `stop(): void`. Consumed by `ipc.ts` (Task 11) and `main.ts` (Task 12).

- [ ] **Step 1: Write the failing test**

```ts
// tests/main/timers.test.ts
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { mkdtempSync, rmSync } from 'fs'
import { join } from 'path'
import { tmpdir } from 'os'
import { AppStore, TimerRecord } from '../../src/main/store'
import { TimerManager } from '../../src/main/timers'

describe('TimerManager', () => {
  let cwd: string
  let store: AppStore

  beforeEach(() => {
    vi.useFakeTimers()
    cwd = mkdtempSync(join(tmpdir(), 'wakfu-timers-test-'))
    store = new AppStore(cwd)
  })

  afterEach(() => {
    vi.useRealTimers()
    rmSync(cwd, { recursive: true, force: true })
  })

  it('creates a timer, persists it, and fires onExpire after the duration', () => {
    const expired: TimerRecord[] = []
    const manager = new TimerManager(store, (t) => expired.push(t))
    manager.start()

    const timer = manager.createTimer('Boss X', 5000)
    expect(store.getConfig().timers.map((t) => t.id)).toContain(timer.id)

    vi.advanceTimersByTime(5000)

    expect(expired).toEqual([timer])
    expect(store.getConfig().timers).toEqual([])
  })

  it('cancels a timer before it fires', () => {
    const expired: TimerRecord[] = []
    const manager = new TimerManager(store, (t) => expired.push(t))
    manager.start()

    const timer = manager.createTimer('Boss Y', 5000)
    manager.cancelTimer(timer.id)

    vi.advanceTimersByTime(5000)

    expect(expired).toEqual([])
    expect(store.getConfig().timers).toEqual([])
  })

  it('re-arms a persisted future timer on start()', () => {
    store.addTimer({ id: 'persisted-1', name: 'Boss Z', endsAt: Date.now() + 3000 })
    const expired: TimerRecord[] = []
    const manager = new TimerManager(store, (t) => expired.push(t))
    manager.start()

    vi.advanceTimersByTime(3000)

    expect(expired.map((t) => t.id)).toEqual(['persisted-1'])
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/main/timers.test.ts`
Expected: FAIL — cannot find module `../../src/main/timers`

- [ ] **Step 3: Write minimal implementation**

```ts
// src/main/timers.ts
import { randomUUID } from 'crypto'
import { AppStore, TimerRecord } from './store'

export class TimerManager {
  private handles = new Map<string, NodeJS.Timeout>()

  constructor(
    private readonly store: AppStore,
    private readonly onExpire: (timer: TimerRecord) => void
  ) {}

  start(): void {
    for (const timer of this.store.getConfig().timers) {
      this.arm(timer)
    }
  }

  stop(): void {
    for (const handle of this.handles.values()) clearTimeout(handle)
    this.handles.clear()
  }

  createTimer(name: string, durationMs: number): TimerRecord {
    const timer: TimerRecord = { id: randomUUID(), name, endsAt: Date.now() + durationMs }
    this.store.addTimer(timer)
    this.arm(timer)
    return timer
  }

  cancelTimer(id: string): void {
    const handle = this.handles.get(id)
    if (handle) clearTimeout(handle)
    this.handles.delete(id)
    this.store.removeTimer(id)
  }

  private arm(timer: TimerRecord): void {
    const delay = Math.max(0, timer.endsAt - Date.now())
    const handle = setTimeout(() => {
      this.handles.delete(timer.id)
      this.store.removeTimer(timer.id)
      this.onExpire(timer)
    }, delay)
    this.handles.set(timer.id, handle)
  }
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run tests/main/timers.test.ts`
Expected: PASS (3 tests)

- [ ] **Step 5: Commit**

```bash
git add src/main/timers.ts tests/main/timers.test.ts
git commit -m "Add boss timer manager with persistence-backed re-arming"
```

---

### Task 11: Notifications wrapper

**Files:**
- Create: `src/main/notifications.ts`

**Interfaces:**
- Produces: `function notify(title: string, body: string): void`, consumed by `ipc.ts` (Task 12) when a followed quest is encountered or a timer expires.

**Note:** No automated test here — this is a thin wrapper around Electron's `Notification` API, which requires a running Electron app context to instantiate and cannot be meaningfully unit-tested outside it. Verified manually in Task 14.

- [ ] **Step 1: Write `src/main/notifications.ts`**

```ts
import { Notification } from 'electron'

export function notify(title: string, body: string): void {
  if (!Notification.isSupported()) return
  new Notification({ title, body }).show()
}
```

- [ ] **Step 2: Typecheck**

Run: `npx tsc --noEmit -p tsconfig.main.json`
Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add src/main/notifications.ts
git commit -m "Add native notification wrapper"
```

---

### Task 12: IPC wiring (main process orchestration)

**Files:**
- Create: `src/main/ipc.ts`
- Modify: `src/main/main.ts`

**Interfaces:**
- Consumes: `LogWatcher` (Task 8), `AppStore`, `AppConfig`, `TimerRecord` (Task 9), `TimerManager` (Task 10), `notify` (Task 11), `detectDefaultLogPath`, `ZAAP_LOG_PATH`, `STEAM_LOG_PATH` (Task 7), quest name lookup from `data/environmentalQuests.json`.
- Produces: `function registerIpcHandlers(store: AppStore, watcher: LogWatcher, timerManager: TimerManager): void`, wiring these `ipcMain.handle` channels: `'get-config'`, `'set-log-path'`, `'follow-quest'`, `'unfollow-quest'`, `'create-timer'`, `'cancel-timer'`, and `ipcMain.on('browse-log-file', ...)` opening a native `dialog.showOpenDialog`. Also wires `watcher.on('wakfu-event', ...)` to append history, check followed quests, and notify; and `timerManager`'s `onExpire` callback to notify. Sends `'wakfu-event-pushed'` and `'timer-expired'` messages to the renderer via `webContents.send`. Consumed by `main.ts` and by `preload.ts` (Task 13).

- [ ] **Step 1: Write `src/main/ipc.ts`**

```ts
import { ipcMain, dialog, BrowserWindow } from 'electron'
import { AppStore } from './store'
import { LogWatcher } from './logWatcher'
import { TimerManager } from './timers'
import { notify } from './notifications'
import environmentalQuests from './data/environmentalQuests.json'

function questName(id: number): string {
  return (environmentalQuests as Record<string, string>)[String(id)] ?? `Quête #${id}`
}

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

  ipcMain.handle('follow-quest', (_event, id: number) => {
    store.addFollowedQuest(id)
    return store.getConfig()
  })

  ipcMain.handle('unfollow-quest', (_event, id: number) => {
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

  watcher.on('wakfu-event', (event) => {
    store.appendHistoryEvent(event)
    getWindow()?.webContents.send('wakfu-event-pushed', event)

    if (event.type === 'environmental-quest' && event.challengeId !== -1) {
      const followed = store.getConfig().followedQuestIds
      if (followed.includes(event.challengeId)) {
        notify('Quête environnementale rencontrée', questName(event.challengeId))
      }
    }

    if (event.type === 'server-connection') {
      notify('Connecté au serveur', event.server)
    }
  })
}
```

- [ ] **Step 2: Wire `TimerManager` expiry to notifications and renderer push, and register everything in `src/main/main.ts`**

Replace the contents of `src/main/main.ts`:

```ts
import { app, BrowserWindow } from 'electron'
import { join } from 'path'
import { AppStore } from './store'
import { LogWatcher } from './logWatcher'
import { TimerManager } from './timers'
import { notify } from './notifications'
import { registerIpcHandlers } from './ipc'
import { detectDefaultLogPath, ZAAP_LOG_PATH, STEAM_LOG_PATH } from './logPathDetection'
import { existsSync } from 'fs'

let mainWindow: BrowserWindow | null = null

function createWindow(): void {
  mainWindow = new BrowserWindow({
    width: 1000,
    height: 700,
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

- [ ] **Step 3: Typecheck**

Run: `npx tsc --noEmit -p tsconfig.main.json`
Expected: no errors. (Note: `resolveJsonModule` is already set in `tsconfig.main.json` from Task 1, needed for the `environmentalQuests.json` import.)

- [ ] **Step 4: Commit**

```bash
git add src/main/ipc.ts src/main/main.ts
git commit -m "Wire IPC handlers and orchestrate watcher/store/timers/notifications in main process"
```

---

### Task 13: Preload bridge

**Files:**
- Modify: `src/preload/preload.ts`

**Interfaces:**
- Consumes: IPC channel names from `ipc.ts` (Task 12): `'get-config'`, `'set-log-path'`, `'follow-quest'`, `'unfollow-quest'`, `'create-timer'`, `'cancel-timer'`, `'browse-log-file'`, `'wakfu-event-pushed'`, `'timer-expired'`.
- Produces: `window.wakfuApi` typed surface, consumed by the Pinia store in `renderer/stores/appState.ts` (Task 15). Also produces the ambient type declaration file `src/renderer/wakfuApi.d.ts` for renderer-side typing.

- [ ] **Step 1: Replace `src/preload/preload.ts`**

```ts
import { contextBridge, ipcRenderer } from 'electron'
import type { AppConfig, TimerRecord } from '../main/store'
import type { WakfuEvent } from '../main/parsers/types'

const api = {
  getConfig: (): Promise<AppConfig> => ipcRenderer.invoke('get-config'),
  setLogPath: (path: string): Promise<AppConfig> => ipcRenderer.invoke('set-log-path', path),
  browseLogFile: (): Promise<string | null> => ipcRenderer.invoke('browse-log-file'),
  followQuest: (id: number): Promise<AppConfig> => ipcRenderer.invoke('follow-quest', id),
  unfollowQuest: (id: number): Promise<AppConfig> => ipcRenderer.invoke('unfollow-quest', id),
  createTimer: (name: string, durationMs: number): Promise<TimerRecord> =>
    ipcRenderer.invoke('create-timer', name, durationMs),
  cancelTimer: (id: string): Promise<AppConfig> => ipcRenderer.invoke('cancel-timer', id),
  onWakfuEvent: (callback: (event: WakfuEvent) => void): void => {
    ipcRenderer.on('wakfu-event-pushed', (_event, payload: WakfuEvent) => callback(payload))
  },
  onTimerExpired: (callback: (timer: TimerRecord) => void): void => {
    ipcRenderer.on('timer-expired', (_event, payload: TimerRecord) => callback(payload))
  }
}

export type WakfuApi = typeof api

contextBridge.exposeInMainWorld('wakfuApi', api)
```

- [ ] **Step 2: Write `src/renderer/wakfuApi.d.ts`**

```ts
import type { WakfuApi } from '../preload/preload'

declare global {
  interface Window {
    wakfuApi: WakfuApi
  }
}

export {}
```

- [ ] **Step 3: Typecheck both main and renderer configs**

Run: `npx tsc --noEmit -p tsconfig.main.json && npx vue-tsc --noEmit -p tsconfig.json`
Expected: no errors.

- [ ] **Step 4: Commit**

```bash
git add src/preload/preload.ts src/renderer/wakfuApi.d.ts
git commit -m "Add typed preload bridge exposing wakfuApi to renderer"
```

---

### Task 14: Renderer Pinia store

**Files:**
- Create: `src/renderer/stores/appState.ts`

**Interfaces:**
- Consumes: `window.wakfuApi` (Task 13), `AppConfig`, `TimerRecord` (from `main/store.ts` types, imported type-only), `WakfuEvent` (from `main/parsers/types.ts`, imported type-only).
- Produces: Pinia store `useAppStore()` exposing reactive `config: AppConfig`, `liveEvents: WakfuEvent[]` (session-only feed, most recent first), actions `load()`, `setLogPath(path)`, `browseLogFile()`, `followQuest(id)`, `unfollowQuest(id)`, `createTimer(name, durationMs)`, `cancelTimer(id)`. Consumed by every view in Task 15.

- [ ] **Step 1: Write `src/renderer/stores/appState.ts`**

```ts
import { defineStore } from 'pinia'
import type { AppConfig, TimerRecord } from '../../main/store'
import type { WakfuEvent } from '../../main/parsers/types'

interface AppStateShape {
  config: AppConfig
  liveEvents: WakfuEvent[]
}

export const useAppStore = defineStore('app', {
  state: (): AppStateShape => ({
    config: { logPath: null, followedQuestIds: [], timers: [], history: [] },
    liveEvents: []
  }),
  actions: {
    async load(): Promise<void> {
      this.config = await window.wakfuApi.getConfig()
      window.wakfuApi.onWakfuEvent((event) => {
        this.liveEvents = [event, ...this.liveEvents]
      })
      window.wakfuApi.onTimerExpired((timer) => {
        this.config.timers = this.config.timers.filter((t: TimerRecord) => t.id !== timer.id)
      })
    },
    async setLogPath(path: string): Promise<void> {
      this.config = await window.wakfuApi.setLogPath(path)
    },
    async browseLogFile(): Promise<void> {
      const path = await window.wakfuApi.browseLogFile()
      if (path) this.config = await window.wakfuApi.getConfig()
    },
    async followQuest(id: number): Promise<void> {
      this.config = await window.wakfuApi.followQuest(id)
    },
    async unfollowQuest(id: number): Promise<void> {
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

- [ ] **Step 2: Typecheck**

Run: `npx vue-tsc --noEmit -p tsconfig.json`
Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add src/renderer/stores/appState.ts
git commit -m "Add Pinia app state store bridging to preload API"
```

---

### Task 15: Renderer views and router

**Files:**
- Create: `src/renderer/router.ts`
- Create: `src/renderer/components/NavBar.vue`
- Create: `src/renderer/views/ServerStatusView.vue`
- Create: `src/renderer/views/QuestsView.vue`
- Create: `src/renderer/views/TimersView.vue`
- Create: `src/renderer/views/HistoryView.vue`
- Create: `src/renderer/views/SettingsView.vue`
- Modify: `src/renderer/App.vue`, `src/renderer/main.ts`

**Interfaces:**
- Consumes: `useAppStore` from `stores/appState.ts` (Task 14), `environmentalQuests.json` (Task 9, imported directly into `QuestsView.vue` for the name-lookup list).

- [ ] **Step 1: Write `src/renderer/router.ts`**

```ts
import { createRouter, createWebHashHistory } from 'vue-router'
import ServerStatusView from './views/ServerStatusView.vue'
import QuestsView from './views/QuestsView.vue'
import TimersView from './views/TimersView.vue'
import HistoryView from './views/HistoryView.vue'
import SettingsView from './views/SettingsView.vue'

export const router = createRouter({
  history: createWebHashHistory(),
  routes: [
    { path: '/', component: ServerStatusView },
    { path: '/quests', component: QuestsView },
    { path: '/timers', component: TimersView },
    { path: '/history', component: HistoryView },
    { path: '/settings', component: SettingsView }
  ]
})
```

- [ ] **Step 2: Write `src/renderer/components/NavBar.vue`**

```vue
<template>
  <nav>
    <RouterLink to="/">Serveur</RouterLink>
    <RouterLink to="/quests">Quêtes</RouterLink>
    <RouterLink to="/timers">Timers</RouterLink>
    <RouterLink to="/history">Historique</RouterLink>
    <RouterLink to="/settings">Réglages</RouterLink>
  </nav>
</template>
```

- [ ] **Step 3: Write `src/renderer/views/ServerStatusView.vue`**

```vue
<template>
  <div>
    <h1>Serveur</h1>
    <p v-if="currentServer">Connecté à : {{ currentServer }}</p>
    <p v-else>Aucun serveur détecté pour le moment.</p>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import { useAppStore } from '../stores/appState'

const store = useAppStore()

const currentServer = computed(() => {
  const event = store.liveEvents.find((e) => e.type === 'server-connection')
  return event && event.type === 'server-connection' ? event.server : null
})
</script>
```

- [ ] **Step 4: Write `src/renderer/views/QuestsView.vue`**

```vue
<template>
  <div>
    <h1>Quêtes environnementales suivies</h1>
    <ul>
      <li v-for="(name, id) in quests" :key="id">
        {{ name }} (#{{ id }})
        <button v-if="!isFollowed(Number(id))" @click="store.followQuest(Number(id))">Suivre</button>
        <button v-else @click="store.unfollowQuest(Number(id))">Ne plus suivre</button>
      </li>
    </ul>
  </div>
</template>

<script setup lang="ts">
import { useAppStore } from '../stores/appState'
import quests from '../../main/data/environmentalQuests.json'

const store = useAppStore()

function isFollowed(id: number): boolean {
  return store.config.followedQuestIds.includes(id)
}
</script>
```

- [ ] **Step 5: Write `src/renderer/views/TimersView.vue`**

```vue
<template>
  <div>
    <h1>Timers d'archimonstres</h1>
    <form @submit.prevent="submit">
      <input v-model="name" placeholder="Nom (ex: Boss X)" required />
      <input v-model.number="minutes" type="number" min="1" placeholder="Minutes" required />
      <button type="submit">Créer le timer</button>
    </form>
    <ul>
      <li v-for="timer in store.config.timers" :key="timer.id">
        {{ timer.name }} — {{ remaining(timer.endsAt) }}
        <button @click="store.cancelTimer(timer.id)">Annuler</button>
      </li>
    </ul>
  </div>
</template>

<script setup lang="ts">
import { ref } from 'vue'
import { useAppStore } from '../stores/appState'

const store = useAppStore()
const name = ref('')
const minutes = ref(1)

function submit(): void {
  store.createTimer(name.value, minutes.value * 60_000)
  name.value = ''
  minutes.value = 1
}

function remaining(endsAt: number): string {
  const ms = Math.max(0, endsAt - Date.now())
  const totalSeconds = Math.floor(ms / 1000)
  const m = Math.floor(totalSeconds / 60)
  const s = totalSeconds % 60
  return `${m}m ${s}s`
}
</script>
```

- [ ] **Step 6: Write `src/renderer/views/HistoryView.vue`**

```vue
<template>
  <div>
    <h1>Historique de la session</h1>
    <ul>
      <li v-for="(event, index) in store.liveEvents" :key="index">
        {{ event.timestamp }} — {{ describe(event) }}
      </li>
    </ul>
  </div>
</template>

<script setup lang="ts">
import { useAppStore } from '../stores/appState'
import type { WakfuEvent } from '../../main/parsers/types'

const store = useAppStore()

function describe(event: WakfuEvent): string {
  switch (event.type) {
    case 'server-connection':
      return `Connexion au serveur ${event.server}`
    case 'environmental-quest':
      return event.challengeId === -1
        ? 'Aucun challenge actif'
        : `Challenge actif : #${event.challengeId}`
    case 'quest-completed':
      return `Quête remportée : ${event.questName}`
    case 'quest-failed':
      return `Quête échouée : ${event.questName}`
    case 'achievement':
      return `Haut fait débloqué : #${event.achievementId}`
  }
}
</script>
```

- [ ] **Step 7: Write `src/renderer/views/SettingsView.vue`**

```vue
<template>
  <div>
    <h1>Réglages</h1>
    <p>Chemin du fichier de log : {{ store.config.logPath ?? 'non configuré' }}</p>
    <button @click="store.browseLogFile()">Parcourir...</button>
  </div>
</template>

<script setup lang="ts">
import { useAppStore } from '../stores/appState'

const store = useAppStore()
</script>
```

- [ ] **Step 8: Replace `src/renderer/App.vue`**

```vue
<template>
  <NavBar />
  <RouterView />
</template>

<script setup lang="ts">
import { onMounted } from 'vue'
import NavBar from './components/NavBar.vue'
import { useAppStore } from './stores/appState'

const store = useAppStore()
onMounted(() => store.load())
</script>
```

- [ ] **Step 9: Replace `src/renderer/main.ts`**

```ts
import { createApp } from 'vue'
import { createPinia } from 'pinia'
import App from './App.vue'
import { router } from './router'

createApp(App).use(createPinia()).use(router).mount('#app')
```

- [ ] **Step 10: Install vue-router if not already present, then typecheck**

Run: `npx vue-tsc --noEmit -p tsconfig.json`
Expected: no errors.

- [ ] **Step 11: Commit**

```bash
git add src/renderer
git commit -m "Add renderer views, router, and navigation for server/quests/timers/history/settings"
```

---

### Task 16: Manual end-to-end verification

**Files:** none (verification only, no code changes)

- [ ] **Step 1: Point the app at the user's real log directory and launch**

```bash
npm run build
npx electron dist/main/main.js
```

- [ ] **Step 2: In the Settings view, click "Parcourir..." and select the real `wakfu.log`** at `C:\Users\Utilisateur\AppData\Roaming\zaap\gamesLogs\wakfu\logs\wakfu.log`.

- [ ] **Step 3: Verify server detection**

With Wakfu running and connected, confirm the Server view shows the connected server name (not `dispatcher`) within a few seconds of connecting.

- [ ] **Step 4: Verify quest following and notification**

In the Quests view, follow one of the seeded challenge IDs. Trigger that challenge in-game (or, if not reproducible live, append a matching line to a copy of the log file manually to confirm the notification fires) and confirm a native Windows toast notification appears.

- [ ] **Step 5: Verify timer notification**

Create a 1-minute timer in the Timers view, wait for it to expire, confirm a native Windows toast notification appears and the timer disappears from the list.

- [ ] **Step 6: Verify history view**

Confirm the History view lists events in the order they occurred with human-readable descriptions.

- [ ] **Step 7: Report results to the user**

Summarize what was verified and any discrepancies found against real gameplay (e.g., a log format that doesn't match a fixture) — do not claim success without having actually run this against the real log file.

---

### Task 17: Packaging (NSIS installer)

**Files:**
- Modify: `package.json` (already has `package` script from Task 1)
- Modify: `electron-builder.yml` if icon/metadata needed

**Interfaces:** none (build-only task)

- [ ] **Step 1: Add an app icon placeholder reference** (skip if no icon asset provided by user — electron-builder falls back to a default Electron icon, acceptable for V1)

- [ ] **Step 2: Build the installer**

Run: `npm run package`
Expected: `release/Wakfu Companion Setup <version>.exe` is created without errors.

- [ ] **Step 3: Run the installer manually and confirm the app launches from the Start Menu shortcut it creates**

- [ ] **Step 4: Commit any packaging config changes**

```bash
git add electron-builder.yml package.json
git commit -m "Finalize NSIS packaging configuration"
```

---

## Self-Review Notes

- **Spec coverage:** server detection (Tasks 3, 8, 12, 15), environmental quest tracking with notification (Tasks 4, 9, 10 data, 12, 15), boss timers (Tasks 10, 12, 15), session history (Tasks 12, 14, 15), log path auto-detection + manual fallback (Tasks 7, 12, 15 Settings), native notifications (Task 11), NSIS installer (Task 17), parser testability independent of Electron (Tasks 3-6 use plain Vitest with no Electron dependency). Chat watcher and community backend are confirmed out of scope per spec and have no tasks — correct.
- **Placeholder scan:** no TBD/TODO markers; every step has complete, runnable code.
- **Type consistency:** `WakfuEvent` discriminated union (Task 2) is used identically across parsers (3-6), `logWatcher.ts` (8), `store.ts` (9), `ipc.ts` (12), preload (13), Pinia store (14), and `HistoryView.vue` (15) — field names (`server`, `challengeId`, `questName`, `achievementId`, `timestamp`) match throughout. `TimerRecord` (`id`, `name`, `endsAt`) is consistent across `store.ts`, `timers.ts`, `ipc.ts`, preload, and `TimersView.vue`.
