# Client — Comptes, amis, métiers — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Wire the Electron client (main + preload + renderer) to the already-built backend
(`server/`) so users can register, log in, add friends by friend code, and have job levels
auto-detected from `wakfu.log` and synced.

**Architecture:** A new `src/main/apiClient.ts` wraps `net.fetch` calls to the backend, used by
new IPC handlers in `ipc.ts` for auth/friends/jobs. A new `src/main/parsers/jobLevelUp.ts` detects
job level-ups in the log, following the existing one-parser-per-concern pattern. The session token
is encrypted with Electron's `safeStorage` and persisted in `electron-store` alongside the rest of
`AppConfig`. Two new Pinia stores (`auth.ts`, `friends.ts`) and three new views
(`LoginView.vue`, `RegisterView.vue`, `FriendsView.vue`) follow the existing store/view
conventions exactly (see Global Constraints).

**Tech Stack:** No new npm dependencies — reuses Electron's built-in `net.fetch` and `safeStorage`,
existing `electron-store`, Pinia, vue-router, vitest.

## Global Constraints

- The backend (`server/`) already exists, is tested, and is unaffected by this plan — this plan
  only touches `src/`, `tests/`, and `tests/parsers/fixtures.ts`.
- IPC channels are kebab-case, registered via `ipcMain.handle` in `src/main/ipc.ts`, mirrored 1:1
  in `src/preload/preload.ts`'s `api` object. Mutating handlers that change `AppConfig` return
  `store.getConfig()`; auth/friends handlers that don't change `AppConfig` return their own typed
  result directly (session info, friends list) — there is no existing "wrap everything in
  AppConfig" requirement for state that isn't part of `AppConfig`.
- Parsers are pure `(line: string) => WakfuEvent | null` functions in `src/main/parsers/`, one file
  per concern, registered in the `PARSERS` array in `src/main/logWatcher.ts`. Every parser has a
  fixture block in `tests/parsers/fixtures.ts` and a matching `*.test.ts` file.
- Job names: `Bûcheron, Mineur, Trappeur, Pêcheur, Paysan, Alchimiste, Forgeron, Bijoutier,
  Sculpteur, Tailleur, Cordonnier, Façonneur, Boulanger` (must stay byte-for-byte identical to
  `server/src/jobs.ts`'s `JOB_NAMES` — the server rejects any other name with 400). Levels are
  integers clamped `0..155`.
- The API base URL is a constant in `src/main/apiClient.ts`, defaulting to `http://localhost:3000`
  for local development against the Dockerized Postgres backend. Update this constant once the
  backend is deployed — no other code changes needed.
- No new dependencies. Auth token encryption uses `safeStorage.encryptString` /
  `safeStorage.decryptString` (built into Electron, not currently used anywhere in this repo).
- Accounts are optional: every existing feature (timers, environmental quests, archimonsters,
  exploits) must keep working with no session present. Auth-dependent UI (Friends tab) is hidden
  when logged out.
- Follow the existing renderer visual style: `'Cinzel', serif` headings, CSS custom properties
  (`--panel-bg`, `--border`, `--accent`, `--text-primary`, `--text-secondary`, `--gold`, etc.)
  already defined globally — reuse them, don't invent new ones.

---

## File Structure

```
src/main/
  apiClient.ts              # NEW — net.fetch wrapper for the backend API
  session.ts                 # NEW — safeStorage-backed token encrypt/decrypt helpers
  parsers/
    jobLevelUp.ts             # NEW — detects "<Job> : +N points d'XP. +M niveau(x)." lines
    types.ts                  # MODIFY — add 'job-level-up' variant to WakfuEvent
  jobs.ts                     # NEW — client-side copy of JOB_NAMES/isValidJobName/clampLevel
  store.ts                    # MODIFY — add authToken?/session fields to AppConfig + accessors
  logWatcher.ts                # MODIFY — register parseJobLevelUp in PARSERS
  ipc.ts                       # MODIFY — register auth-*, friends-*, job-update-manual channels

src/preload/
  preload.ts                  # MODIFY — expose new api methods

src/renderer/
  wakfuApi.d.ts                # unchanged (re-derives from preload.ts automatically)
  stores/
    auth.ts                    # NEW — session state + register/login/logout actions
    friends.ts                  # NEW — friends list, pending requests, send/accept/reject actions
  views/
    LoginView.vue               # NEW
    RegisterView.vue             # NEW — two-step form (credentials, then job levels)
    FriendsView.vue              # NEW — friend list + add-by-code + pending requests + own code
  components/
    NavBar.vue                  # MODIFY — add "Amis" link (only when logged in) + login/logout entry
  router.ts                     # MODIFY — add /login, /register, /friends routes

tests/
  parsers/
    fixtures.ts                 # MODIFY — add JOB_LEVEL_UP_LINES
    jobLevelUp.test.ts           # NEW
  main/
    jobs.test.ts                 # NEW — client-side isValidJobName/clampLevel tests
    apiClient.test.ts             # NEW — request building / error propagation, mocked fetch
```

**Interfaces summary (for cross-task reference):**
- `src/main/jobs.ts` exports `JOB_NAMES: readonly string[]`, `isValidJobName(name: string): boolean`,
  `clampLevel(level: number): number` — identical contract to `server/src/jobs.ts`.
- `src/main/apiClient.ts` exports `ApiError` (class, has `.status: number` and `.message: string`),
  and `apiClient` object: `register(payload): Promise<AuthResult>`,
  `login(payload): Promise<AuthResult>`, `getMyJobs(token): Promise<JobEntry[]>`,
  `updateMyJob(token, jobName, level): Promise<JobEntry>`,
  `sendFriendRequest(token, friendCode): Promise<void>`,
  `getPendingRequests(token): Promise<FriendRequest[]>`,
  `acceptFriendRequest(token, id): Promise<void>`, `rejectFriendRequest(token, id): Promise<void>`,
  `getFriends(token): Promise<FriendWithJobs[]>`.
- `src/main/session.ts` exports `encryptToken(token: string): string`,
  `decryptToken(encrypted: string): string`.
- `src/main/store.ts` (modified) — `AppConfig` gains `authToken: string | null`,
  `currentUser: { username: string; friendCode: string } | null`. `AppStore` gains
  `setSession(token: string | null, user: {...} | null): void`,
  `getSession(): { token: string | null; user: {...} | null }`.
- `src/main/parsers/jobLevelUp.ts` exports `parseJobLevelUp: LineParser`.
- New `WakfuEvent` variant: `{ type: 'job-level-up'; jobName: string; levelsGained: number;
  timestamp: string }`.

---

### Task 1: Client-side job list and validation helpers

**Files:**
- Create: `src/main/jobs.ts`
- Test: `tests/main/jobs.test.ts`

**Interfaces:**
- Consumes: nothing.
- Produces: `JOB_NAMES`, `isValidJobName`, `clampLevel` — used by Task 2 (parser), Task 6
  (register/job IPC handlers), Task 9 (RegisterView).

- [ ] **Step 1: Write the failing test**

```typescript
// tests/main/jobs.test.ts
import { describe, it, expect } from 'vitest'
import { JOB_NAMES, isValidJobName, clampLevel } from '../../src/main/jobs'

describe('jobs', () => {
  it('lists all known Wakfu professions', () => {
    expect(JOB_NAMES).toContain('Trappeur')
    expect(JOB_NAMES.length).toBe(13)
  })

  it('accepts a known job name', () => {
    expect(isValidJobName('Trappeur')).toBe(true)
  })

  it('rejects an unknown job name', () => {
    expect(isValidJobName('NotAJob')).toBe(false)
  })

  it('clamps levels within 0 and 155', () => {
    expect(clampLevel(-5)).toBe(0)
    expect(clampLevel(200)).toBe(155)
    expect(clampLevel(80)).toBe(80)
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/main/jobs.test.ts`
Expected: FAIL — `src/main/jobs.ts` does not exist.

- [ ] **Step 3: Write `src/main/jobs.ts`**

```typescript
export const JOB_NAMES = [
  'Bûcheron',
  'Mineur',
  'Trappeur',
  'Pêcheur',
  'Paysan',
  'Alchimiste',
  'Forgeron',
  'Bijoutier',
  'Sculpteur',
  'Tailleur',
  'Cordonnier',
  'Façonneur',
  'Boulanger'
] as const

export function isValidJobName(name: string): boolean {
  return (JOB_NAMES as readonly string[]).includes(name)
}

export function clampLevel(level: number): number {
  return Math.min(155, Math.max(0, level))
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run tests/main/jobs.test.ts`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/main/jobs.ts tests/main/jobs.test.ts
git commit -m "client: add job list and validation helpers matching server"
```

---

### Task 2: Job level-up log parser

**Files:**
- Modify: `src/main/parsers/types.ts`
- Create: `src/main/parsers/jobLevelUp.ts`
- Modify: `tests/parsers/fixtures.ts`
- Create: `tests/parsers/jobLevelUp.test.ts`

**Interfaces:**
- Consumes: `LineParser` type from `./types`.
- Produces: `parseJobLevelUp: LineParser`, and the `'job-level-up'` `WakfuEvent` variant — used by
  Task 3 (`logWatcher.ts` registration) and Task 7 (renderer event handling).

The real log line to match (given by the user):

```
 INFO 20:04:47,496 [AWT-EventQueue-0] (aPV:174) - [Information (jeu)] Trappeur : +1 041 points d'XP.  +1 niveau. Prochain niveau dans : 20 796.
```

Note the leading space before `INFO` (matches existing fixtures), the `[Information (jeu)]` tag
(matches `QUEST_COMPLETED_LINES.won`'s prefix style), a space-separated thousands number
(`+1 041`), and double space before `+1 niveau`. The parser must extract the job name and the
number of levels gained (the `+1` before `niveau`), not the XP number.

- [ ] **Step 1: Write the failing test**

```typescript
// tests/parsers/jobLevelUp.test.ts
import { describe, it, expect } from 'vitest'
import { parseJobLevelUp } from '../../src/main/parsers/jobLevelUp'
import { JOB_LEVEL_UP_LINES, UNRELATED_LINES } from './fixtures'

describe('parseJobLevelUp', () => {
  it('extracts job name and levels gained from a single-level-up line', () => {
    const event = parseJobLevelUp(JOB_LEVEL_UP_LINES.trappeurSingleLevel)
    expect(event).toEqual({
      type: 'job-level-up',
      jobName: 'Trappeur',
      levelsGained: 1,
      timestamp: '20:04:47,496'
    })
  })

  it('extracts a multi-level-up gain', () => {
    const event = parseJobLevelUp(JOB_LEVEL_UP_LINES.bucheronMultiLevel)
    expect(event).toEqual({
      type: 'job-level-up',
      jobName: 'Bûcheron',
      levelsGained: 3,
      timestamp: '09:12:03,001'
    })
  })

  it('returns null for an unknown job name', () => {
    expect(parseJobLevelUp(JOB_LEVEL_UP_LINES.unknownJob)).toBeNull()
  })

  it('returns null for unrelated lines', () => {
    for (const line of UNRELATED_LINES) {
      expect(parseJobLevelUp(line)).toBeNull()
    }
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/parsers/jobLevelUp.test.ts`
Expected: FAIL — `src/main/parsers/jobLevelUp.ts` and the fixtures don't exist yet.

- [ ] **Step 3: Add fixtures to `tests/parsers/fixtures.ts`**

Add this block (don't modify existing exports):

```typescript
export const JOB_LEVEL_UP_LINES = {
  trappeurSingleLevel:
    ' INFO 20:04:47,496 [AWT-EventQueue-0] (aPV:174) - [Information (jeu)] Trappeur : +1 041 points d\'XP.  +1 niveau. Prochain niveau dans : 20 796.',
  bucheronMultiLevel:
    ' INFO 09:12:03,001 [AWT-EventQueue-0] (aPV:174) - [Information (jeu)] Bûcheron : +12 500 points d\'XP.  +3 niveaux. Prochain niveau dans : 5 200.',
  unknownJob:
    ' INFO 11:00:00,000 [AWT-EventQueue-0] (aPV:174) - [Information (jeu)] Astrologue : +500 points d\'XP.  +1 niveau. Prochain niveau dans : 100.'
}
```

- [ ] **Step 4: Write `src/main/parsers/types.ts`**

```typescript
export type WakfuEvent =
  | { type: 'server-connection'; server: string; timestamp: string }
  | { type: 'quest-completed'; questName: string; timestamp: string }
  | { type: 'quest-failed'; questName: string; timestamp: string }
  | { type: 'achievement'; achievementId: number; timestamp: string }
  | { type: 'job-level-up'; jobName: string; levelsGained: number; timestamp: string }

export type LineParser = (line: string) => WakfuEvent | null
```

- [ ] **Step 5: Write `src/main/parsers/jobLevelUp.ts`**

```typescript
import { LineParser } from './types'
import { isValidJobName } from '../jobs'

const PATTERN =
  /^\s*INFO\s+(\d{2}:\d{2}:\d{2},\d{3}).*\[Information \(jeu\)\] ([^:]+?)\s*:\s*\+[\d\s]+points d'XP\.\s+\+(\d+)\s+niveaux?\./

export const parseJobLevelUp: LineParser = (line) => {
  const match = PATTERN.exec(line)
  if (!match) return null

  const [, timestamp, jobName, levelsGainedStr] = match
  if (!isValidJobName(jobName)) return null

  return { type: 'job-level-up', jobName, levelsGained: Number(levelsGainedStr), timestamp }
}
```

- [ ] **Step 6: Run test to verify it passes**

Run: `npx vitest run tests/parsers/jobLevelUp.test.ts`
Expected: PASS

- [ ] **Step 7: Run the full parser test suite to check for regressions**

Run: `npx vitest run tests/parsers`
Expected: all PASS (existing parsers untouched, new one added).

- [ ] **Step 8: Commit**

```bash
git add src/main/parsers/types.ts src/main/parsers/jobLevelUp.ts tests/parsers/fixtures.ts tests/parsers/jobLevelUp.test.ts
git commit -m "client: add job-level-up log parser"
```

---

### Task 3: Register the parser in LogWatcher

**Files:**
- Modify: `src/main/logWatcher.ts`

**Interfaces:**
- Consumes: `parseJobLevelUp` (Task 2).
- Produces: `job-level-up` events now flow through `LogWatcher`'s existing `wakfu-event` emission
  — used by Task 7 (renderer handling) with zero changes needed to the emission mechanism itself.

- [ ] **Step 1: Modify `src/main/logWatcher.ts`**

Add the import and array entry (exact insertion points — the rest of the file is unchanged):

```typescript
import { parseJobLevelUp } from './parsers/jobLevelUp'
```

```typescript
const PARSERS: LineParser[] = [
  parseServerConnection,
  parseQuestCompleted,
  parseAchievement,
  parseJobLevelUp
]
```

- [ ] **Step 2: Typecheck**

Run: `npx tsc --noEmit -p tsconfig.main.json`
Expected: no errors.

- [ ] **Step 3: Run the full test suite to check for regressions**

Run: `npm run test`
Expected: all PASS.

- [ ] **Step 4: Commit**

```bash
git add src/main/logWatcher.ts
git commit -m "client: wire job-level-up parser into LogWatcher"
```

---

### Task 4: Session token encryption helpers

**Files:**
- Create: `src/main/session.ts`
- Test: `tests/main/session.test.ts`

**Interfaces:**
- Consumes: Electron's `safeStorage` module.
- Produces: `encryptToken(token: string): string`, `decryptToken(encrypted: string): string` —
  used by Task 5 (`AppStore.setSession`/`getSession`).

`safeStorage` requires a real OS keychain and is unavailable under vitest's Node test environment
(`safeStorage.isEncryptionAvailable()` returns `false` outside a running Electron app). Wrap it
so the encrypt/decrypt functions gracefully fall back to plain base64 when encryption isn't
available (dev/test only — never the packaged app, where Electron always provides real OS-backed
encryption on Windows/macOS/Linux with a desktop keyring).

- [ ] **Step 1: Write the failing test**

```typescript
// tests/main/session.test.ts
import { describe, it, expect } from 'vitest'
import { encryptToken, decryptToken } from '../../src/main/session'

describe('session token encryption', () => {
  it('round-trips a token through encrypt/decrypt', () => {
    const token = 'a.fake.jwt.token'
    const encrypted = encryptToken(token)
    expect(encrypted).not.toBe(token)
    expect(decryptToken(encrypted)).toBe(token)
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/main/session.test.ts`
Expected: FAIL — `src/main/session.ts` does not exist.

- [ ] **Step 3: Write `src/main/session.ts`**

```typescript
import { safeStorage } from 'electron'

function encryptionAvailable(): boolean {
  return typeof safeStorage !== 'undefined' && safeStorage.isEncryptionAvailable()
}

export function encryptToken(token: string): string {
  if (encryptionAvailable()) {
    return safeStorage.encryptString(token).toString('base64')
  }
  return Buffer.from(token, 'utf-8').toString('base64')
}

export function decryptToken(encrypted: string): string {
  const buffer = Buffer.from(encrypted, 'base64')
  if (encryptionAvailable()) {
    return safeStorage.decryptString(buffer)
  }
  return buffer.toString('utf-8')
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run tests/main/session.test.ts`
Expected: PASS.

**Implementation note (discovered during Task 4):** under vitest (plain Node, outside a running
Electron process), the `electron` module's `safeStorage` export is `undefined`, not an object
whose `isEncryptionAvailable()` returns `false` — calling `safeStorage.isEncryptionAvailable()`
directly throws `Cannot read properties of undefined`. Guard with a
`typeof safeStorage !== 'undefined' && safeStorage.isEncryptionAvailable()` check (see
`encryptionAvailable()` helper in the code above) so the fallback path is reached instead of
throwing. The packaged app always runs inside real Electron, where `safeStorage` is defined and
`isEncryptionAvailable()` reflects real OS-backed encryption support.

- [ ] **Step 5: Commit**

```bash
git add src/main/session.ts tests/main/session.test.ts
git commit -m "client: add safeStorage-backed session token encryption"
```

---

### Task 5: Extend AppStore with session persistence

**Files:**
- Modify: `src/main/store.ts`
- Modify: `tests/main/store.test.ts`

**Interfaces:**
- Consumes: `encryptToken`/`decryptToken` (Task 4).
- Produces: `AppConfig.authToken: string | null`, `AppConfig.currentUser: {username: string;
  friendCode: string} | null`; `AppStore.setSession(token, user): void`,
  `AppStore.getSession(): {token: string | null; user: {...} | null}` — used by Task 6 (IPC
  handlers) and Task 7 (renderer auth store on startup).

Storing the token encrypted at rest means `AppConfig.authToken` in the persisted file is the
*encrypted* string, but `getSession()` returns the *decrypted* plain token for in-memory use —
`getConfig()` (used for the general config round-trip) continues to expose the raw
`AppConfig.authToken` field as-is (encrypted) since renderer code should never receive a raw
session token through the general config path; only `getSession()` (used exclusively by the new
auth IPC channel) decrypts it.

- [ ] **Step 1: Write the failing test**

Add to `tests/main/store.test.ts` (existing file — append this test, keep all existing tests
unchanged):

```typescript
  it('stores and retrieves an encrypted session, decrypted on read', () => {
    expect(store.getSession()).toEqual({ token: null, user: null })

    store.setSession('a.fake.jwt', { username: 'clement', friendCode: 'WC-ABCDEF' })
    const session = store.getSession()
    expect(session.token).toBe('a.fake.jwt')
    expect(session.user).toEqual({ username: 'clement', friendCode: 'WC-ABCDEF' })

    // the raw config field must not be the plaintext token
    expect(store.getConfig().authToken).not.toBe('a.fake.jwt')

    store.setSession(null, null)
    expect(store.getSession()).toEqual({ token: null, user: null })
  })
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/main/store.test.ts`
Expected: FAIL — `setSession`/`getSession` don't exist, and the "starts with an empty default
config" test will also need updating (next step) since `AppConfig`'s shape changes.

- [ ] **Step 3: Update the "starts with an empty default config" test**

In `tests/main/store.test.ts`, find:

```typescript
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
```

Replace with:

```typescript
  it('starts with an empty default config', () => {
    expect(store.getConfig()).toEqual({
      logPath: null,
      followedQuestIds: [],
      timers: [],
      history: [],
      environmentalQuests: [],
      archimonsters: [],
      exploits: [],
      authToken: null,
      currentUser: null
    })
  })
```

- [ ] **Step 4: Modify `src/main/store.ts`**

Add the import at the top:

```typescript
import { encryptToken, decryptToken } from './session'
```

In the `AppConfig` interface, add after `exploits: Exploit[]`:

```typescript
  authToken: string | null
  currentUser: { username: string; friendCode: string } | null
```

In `DEFAULTS`, add after `exploits: []`:

```typescript
  authToken: null,
  currentUser: null
```

In `getConfig()`'s returned object, add after `exploits: this.store.get('exploits')`:

```typescript
      authToken: this.store.get('authToken'),
      currentUser: this.store.get('currentUser')
```

Add these two methods to the `AppStore` class (near the other simple getters/setters, e.g. after
`removeExploit`):

```typescript
  setSession(token: string | null, user: { username: string; friendCode: string } | null): void {
    this.store.set('authToken', token ? encryptToken(token) : null)
    this.store.set('currentUser', user)
  }

  getSession(): { token: string | null; user: { username: string; friendCode: string } | null } {
    const encrypted = this.store.get('authToken')
    return {
      token: encrypted ? decryptToken(encrypted) : null,
      user: this.store.get('currentUser')
    }
  }
```

- [ ] **Step 5: Run test to verify it passes**

Run: `npx vitest run tests/main/store.test.ts`
Expected: PASS (all existing tests plus the new one).

- [ ] **Step 6: Typecheck**

Run: `npx tsc --noEmit -p tsconfig.main.json`
Expected: no errors.

- [ ] **Step 7: Commit**

```bash
git add src/main/store.ts tests/main/store.test.ts
git commit -m "client: add encrypted session persistence to AppStore"
```

---

### Task 6: API client for the backend

**Files:**
- Create: `src/main/apiClient.ts`
- Test: `tests/main/apiClient.test.ts`

**Interfaces:**
- Consumes: Electron's `net.fetch` (mocked in tests — see Step 1).
- Produces: `ApiError` class, `apiClient` object (see File Structure summary above) — used by
  Task 8 (IPC handlers).

`net.fetch` is Electron's networking API and isn't available outside a running Electron process,
so it can't be called directly in a vitest unit test. Structure `apiClient.ts` to accept an
injectable fetch function (defaulting to `net.fetch` in production, overridable in tests) — this
mirrors no existing pattern in the codebase (the codebase's only other network caller,
`updateCheck.ts`, has no unit test of its network call, only of its pure `parseLatestRelease`
helper) but is necessary here since, unlike `updateCheck.ts`, this client's error paths are part of
its contract and must be tested.

- [ ] **Step 1: Write the failing test**

```typescript
// tests/main/apiClient.test.ts
import { describe, it, expect, vi } from 'vitest'
import { createApiClient, ApiError } from '../../src/main/apiClient'

function mockFetch(status: number, body: unknown) {
  return vi.fn().mockResolvedValue({
    ok: status >= 200 && status < 300,
    status,
    json: async () => body
  })
}

describe('apiClient', () => {
  it('register posts credentials and jobs, returns token and user', async () => {
    const fetchFn = mockFetch(201, {
      token: 'tok123',
      user: { id: 'u1', username: 'clement', friendCode: 'WC-ABCDEF' }
    })
    const client = createApiClient('http://localhost:3000', fetchFn)

    const result = await client.register({
      username: 'clement',
      email: 'clement@example.com',
      password: 'hunter2hunter2',
      jobs: { Trappeur: 10 }
    })

    expect(result).toEqual({ token: 'tok123', user: { id: 'u1', username: 'clement', friendCode: 'WC-ABCDEF' } })
    expect(fetchFn).toHaveBeenCalledWith(
      'http://localhost:3000/auth/register',
      expect.objectContaining({
        method: 'POST',
        headers: expect.objectContaining({ 'Content-Type': 'application/json' }),
        body: JSON.stringify({
          username: 'clement',
          email: 'clement@example.com',
          password: 'hunter2hunter2',
          jobs: { Trappeur: 10 }
        })
      })
    )
  })

  it('login throws ApiError with the server message on 401', async () => {
    const fetchFn = mockFetch(401, { error: 'Invalid credentials' })
    const client = createApiClient('http://localhost:3000', fetchFn)

    await expect(
      client.login({ usernameOrEmail: 'clement', password: 'wrong' })
    ).rejects.toMatchObject({ status: 401, message: 'Invalid credentials' })
  })

  it('getMyJobs sends the bearer token and returns the job list', async () => {
    const fetchFn = mockFetch(200, [{ jobName: 'Trappeur', level: 10 }])
    const client = createApiClient('http://localhost:3000', fetchFn)

    const jobs = await client.getMyJobs('tok123')

    expect(jobs).toEqual([{ jobName: 'Trappeur', level: 10 }])
    expect(fetchFn).toHaveBeenCalledWith(
      'http://localhost:3000/me/jobs',
      expect.objectContaining({ headers: expect.objectContaining({ Authorization: 'Bearer tok123' }) })
    )
  })

  it('updateMyJob PUTs the level and returns the updated job', async () => {
    const fetchFn = mockFetch(200, { jobName: 'Trappeur', level: 55 })
    const client = createApiClient('http://localhost:3000', fetchFn)

    const job = await client.updateMyJob('tok123', 'Trappeur', 55)

    expect(job).toEqual({ jobName: 'Trappeur', level: 55 })
    expect(fetchFn).toHaveBeenCalledWith(
      'http://localhost:3000/me/jobs/Trappeur',
      expect.objectContaining({ method: 'PUT', body: JSON.stringify({ level: 55 }) })
    )
  })

  it('sendFriendRequest posts the friend code', async () => {
    const fetchFn = mockFetch(201, { ok: true })
    const client = createApiClient('http://localhost:3000', fetchFn)

    await client.sendFriendRequest('tok123', 'WC-ABCDEF')

    expect(fetchFn).toHaveBeenCalledWith(
      'http://localhost:3000/friends/request',
      expect.objectContaining({ method: 'POST', body: JSON.stringify({ friendCode: 'WC-ABCDEF' }) })
    )
  })

  it('getPendingRequests and getFriends GET their endpoints', async () => {
    const pendingFetch = mockFetch(200, [{ id: 'r1', fromUsername: 'alice' }])
    const pendingClient = createApiClient('http://localhost:3000', pendingFetch)
    expect(await pendingClient.getPendingRequests('tok123')).toEqual([{ id: 'r1', fromUsername: 'alice' }])

    const friendsFetch = mockFetch(200, [{ username: 'bob', jobs: [] }])
    const friendsClient = createApiClient('http://localhost:3000', friendsFetch)
    expect(await friendsClient.getFriends('tok123')).toEqual([{ username: 'bob', jobs: [] }])
  })

  it('acceptFriendRequest and rejectFriendRequest POST to the right paths', async () => {
    const acceptFetch = mockFetch(200, { ok: true })
    await createApiClient('http://localhost:3000', acceptFetch).acceptFriendRequest('tok123', 'r1')
    expect(acceptFetch).toHaveBeenCalledWith(
      'http://localhost:3000/friends/requests/r1/accept',
      expect.objectContaining({ method: 'POST' })
    )

    const rejectFetch = mockFetch(200, { ok: true })
    await createApiClient('http://localhost:3000', rejectFetch).rejectFriendRequest('tok123', 'r1')
    expect(rejectFetch).toHaveBeenCalledWith(
      'http://localhost:3000/friends/requests/r1/reject',
      expect.objectContaining({ method: 'POST' })
    )
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/main/apiClient.test.ts`
Expected: FAIL — `src/main/apiClient.ts` does not exist.

- [ ] **Step 3: Write `src/main/apiClient.ts`**

```typescript
import { net } from 'electron'

export const DEFAULT_API_BASE_URL = 'http://localhost:3000'

export class ApiError extends Error {
  status: number

  constructor(status: number, message: string) {
    super(message)
    this.status = status
  }
}

export interface AuthResult {
  token: string
  user: { id: string; username: string; friendCode: string }
}

export interface JobEntry {
  jobName: string
  level: number
}

export interface FriendRequestSummary {
  id: string
  fromUsername: string
}

export interface FriendWithJobs {
  username: string
  jobs: JobEntry[]
}

type FetchFn = typeof net.fetch

async function request<T>(
  fetchFn: FetchFn,
  baseUrl: string,
  path: string,
  options: { method?: string; token?: string; body?: unknown } = {}
): Promise<T> {
  const headers: Record<string, string> = { 'Content-Type': 'application/json' }
  if (options.token) headers.Authorization = `Bearer ${options.token}`

  const response = await fetchFn(`${baseUrl}${path}`, {
    method: options.method ?? 'GET',
    headers,
    body: options.body !== undefined ? JSON.stringify(options.body) : undefined
  })

  const data = await response.json()
  if (!response.ok) {
    throw new ApiError(response.status, (data as { error?: string }).error ?? 'Request failed')
  }
  return data as T
}

export function createApiClient(baseUrl: string, fetchFn: FetchFn = net.fetch) {
  return {
    register(payload: {
      username: string
      email: string
      password: string
      jobs: Record<string, number>
    }): Promise<AuthResult> {
      return request(fetchFn, baseUrl, '/auth/register', { method: 'POST', body: payload })
    },

    login(payload: { usernameOrEmail: string; password: string }): Promise<AuthResult> {
      return request(fetchFn, baseUrl, '/auth/login', { method: 'POST', body: payload })
    },

    getMyJobs(token: string): Promise<JobEntry[]> {
      return request(fetchFn, baseUrl, '/me/jobs', { token })
    },

    updateMyJob(token: string, jobName: string, level: number): Promise<JobEntry> {
      return request(fetchFn, baseUrl, `/me/jobs/${encodeURIComponent(jobName)}`, {
        method: 'PUT',
        token,
        body: { level }
      })
    },

    sendFriendRequest(token: string, friendCode: string): Promise<void> {
      return request(fetchFn, baseUrl, '/friends/request', { method: 'POST', token, body: { friendCode } })
    },

    getPendingRequests(token: string): Promise<FriendRequestSummary[]> {
      return request(fetchFn, baseUrl, '/friends/requests', { token })
    },

    acceptFriendRequest(token: string, id: string): Promise<void> {
      return request(fetchFn, baseUrl, `/friends/requests/${encodeURIComponent(id)}/accept`, {
        method: 'POST',
        token
      })
    },

    rejectFriendRequest(token: string, id: string): Promise<void> {
      return request(fetchFn, baseUrl, `/friends/requests/${encodeURIComponent(id)}/reject`, {
        method: 'POST',
        token
      })
    },

    getFriends(token: string): Promise<FriendWithJobs[]> {
      return request(fetchFn, baseUrl, '/friends', { token })
    }
  }
}

export const apiClient = createApiClient(DEFAULT_API_BASE_URL)
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run tests/main/apiClient.test.ts`
Expected: PASS

- [ ] **Step 5: Typecheck**

Run: `npx tsc --noEmit -p tsconfig.main.json`
Expected: no errors.

- [ ] **Step 6: Commit**

```bash
git add src/main/apiClient.ts tests/main/apiClient.test.ts
git commit -m "client: add backend API client with injectable fetch for testing"
```

---

### Task 7: Emit job-level-up sync side effect + IPC handlers for auth/jobs/friends

**Files:**
- Modify: `src/main/ipc.ts`

**Interfaces:**
- Consumes: `apiClient` (Task 6), `AppStore.setSession`/`getSession` (Task 5), `isValidJobName`/
  `clampLevel` (Task 1).
- Produces: IPC channels `auth-register`, `auth-login`, `auth-logout`, `auth-get-session`,
  `friends-send-request`, `friends-accept-request`, `friends-reject-request`, `friends-list`,
  `friends-pending-requests`, `job-update-manual`, `job-get-mine`. Also modifies the existing
  `watcher.on('wakfu-event', ...)` handler to sync `job-level-up` events to the backend when a
  session exists.

Design choice on return shapes: `auth-register`/`auth-login` return
`{ user: {username, friendCode} } | { error: string }` (a discriminated result, not a thrown
error) because IPC invoke rejections are awkward to handle cleanly in the renderer for expected
failure cases like "wrong password" — the renderer needs to display that message in a form, not
catch a generic rejection. `friends-*` and `job-*` handlers propagate `ApiError` as a thrown
rejection (via `ipcMain.handle`, which the renderer receives as a rejected promise) since those are
triggered from buttons/background sync rather than a form needing inline validation text.

- [ ] **Step 1: Modify `src/main/ipc.ts`**

Add imports at the top:

```typescript
import { apiClient, ApiError } from './apiClient'
import { isValidJobName, clampLevel } from './jobs'
```

Add these handlers inside `registerIpcHandlers`, after the existing `remove-exploit` handler and
before the `watcher.on('wakfu-event', ...)` block:

```typescript
  ipcMain.handle(
    'auth-register',
    async (
      _event,
      payload: { username: string; email: string; password: string; jobs: Record<string, number> }
    ) => {
      for (const jobName of Object.keys(payload.jobs)) {
        if (!isValidJobName(jobName)) return { error: `Métier inconnu : ${jobName}` }
      }
      const clampedJobs = Object.fromEntries(
        Object.entries(payload.jobs).map(([name, level]) => [name, clampLevel(level)])
      )
      try {
        const result = await apiClient.register({ ...payload, jobs: clampedJobs })
        store.setSession(result.token, { username: result.user.username, friendCode: result.user.friendCode })
        return { user: { username: result.user.username, friendCode: result.user.friendCode } }
      } catch (err) {
        return { error: err instanceof ApiError ? err.message : 'Erreur réseau' }
      }
    }
  )

  ipcMain.handle('auth-login', async (_event, payload: { usernameOrEmail: string; password: string }) => {
    try {
      const result = await apiClient.login(payload)
      store.setSession(result.token, { username: result.user.username, friendCode: result.user.friendCode })
      return { user: { username: result.user.username, friendCode: result.user.friendCode } }
    } catch (err) {
      return { error: err instanceof ApiError ? err.message : 'Erreur réseau' }
    }
  })

  ipcMain.handle('auth-logout', () => {
    store.setSession(null, null)
  })

  ipcMain.handle('auth-get-session', () => {
    const { user } = store.getSession()
    return user
  })

  ipcMain.handle('job-get-mine', async () => {
    const { token } = store.getSession()
    if (!token) return []
    return apiClient.getMyJobs(token)
  })

  ipcMain.handle('job-update-manual', async (_event, jobName: string, level: number) => {
    const { token } = store.getSession()
    if (!token || !isValidJobName(jobName)) return null
    return apiClient.updateMyJob(token, jobName, clampLevel(level))
  })

  ipcMain.handle('friends-send-request', async (_event, friendCode: string) => {
    const { token } = store.getSession()
    if (!token) return
    await apiClient.sendFriendRequest(token, friendCode)
  })

  ipcMain.handle('friends-pending-requests', async () => {
    const { token } = store.getSession()
    if (!token) return []
    return apiClient.getPendingRequests(token)
  })

  ipcMain.handle('friends-accept-request', async (_event, id: string) => {
    const { token } = store.getSession()
    if (!token) return
    await apiClient.acceptFriendRequest(token, id)
  })

  ipcMain.handle('friends-reject-request', async (_event, id: string) => {
    const { token } = store.getSession()
    if (!token) return
    await apiClient.rejectFriendRequest(token, id)
  })

  ipcMain.handle('friends-list', async () => {
    const { token } = store.getSession()
    if (!token) return []
    return apiClient.getFriends(token)
  })
```

Modify the existing `watcher.on('wakfu-event', (event) => { ... })` block: add this branch inside
it, alongside the existing `if (event.type === 'quest-completed' ...)` and
`if (event.type === 'server-connection')` checks (same `if` chain, don't restructure):

```typescript
    if (event.type === 'job-level-up') {
      const { token } = store.getSession()
      if (token) {
        void apiClient.getMyJobs(token).then((jobs) => {
          const current = jobs.find((j) => j.jobName === event.jobName)?.level ?? 0
          const newLevel = clampLevel(current + event.levelsGained)
          return apiClient.updateMyJob(token, event.jobName, newLevel)
        })
      }
    }
```

- [ ] **Step 2: Typecheck**

Run: `npx tsc --noEmit -p tsconfig.main.json`
Expected: no errors.

- [ ] **Step 3: Run the full test suite to check for regressions**

Run: `npm run test`
Expected: all PASS (no existing test exercises `ipc.ts` directly — it's covered indirectly via
`AppStore`/parser tests — so this step confirms nothing else broke).

- [ ] **Step 4: Commit**

```bash
git add src/main/ipc.ts
git commit -m "client: add auth/friends/job IPC handlers and sync job-level-up events"
```

---

### Task 8: Expose new methods through preload

**Files:**
- Modify: `src/preload/preload.ts`

**Interfaces:**
- Consumes: nothing new (channels from Task 7).
- Produces: new methods on `window.wakfuApi`, and (via `WakfuApi = typeof api`) new types picked up
  automatically by `src/renderer/wakfuApi.d.ts` — used by Task 9 (Pinia stores).

- [ ] **Step 1: Modify `src/preload/preload.ts`**

Add these entries to the `api` object, after `removeExploit`:

```typescript
  authRegister: (payload: {
    username: string
    email: string
    password: string
    jobs: Record<string, number>
  }): Promise<{ user: { username: string; friendCode: string } } | { error: string }> =>
    ipcRenderer.invoke('auth-register', payload),
  authLogin: (payload: {
    usernameOrEmail: string
    password: string
  }): Promise<{ user: { username: string; friendCode: string } } | { error: string }> =>
    ipcRenderer.invoke('auth-login', payload),
  authLogout: (): Promise<void> => ipcRenderer.invoke('auth-logout'),
  authGetSession: (): Promise<{ username: string; friendCode: string } | null> =>
    ipcRenderer.invoke('auth-get-session'),
  getMyJobs: (): Promise<{ jobName: string; level: number }[]> => ipcRenderer.invoke('job-get-mine'),
  updateJobManual: (jobName: string, level: number): Promise<{ jobName: string; level: number } | null> =>
    ipcRenderer.invoke('job-update-manual', jobName, level),
  sendFriendRequest: (friendCode: string): Promise<void> =>
    ipcRenderer.invoke('friends-send-request', friendCode),
  getPendingFriendRequests: (): Promise<{ id: string; fromUsername: string }[]> =>
    ipcRenderer.invoke('friends-pending-requests'),
  acceptFriendRequest: (id: string): Promise<void> => ipcRenderer.invoke('friends-accept-request', id),
  rejectFriendRequest: (id: string): Promise<void> => ipcRenderer.invoke('friends-reject-request', id),
  getFriends: (): Promise<{ username: string; jobs: { jobName: string; level: number }[] }[]> =>
    ipcRenderer.invoke('friends-list')
```

- [ ] **Step 2: Typecheck**

Run: `npx tsc --noEmit -p tsconfig.main.json`
Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add src/preload/preload.ts
git commit -m "client: expose auth/friends/job methods on window.wakfuApi"
```

---

### Task 9: Pinia auth store

**Files:**
- Create: `src/renderer/stores/auth.ts`

**Interfaces:**
- Consumes: `window.wakfuApi.authRegister/authLogin/authLogout/authGetSession` (Task 8).
- Produces: `useAuthStore()` with state `isLoggedIn: boolean`, `user: {username, friendCode} |
  null`, `errorMessage: string | null`; actions `load()`, `register(payload)`, `login(payload)`,
  `logout()` — used by Task 11 (views) and Task 12 (NavBar).

No dedicated unit test for this file: it's a thin proxy over `window.wakfuApi` with no branching
logic of its own beyond setting state from the IPC result, matching the untested style of the
existing `admin.ts` store (see Global Constraints — existing Pinia stores have no test files;
`appState.ts`/`admin.ts` are exercised only through manual/E2E use, not vitest).

- [ ] **Step 1: Write `src/renderer/stores/auth.ts`**

```typescript
import { defineStore } from 'pinia'

interface AuthUser {
  username: string
  friendCode: string
}

interface AuthStateShape {
  isLoggedIn: boolean
  user: AuthUser | null
  errorMessage: string | null
}

export const useAuthStore = defineStore('auth', {
  state: (): AuthStateShape => ({
    isLoggedIn: false,
    user: null,
    errorMessage: null
  }),
  actions: {
    async load(): Promise<void> {
      const user = await window.wakfuApi.authGetSession()
      this.user = user
      this.isLoggedIn = user !== null
    },
    async register(payload: {
      username: string
      email: string
      password: string
      jobs: Record<string, number>
    }): Promise<boolean> {
      this.errorMessage = null
      const result = await window.wakfuApi.authRegister(payload)
      if ('error' in result) {
        this.errorMessage = result.error
        return false
      }
      this.user = result.user
      this.isLoggedIn = true
      return true
    },
    async login(payload: { usernameOrEmail: string; password: string }): Promise<boolean> {
      this.errorMessage = null
      const result = await window.wakfuApi.authLogin(payload)
      if ('error' in result) {
        this.errorMessage = result.error
        return false
      }
      this.user = result.user
      this.isLoggedIn = true
      return true
    },
    async logout(): Promise<void> {
      await window.wakfuApi.authLogout()
      this.user = null
      this.isLoggedIn = false
    }
  }
})
```

- [ ] **Step 2: Typecheck**

Run: `npx vue-tsc --noEmit -p tsconfig.json`
Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add src/renderer/stores/auth.ts
git commit -m "client: add auth Pinia store"
```

---

### Task 10: Pinia friends store

**Files:**
- Create: `src/renderer/stores/friends.ts`

**Interfaces:**
- Consumes: `window.wakfuApi.getFriends/getPendingFriendRequests/sendFriendRequest/
  acceptFriendRequest/rejectFriendRequest/getMyJobs` (Task 8).
- Produces: `useFriendsStore()` with state `friends: FriendWithJobs[]`, `pendingRequests:
  {id, fromUsername}[]`, `myJobs: {jobName, level}[]`; actions `refresh()`, `sendRequest(code)`,
  `accept(id)`, `reject(id)` — used by Task 11 (FriendsView).

- [ ] **Step 1: Write `src/renderer/stores/friends.ts`**

```typescript
import { defineStore } from 'pinia'

interface JobEntry {
  jobName: string
  level: number
}

interface FriendWithJobs {
  username: string
  jobs: JobEntry[]
}

interface PendingRequest {
  id: string
  fromUsername: string
}

interface FriendsStateShape {
  friends: FriendWithJobs[]
  pendingRequests: PendingRequest[]
  myJobs: JobEntry[]
}

export const useFriendsStore = defineStore('friends', {
  state: (): FriendsStateShape => ({
    friends: [],
    pendingRequests: [],
    myJobs: []
  }),
  actions: {
    async refresh(): Promise<void> {
      this.friends = await window.wakfuApi.getFriends()
      this.pendingRequests = await window.wakfuApi.getPendingFriendRequests()
      this.myJobs = await window.wakfuApi.getMyJobs()
    },
    async sendRequest(friendCode: string): Promise<void> {
      await window.wakfuApi.sendFriendRequest(friendCode)
    },
    async accept(id: string): Promise<void> {
      await window.wakfuApi.acceptFriendRequest(id)
      await this.refresh()
    },
    async reject(id: string): Promise<void> {
      await window.wakfuApi.rejectFriendRequest(id)
      await this.refresh()
    },
    async updateJobManual(jobName: string, level: number): Promise<void> {
      const updated = await window.wakfuApi.updateJobManual(jobName, level)
      if (updated) {
        this.myJobs = this.myJobs.map((j) => (j.jobName === jobName ? updated : j))
      }
    }
  }
})
```

- [ ] **Step 2: Typecheck**

Run: `npx vue-tsc --noEmit -p tsconfig.json`
Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add src/renderer/stores/friends.ts
git commit -m "client: add friends Pinia store"
```

---

### Task 11: Login and Register views

**Files:**
- Create: `src/renderer/views/LoginView.vue`
- Create: `src/renderer/views/RegisterView.vue`
- Modify: `src/renderer/router.ts`

**Interfaces:**
- Consumes: `useAuthStore()` (Task 9), `JOB_NAMES` is duplicated as an inline template list here
  matching `src/main/jobs.ts`'s exact names (renderer can't import from `src/main/` — Electron
  process boundary — so the 13 names are written directly into `RegisterView.vue`, matching Global
  Constraints' "must stay byte-for-byte identical" requirement).
- Produces: `/login` and `/register` routes.

- [ ] **Step 1: Write `src/renderer/views/LoginView.vue`**

```vue
<template>
  <div class="auth-page">
    <div class="panel auth-panel">
      <h1 class="h1">Connexion</h1>
      <p class="subtitle">Connecte-toi pour voir tes amis et synchroniser tes métiers</p>

      <form @submit.prevent="submit">
        <label class="field-label">Pseudo ou email</label>
        <input v-model="usernameOrEmail" class="field full-input" type="text" required />

        <label class="field-label">Mot de passe</label>
        <input v-model="password" class="field full-input" type="password" required />

        <p v-if="authStore.errorMessage" class="error-text">{{ authStore.errorMessage }}</p>

        <button class="primary-btn" type="submit" :disabled="submitting">Se connecter</button>
      </form>

      <p class="switch-link">
        Pas de compte ? <RouterLink to="/register">S'inscrire</RouterLink>
      </p>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref } from 'vue'
import { useRouter } from 'vue-router'
import { useAuthStore } from '../stores/auth'

const authStore = useAuthStore()
const router = useRouter()

const usernameOrEmail = ref('')
const password = ref('')
const submitting = ref(false)

async function submit(): Promise<void> {
  submitting.value = true
  const success = await authStore.login({ usernameOrEmail: usernameOrEmail.value, password: password.value })
  submitting.value = false
  if (success) router.push('/friends')
}
</script>

<style scoped>
.auth-page {
  display: flex;
  justify-content: center;
  padding-top: 40px;
}

.auth-panel {
  width: 380px;
}

.h1 {
  font-family: 'Cinzel', serif;
  font-weight: 700;
  font-size: 24px;
  color: var(--text-primary);
  margin: 0;
}

.subtitle {
  font-size: 13px;
  color: var(--text-secondary);
  margin: 6px 0 20px 0;
}

.field-label {
  display: block;
  font-size: 12.5px;
  color: var(--text-secondary);
  font-weight: 600;
  margin: 14px 0 6px 0;
}

.full-input {
  width: 100%;
  box-sizing: border-box;
}

.error-text {
  color: var(--danger, #d9534f);
  font-size: 13px;
  margin: 12px 0 0 0;
}

.primary-btn {
  width: 100%;
  margin-top: 20px;
  background: var(--accent);
  color: var(--on-accent);
  border: none;
  border-radius: 7px;
  padding: 11px 16px;
  font-size: 14px;
  font-weight: 700;
  cursor: pointer;
}

.primary-btn:disabled {
  opacity: 0.6;
  cursor: not-allowed;
}

.switch-link {
  text-align: center;
  font-size: 13px;
  color: var(--text-secondary);
  margin-top: 16px;
}
</style>
```

- [ ] **Step 2: Write `src/renderer/views/RegisterView.vue`**

```vue
<template>
  <div class="auth-page">
    <div class="panel auth-panel">
      <h1 class="h1">Inscription</h1>
      <p class="subtitle">{{ step === 1 ? 'Étape 1 : identifiants' : 'Étape 2 : niveaux de métiers' }}</p>

      <form v-if="step === 1" @submit.prevent="goToStep2">
        <label class="field-label">Pseudo</label>
        <input v-model="username" class="field full-input" type="text" required minlength="3" />

        <label class="field-label">Email</label>
        <input v-model="email" class="field full-input" type="email" required />

        <label class="field-label">Mot de passe</label>
        <input v-model="password" class="field full-input" type="password" required minlength="8" />

        <label class="field-label">Confirmer le mot de passe</label>
        <input v-model="passwordConfirm" class="field full-input" type="password" required minlength="8" />

        <p v-if="step1Error" class="error-text">{{ step1Error }}</p>

        <button class="primary-btn" type="submit">Suivant</button>
      </form>

      <form v-else @submit.prevent="submit">
        <div v-for="jobName in JOB_NAMES" :key="jobName" class="job-row">
          <label class="job-label">{{ jobName }}</label>
          <input
            v-model.number="jobLevels[jobName]"
            class="field job-input"
            type="number"
            min="0"
            max="155"
          />
        </div>

        <p v-if="authStore.errorMessage" class="error-text">{{ authStore.errorMessage }}</p>

        <div class="button-row">
          <button class="secondary-btn" type="button" @click="step = 1">Retour</button>
          <button class="primary-btn" type="submit" :disabled="submitting">S'inscrire</button>
        </div>
      </form>

      <p class="switch-link">
        Déjà un compte ? <RouterLink to="/login">Se connecter</RouterLink>
      </p>
    </div>
  </div>
</template>

<script setup lang="ts">
import { reactive, ref } from 'vue'
import { useRouter } from 'vue-router'
import { useAuthStore } from '../stores/auth'

const JOB_NAMES = [
  'Bûcheron',
  'Mineur',
  'Trappeur',
  'Pêcheur',
  'Paysan',
  'Alchimiste',
  'Forgeron',
  'Bijoutier',
  'Sculpteur',
  'Tailleur',
  'Cordonnier',
  'Façonneur',
  'Boulanger'
] as const

const authStore = useAuthStore()
const router = useRouter()

const step = ref<1 | 2>(1)
const username = ref('')
const email = ref('')
const password = ref('')
const passwordConfirm = ref('')
const step1Error = ref<string | null>(null)
const submitting = ref(false)

const jobLevels = reactive<Record<string, number>>(
  Object.fromEntries(JOB_NAMES.map((name) => [name, 0]))
)

function goToStep2(): void {
  if (password.value !== passwordConfirm.value) {
    step1Error.value = 'Les mots de passe ne correspondent pas'
    return
  }
  step1Error.value = null
  step.value = 2
}

async function submit(): Promise<void> {
  submitting.value = true
  const success = await authStore.register({
    username: username.value,
    email: email.value,
    password: password.value,
    jobs: { ...jobLevels }
  })
  submitting.value = false
  if (success) router.push('/friends')
}
</script>

<style scoped>
.auth-page {
  display: flex;
  justify-content: center;
  padding-top: 40px;
}

.auth-panel {
  width: 420px;
}

.h1 {
  font-family: 'Cinzel', serif;
  font-weight: 700;
  font-size: 24px;
  color: var(--text-primary);
  margin: 0;
}

.subtitle {
  font-size: 13px;
  color: var(--text-secondary);
  margin: 6px 0 20px 0;
}

.field-label {
  display: block;
  font-size: 12.5px;
  color: var(--text-secondary);
  font-weight: 600;
  margin: 14px 0 6px 0;
}

.full-input {
  width: 100%;
  box-sizing: border-box;
}

.job-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  padding: 6px 0;
}

.job-label {
  font-size: 13.5px;
  color: var(--text-primary);
}

.job-input {
  width: 80px;
  text-align: right;
}

.error-text {
  color: var(--danger, #d9534f);
  font-size: 13px;
  margin: 12px 0 0 0;
}

.button-row {
  display: flex;
  gap: 10px;
  margin-top: 20px;
}

.primary-btn {
  flex: 1;
  background: var(--accent);
  color: var(--on-accent);
  border: none;
  border-radius: 7px;
  padding: 11px 16px;
  font-size: 14px;
  font-weight: 700;
  cursor: pointer;
}

.primary-btn:disabled {
  opacity: 0.6;
  cursor: not-allowed;
}

.secondary-btn {
  background: transparent;
  color: var(--accent);
  border: 1px solid color-mix(in srgb, var(--accent) 40%, transparent);
  border-radius: 7px;
  padding: 11px 16px;
  font-size: 14px;
  font-weight: 700;
  cursor: pointer;
}

.switch-link {
  text-align: center;
  font-size: 13px;
  color: var(--text-secondary);
  margin-top: 16px;
}
</style>
```

- [ ] **Step 3: Modify `src/renderer/router.ts`**

```typescript
import { createRouter, createWebHashHistory } from 'vue-router'
import ServerStatusView from './views/ServerStatusView.vue'
import ExploitsView from './views/ExploitsView.vue'
import TimersView from './views/TimersView.vue'
import HistoryView from './views/HistoryView.vue'
import SettingsView from './views/SettingsView.vue'
import AdminView from './views/AdminView.vue'
import LoginView from './views/LoginView.vue'
import RegisterView from './views/RegisterView.vue'
import FriendsView from './views/FriendsView.vue'

export const router = createRouter({
  history: createWebHashHistory(),
  routes: [
    { path: '/', component: ServerStatusView },
    { path: '/exploits', component: ExploitsView },
    { path: '/timers', component: TimersView },
    { path: '/history', component: HistoryView },
    { path: '/settings', component: SettingsView },
    { path: '/admin', component: AdminView },
    { path: '/login', component: LoginView },
    { path: '/register', component: RegisterView },
    { path: '/friends', component: FriendsView }
  ]
})
```

(`FriendsView` is created in Task 12 — this router file references it one task early since both
edits land in the same file area; if executing tasks out of order, Task 11's typecheck step will
fail until Task 12 also lands. Execute in order to avoid this.)

- [ ] **Step 4: Typecheck**

Run: `npx vue-tsc --noEmit -p tsconfig.json`
Expected: FAILS at this point specifically because `FriendsView.vue` doesn't exist yet (Task 12
creates it) — this is expected; do not attempt to fix it here. Proceed directly to Task 12, then
run the typecheck again as part of Task 12's own verification step.

- [ ] **Step 5: Commit**

```bash
git add src/renderer/views/LoginView.vue src/renderer/views/RegisterView.vue src/renderer/router.ts
git commit -m "client: add login and register views"
```

---

### Task 12: Friends view

**Files:**
- Create: `src/renderer/views/FriendsView.vue`

**Interfaces:**
- Consumes: `useFriendsStore()` (Task 10), `useAuthStore()` (Task 9).
- Produces: the `/friends` route target referenced by Task 11's router change.

- [ ] **Step 1: Write `src/renderer/views/FriendsView.vue`**

```vue
<template>
  <div>
    <div class="page-header">
      <h1 class="h1">Amis</h1>
      <p class="subtitle">
        Ton code ami : <span class="friend-code">{{ authStore.user?.friendCode }}</span>
      </p>
    </div>

    <div class="panel">
      <h2 class="h2">Ajouter un ami</h2>
      <form class="add-friend-row" @submit.prevent="sendRequest">
        <input v-model="friendCodeInput" class="field full-input" type="text" placeholder="WC-XXXXXX" />
        <button class="primary-btn" type="submit">Envoyer</button>
      </form>
      <p v-if="sendError" class="error-text">{{ sendError }}</p>
    </div>

    <div class="panel" v-if="friendsStore.pendingRequests.length > 0">
      <h2 class="h2">Demandes reçues</h2>
      <div v-for="req in friendsStore.pendingRequests" :key="req.id" class="request-row">
        <span>{{ req.fromUsername }}</span>
        <div class="request-actions">
          <button class="secondary-btn" @click="friendsStore.accept(req.id)">Accepter</button>
          <button class="secondary-btn" @click="friendsStore.reject(req.id)">Refuser</button>
        </div>
      </div>
    </div>

    <div class="panel">
      <h2 class="h2">Mes métiers</h2>
      <div v-for="job in friendsStore.myJobs" :key="job.jobName" class="job-row">
        <span class="job-label">{{ job.jobName }}</span>
        <input
          class="field job-input"
          type="number"
          min="0"
          max="155"
          :value="job.level"
          @change="onManualJobChange(job.jobName, $event)"
        />
      </div>
    </div>

    <div class="panel">
      <h2 class="h2">Liste d'amis</h2>
      <p v-if="friendsStore.friends.length === 0" class="subtitle">Aucun ami pour le moment.</p>
      <div v-for="friend in friendsStore.friends" :key="friend.username" class="friend-block">
        <h3 class="friend-name">{{ friend.username }}</h3>
        <div v-for="job in friend.jobs" :key="job.jobName" class="job-row">
          <span class="job-label">{{ job.jobName }}</span>
          <span class="job-value">{{ job.level }}</span>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { onMounted, ref } from 'vue'
import { useAuthStore } from '../stores/auth'
import { useFriendsStore } from '../stores/friends'

const authStore = useAuthStore()
const friendsStore = useFriendsStore()

const friendCodeInput = ref('')
const sendError = ref<string | null>(null)

onMounted(() => {
  friendsStore.refresh()
})

async function sendRequest(): Promise<void> {
  sendError.value = null
  try {
    await friendsStore.sendRequest(friendCodeInput.value)
    friendCodeInput.value = ''
    await friendsStore.refresh()
  } catch {
    sendError.value = "Impossible d'envoyer la demande (code invalide ?)"
  }
}

function onManualJobChange(jobName: string, event: Event): void {
  const level = Number((event.target as HTMLInputElement).value)
  friendsStore.updateJobManual(jobName, level)
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

.friend-code {
  font-weight: 700;
  color: var(--gold);
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

.add-friend-row {
  display: flex;
  gap: 10px;
}

.full-input {
  flex: 1;
}

.error-text {
  color: var(--danger, #d9534f);
  font-size: 13px;
  margin: 10px 0 0 0;
}

.primary-btn {
  background: var(--accent);
  color: var(--on-accent);
  border: none;
  border-radius: 7px;
  padding: 10px 16px;
  font-size: 13.5px;
  font-weight: 700;
  cursor: pointer;
  white-space: nowrap;
}

.secondary-btn {
  background: transparent;
  color: var(--accent);
  border: 1px solid color-mix(in srgb, var(--accent) 40%, transparent);
  border-radius: 7px;
  padding: 8px 14px;
  font-size: 13px;
  font-weight: 700;
  cursor: pointer;
}

.request-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 8px 0;
  border-bottom: 1px solid var(--border);
}

.request-row:last-child {
  border-bottom: none;
}

.request-actions {
  display: flex;
  gap: 8px;
}

.job-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  padding: 6px 0;
}

.job-label {
  font-size: 13.5px;
  color: var(--text-primary);
}

.job-value {
  font-size: 13.5px;
  font-weight: 700;
  color: var(--text-secondary);
}

.job-input {
  width: 80px;
  text-align: right;
}

.friend-block {
  padding: 12px 0;
  border-bottom: 1px solid var(--border);
}

.friend-block:last-child {
  border-bottom: none;
}

.friend-name {
  font-family: 'Cinzel', serif;
  font-size: 15px;
  color: var(--text-primary);
  margin: 0 0 8px 0;
}
</style>
```

- [ ] **Step 2: Typecheck**

Run: `npx vue-tsc --noEmit -p tsconfig.json`
Expected: no errors (this also confirms Task 11's router change is now valid).

- [ ] **Step 3: Commit**

```bash
git add src/renderer/views/FriendsView.vue
git commit -m "client: add friends view with job grid and requests"
```

---

### Task 13: NavBar auth-aware links

**Files:**
- Modify: `src/renderer/components/NavBar.vue`

**Interfaces:**
- Consumes: `useAuthStore()` (Task 9).
- Produces: nothing new — pure UI wiring.

- [ ] **Step 1: Modify `src/renderer/components/NavBar.vue`**

Add the import and store instance in `<script setup>`:

```typescript
import { useAuthStore } from '../stores/auth'
```

```typescript
const authStore = useAuthStore()
```

In the `<template>`, insert this block after the existing `<RouterLink to="/admin" ...>` link and
before the `<div class="server-pill">`:

```html
    <RouterLink
      v-if="authStore.isLoggedIn"
      to="/friends"
      class="nav-link"
      active-class="nav-link-active"
    >
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><circle cx="9" cy="8" r="3.2" /><path d="M3.5 19c0-3 2.5-5.5 5.5-5.5S14.5 16 14.5 19" /><circle cx="17" cy="9" r="2.6" /><path d="M15.5 13.2c2.3.3 4 2.4 4 5.3" /></svg>
      <span>Amis</span>
    </RouterLink>

    <RouterLink v-if="!authStore.isLoggedIn" to="/login" class="nav-link" active-class="nav-link-active">
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M15 3.5h3.5a1 1 0 0 1 1 1v15a1 1 0 0 1-1 1H15" /><path d="M10 8l5 4-5 4" /><path d="M15 12H4" /></svg>
      <span>Connexion</span>
    </RouterLink>
    <button v-else class="nav-link logout-link" @click="authStore.logout()">
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M15 3.5h3.5a1 1 0 0 1 1 1v15a1 1 0 0 1-1 1H15" /><path d="M4 12h11M10 8l-4 4 4 4" /></svg>
      <span>Déconnexion ({{ authStore.user?.username }})</span>
    </button>
```

Add this rule in `<style scoped>`, after the existing `.nav-link-active` rule:

```css
.logout-link {
  border: none;
  font-family: inherit;
}
```

- [ ] **Step 2: Typecheck**

Run: `npx vue-tsc --noEmit -p tsconfig.json`
Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add src/renderer/components/NavBar.vue
git commit -m "client: add auth-aware Amis/login/logout links to NavBar"
```

---

### Task 14: Load auth session on app startup

**Files:**
- Modify: `src/renderer/App.vue` (or wherever `useAppStore().load()` is currently called on mount
  — locate this call first; if it's in `App.vue`'s `onMounted`, add the auth load call alongside
  it)

**Interfaces:**
- Consumes: `useAuthStore().load()` (Task 9).
- Produces: the auth store is populated from the persisted session before the user interacts with
  the app, so `NavBar`'s login/logout state is correct from first paint.

- [ ] **Step 1: Locate the existing app-mount config load**

Run: `grep -rn "useAppStore().load\|appStore.load" src/renderer/`

This finds the file (expected: `src/renderer/App.vue`) and line calling `useAppStore().load()` on
mount. Read that file before editing.

- [ ] **Step 2: Add the auth store load alongside it**

In that file's `<script setup>`, add:

```typescript
import { useAuthStore } from './stores/auth'
```

(adjust the relative path `./stores/auth` to match the file's actual location relative to
`src/renderer/stores/`)

Find the existing `onMounted(() => { ... appStore.load() ... })` (or equivalent) and add a sibling
call:

```typescript
const authStore = useAuthStore()
```

```typescript
  authStore.load()
```

inside the same `onMounted` block, alongside the existing `appStore.load()` call — do not create a
second `onMounted`.

- [ ] **Step 3: Typecheck**

Run: `npx vue-tsc --noEmit -p tsconfig.json`
Expected: no errors.

- [ ] **Step 4: Commit**

```bash
git add src/renderer/App.vue
git commit -m "client: load persisted auth session on app startup"
```

---

### Task 15: Full verification pass

**Files:** none (verification only).

**Interfaces:** none.

- [ ] **Step 1: Run the full client test suite**

Run: `npm run test`
Expected: all PASS (existing tests + new parser/store/apiClient/jobs tests from this plan).

- [ ] **Step 2: Typecheck both main and renderer**

Run: `npx tsc --noEmit -p tsconfig.main.json && npx vue-tsc --noEmit -p tsconfig.json`
Expected: no errors.

- [ ] **Step 3: Full build**

Run: `npm run build`
Expected: succeeds, no errors.

- [ ] **Step 4: Manual smoke test**

With the local backend running (`cd server && npm start`, `DATABASE_URL` pointing at the Docker
Postgres from the backend plan) and `src/main/apiClient.ts`'s `DEFAULT_API_BASE_URL` at its default
`http://localhost:3000`:

Run: `npm run build && npx electron dist/main/main.js` (unset `ELECTRON_RUN_AS_NODE` first if set —
see CLAUDE.md Gotchas)

Manually verify: register a new account through the two-step form, confirm redirect to `/friends`
and the friend code is displayed; log out via NavBar; log back in with the same credentials; from a
second account (or by manually calling the API), send a friend request to the first account's
friend code and confirm it appears under "Demandes reçues"; accept it and confirm the friend
appears with their job levels; manually edit a job level and confirm it persists after a refresh.

- [ ] **Step 5: Report results**

Summarize pass/fail for each of the above steps. Do not mark this task complete if any step failed
— stop and report the failure instead.

---

## Post-plan note

This plan wires the full client-side flow against `DEFAULT_API_BASE_URL =
'http://localhost:3000'`. Once the backend is deployed (see `server/README.md`), update that one
constant in `src/main/apiClient.ts` to the real deployed URL and rebuild — no other code changes
are needed anywhere in this plan's output.
