# Client — Job Catalog Fix, Categories, and Icons Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the client's incorrect job name list with the 14 real Wakfu professions (fixing
automatic log-based level detection for those jobs), add per-job icons, and group every job grid
in the UI (registration, admin account editing, friends) into "Récolte"/"Artisanat" sections.

**Architecture:** `src/main/jobs.ts` gains the same typed `JOBS` array as the backend plan. A new
`src/renderer/jobIcons.ts` maps job name → bundled `.webp` icon (already copied into
`src/renderer/assets/jobs/`). The three views that render a job grid (`RegisterView.vue`,
`AdminUsersPanel.vue`, `FriendsView.vue`) import `JOBS` instead of redefining their own name list,
and render two labeled sub-sections instead of one flat list.

**Tech Stack:** Same as the rest of the client — TypeScript, Vue 3 SFCs, Vite asset imports,
vitest.

## Global Constraints

- The 14 real job names, exact spelling — must be byte-for-byte identical to the backend's list
  (`docs/superpowers/plans/2026-08-12-backend-job-catalog-fix.md`), since the backend rejects any
  name it doesn't recognize: `Paysan, Pêcheur, Trappeur, Mineur, Herboriste, Forestier` (category
  `recolte`) and `Ébéniste, Tailleur, Bijoutier, Armurier, Maître d'Armes, Maroquinier, Cuisinier,
  Boulanger` (category `artisanat`).
- `JOB_NAMES` stays exported with the same type (`readonly string[]`) — `isValidJobName`,
  `clampLevel`, and `jobLevelUp.ts`'s parser keep working unchanged.
- Icon `.webp` files are already present at `src/renderer/assets/jobs/*.webp` (copied in a prior
  session, filenames without accents/apostrophes: `Paysan.webp`, `Pecheur.webp`, `Trappeur.webp`,
  `Mineur.webp`, `Herboriste.webp`, `Forestier.webp`, `Ebeniste.webp`, `Tailleur.webp`,
  `Bijoutier.webp`, `Armurier.webp`, `MaitredArmes.webp`, `Maroquinier.webp`, `Cuisinier.webp`,
  `Boulanger.webp`) — this plan does not copy them again, only wires them up.
- No new npm dependencies — Vite handles `.webp` imports natively as asset URLs.
- This plan does not touch the backend (`server/`) — that's a separate plan
  (`2026-08-12-backend-job-catalog-fix.md`). Execution order between the two doesn't matter; the
  job name contract is fixed by the spec, not discovered by either side.

---

## File Structure

```
src/main/
  jobs.ts                        # MODIFY — JOB_NAMES replaced with real names, JOBS added

src/renderer/
  jobIcons.ts                      # NEW — job name -> icon asset URL map
  views/
    RegisterView.vue                 # MODIFY — import JOBS, group by category, add icons
    FriendsView.vue                   # MODIFY — group "Mes métiers"/friends' jobs by category, add icons
  components/
    AdminUsersPanel.vue                # MODIFY — import JOBS, group by category, add icons

tests/
  main/
    jobs.test.ts                        # MODIFY — assert real names, category mapping
  parsers/
    fixtures.ts                          # MODIFY — replace 'Bûcheron' fixture with a real job name
    jobLevelUp.test.ts                    # MODIFY — update the multi-level-up test's expected job name
```

**Interfaces summary (for cross-task reference):**
- `src/main/jobs.ts` exports (new): `JobCategory = 'recolte' | 'artisanat'`,
  `JobDefinition = { name: string; category: JobCategory }`, `JOBS: readonly JobDefinition[]`.
  Unchanged: `JOB_NAMES: readonly string[]`, `isValidJobName(name): boolean`,
  `clampLevel(level): number`.
- `src/renderer/jobIcons.ts` exports `JOB_ICONS: Record<string, string>` — maps every name in
  `JOBS` to an imported icon URL. Used by Task 3 (RegisterView), Task 4 (AdminUsersPanel), Task 5
  (FriendsView).

---

### Task 1: Replace the job list with real names and add categories

**Files:**
- Modify: `src/main/jobs.ts`
- Modify: `tests/main/jobs.test.ts`

**Interfaces:**
- Consumes: nothing.
- Produces: `JOBS`, updated `JOB_NAMES` — used by Task 2 (parser fixtures), Task 3-5 (views import
  `JOBS` directly).

- [ ] **Step 1: Write the failing test**

Replace the entire contents of `tests/main/jobs.test.ts`:

```typescript
import { describe, it, expect } from 'vitest'
import { JOBS, JOB_NAMES, isValidJobName, clampLevel } from '../../src/main/jobs'

describe('jobs', () => {
  it('lists exactly the 14 real Wakfu professions', () => {
    expect(JOB_NAMES).toEqual([
      'Paysan',
      'Pêcheur',
      'Trappeur',
      'Mineur',
      'Herboriste',
      'Forestier',
      'Ébéniste',
      'Tailleur',
      'Bijoutier',
      'Armurier',
      "Maître d'Armes",
      'Maroquinier',
      'Cuisinier',
      'Boulanger'
    ])
    expect(JOB_NAMES.length).toBe(14)
  })

  it('no longer accepts the old incorrect job names', () => {
    expect(isValidJobName('Bûcheron')).toBe(false)
    expect(isValidJobName('Alchimiste')).toBe(false)
    expect(isValidJobName('Forgeron')).toBe(false)
    expect(isValidJobName('Sculpteur')).toBe(false)
    expect(isValidJobName('Cordonnier')).toBe(false)
    expect(isValidJobName('Façonneur')).toBe(false)
  })

  it('accepts a known real job name', () => {
    expect(isValidJobName('Trappeur')).toBe(true)
    expect(isValidJobName("Maître d'Armes")).toBe(true)
  })

  it('rejects an unknown job name', () => {
    expect(isValidJobName('NotAJob')).toBe(false)
  })

  it('clamps levels within 0 and 155', () => {
    expect(clampLevel(-5)).toBe(0)
    expect(clampLevel(200)).toBe(155)
    expect(clampLevel(80)).toBe(80)
  })

  it('categorizes every job as recolte or artisanat', () => {
    const recolte = JOBS.filter((j) => j.category === 'recolte').map((j) => j.name)
    const artisanat = JOBS.filter((j) => j.category === 'artisanat').map((j) => j.name)

    expect(recolte).toEqual(['Paysan', 'Pêcheur', 'Trappeur', 'Mineur', 'Herboriste', 'Forestier'])
    expect(artisanat).toEqual([
      'Ébéniste',
      'Tailleur',
      'Bijoutier',
      'Armurier',
      "Maître d'Armes",
      'Maroquinier',
      'Cuisinier',
      'Boulanger'
    ])
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/main/jobs.test.ts`
Expected: FAIL — `JOBS` is not exported yet, and `JOB_NAMES` still has the old wrong names.

- [ ] **Step 3: Write `src/main/jobs.ts`**

```typescript
export type JobCategory = 'recolte' | 'artisanat'

export interface JobDefinition {
  name: string
  category: JobCategory
}

export const JOBS: readonly JobDefinition[] = [
  { name: 'Paysan', category: 'recolte' },
  { name: 'Pêcheur', category: 'recolte' },
  { name: 'Trappeur', category: 'recolte' },
  { name: 'Mineur', category: 'recolte' },
  { name: 'Herboriste', category: 'recolte' },
  { name: 'Forestier', category: 'recolte' },
  { name: 'Ébéniste', category: 'artisanat' },
  { name: 'Tailleur', category: 'artisanat' },
  { name: 'Bijoutier', category: 'artisanat' },
  { name: 'Armurier', category: 'artisanat' },
  { name: "Maître d'Armes", category: 'artisanat' },
  { name: 'Maroquinier', category: 'artisanat' },
  { name: 'Cuisinier', category: 'artisanat' },
  { name: 'Boulanger', category: 'artisanat' }
] as const

export const JOB_NAMES: readonly string[] = JOBS.map((j) => j.name)

export function isValidJobName(name: string): boolean {
  return (JOB_NAMES as readonly string[]).includes(name)
}

export function clampLevel(level: number): number {
  return Math.min(155, Math.max(0, level))
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run tests/main/jobs.test.ts`
Expected: PASS (6 tests).

- [ ] **Step 5: Commit**

```bash
git add src/main/jobs.ts tests/main/jobs.test.ts
git commit -m "client: replace job catalog with real Wakfu professions and categories"
```

---

### Task 2: Fix parser fixtures using the old job name

**Files:**
- Modify: `tests/parsers/fixtures.ts`
- Modify: `tests/parsers/jobLevelUp.test.ts`

**Interfaces:**
- Consumes: `isValidJobName` (Task 1) — indirectly, via `parseJobLevelUp` now rejecting
  `'Bûcheron'`.
- Produces: nothing new — fixes fixtures broken by Task 1.

- [ ] **Step 1: Run the parser test suite to confirm it now fails**

Run: `npx vitest run tests/parsers/jobLevelUp.test.ts`
Expected: `extracts a multi-level-up gain` FAILS — `JOB_LEVEL_UP_LINES.bucheronMultiLevel` mentions
"Bûcheron", which `isValidJobName` now rejects, so `parseJobLevelUp` returns `null` instead of the
expected event.

- [ ] **Step 2: Fix the fixture in `tests/parsers/fixtures.ts`**

Find:

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

Replace with:

```typescript
export const JOB_LEVEL_UP_LINES = {
  trappeurSingleLevel:
    ' INFO 20:04:47,496 [AWT-EventQueue-0] (aPV:174) - [Information (jeu)] Trappeur : +1 041 points d\'XP.  +1 niveau. Prochain niveau dans : 20 796.',
  mineurMultiLevel:
    ' INFO 09:12:03,001 [AWT-EventQueue-0] (aPV:174) - [Information (jeu)] Mineur : +12 500 points d\'XP.  +3 niveaux. Prochain niveau dans : 5 200.',
  unknownJob:
    ' INFO 11:00:00,000 [AWT-EventQueue-0] (aPV:174) - [Information (jeu)] Astrologue : +500 points d\'XP.  +1 niveau. Prochain niveau dans : 100.'
}
```

- [ ] **Step 3: Update `tests/parsers/jobLevelUp.test.ts`**

Find:

```typescript
  it('extracts a multi-level-up gain', () => {
    const event = parseJobLevelUp(JOB_LEVEL_UP_LINES.bucheronMultiLevel)
    expect(event).toEqual({
      type: 'job-level-up',
      jobName: 'Bûcheron',
      levelsGained: 3,
      timestamp: '09:12:03,001'
    })
  })
```

Replace with:

```typescript
  it('extracts a multi-level-up gain', () => {
    const event = parseJobLevelUp(JOB_LEVEL_UP_LINES.mineurMultiLevel)
    expect(event).toEqual({
      type: 'job-level-up',
      jobName: 'Mineur',
      levelsGained: 3,
      timestamp: '09:12:03,001'
    })
  })
```

- [ ] **Step 4: Run the parser test suite to verify it passes**

Run: `npx vitest run tests/parsers`
Expected: all PASS.

- [ ] **Step 5: Commit**

```bash
git add tests/parsers/fixtures.ts tests/parsers/jobLevelUp.test.ts
git commit -m "client: fix parser fixtures using an old incorrect job name"
```

---

### Task 3: Job icon map

**Files:**
- Create: `src/renderer/jobIcons.ts`

**Interfaces:**
- Consumes: the 14 `.webp` files already at `src/renderer/assets/jobs/*.webp`; `JOBS` (Task 1, for
  the type of the keys, though the map is written by hand since filenames don't match display
  names mechanically).
- Produces: `JOB_ICONS: Record<string, string>` — used by Task 4 (RegisterView), Task 5
  (AdminUsersPanel), Task 6 (FriendsView).

No test for this task — it's a static asset-to-URL mapping with no logic to verify beyond "it
compiles", consistent with the rest of this codebase not testing visual assets (see spec's "Hors
périmètre").

- [ ] **Step 1: Verify the icon files are present**

Run: `ls src/renderer/assets/jobs/`
Expected: exactly these 14 files (order may vary): `Armurier.webp`, `Bijoutier.webp`,
`Boulanger.webp`, `Cuisinier.webp`, `Ebeniste.webp`, `Forestier.webp`, `Herboriste.webp`,
`MaitredArmes.webp`, `Maroquinier.webp`, `Mineur.webp`, `Paysan.webp`, `Pecheur.webp`,
`Tailleur.webp`, `Trappeur.webp`. If any are missing, stop and ask — this plan does not create
them.

- [ ] **Step 2: Write `src/renderer/jobIcons.ts`**

```typescript
import paysan from './assets/jobs/Paysan.webp'
import pecheur from './assets/jobs/Pecheur.webp'
import trappeur from './assets/jobs/Trappeur.webp'
import mineur from './assets/jobs/Mineur.webp'
import herboriste from './assets/jobs/Herboriste.webp'
import forestier from './assets/jobs/Forestier.webp'
import ebeniste from './assets/jobs/Ebeniste.webp'
import tailleur from './assets/jobs/Tailleur.webp'
import bijoutier from './assets/jobs/Bijoutier.webp'
import armurier from './assets/jobs/Armurier.webp'
import maitredarmes from './assets/jobs/MaitredArmes.webp'
import maroquinier from './assets/jobs/Maroquinier.webp'
import cuisinier from './assets/jobs/Cuisinier.webp'
import boulanger from './assets/jobs/Boulanger.webp'

export const JOB_ICONS: Record<string, string> = {
  Paysan: paysan,
  Pêcheur: pecheur,
  Trappeur: trappeur,
  Mineur: mineur,
  Herboriste: herboriste,
  Forestier: forestier,
  Ébéniste: ebeniste,
  Tailleur: tailleur,
  Bijoutier: bijoutier,
  Armurier: armurier,
  "Maître d'Armes": maitredarmes,
  Maroquinier: maroquinier,
  Cuisinier: cuisinier,
  Boulanger: boulanger
}
```

- [ ] **Step 3: Typecheck**

Run: `npx vue-tsc --noEmit -p tsconfig.json`
Expected: no errors. (Vite/Vue's TS setup resolves `.webp` imports as `string` via its built-in
asset type shims — if this step errors with "Cannot find module '*.webp' or its corresponding type
declarations", check `src/renderer/vite-env.d.ts` or equivalent for an asset type declaration file
already used elsewhere in this project for other image imports before adding one.)

- [ ] **Step 4: Commit**

```bash
git add src/renderer/jobIcons.ts
git commit -m "client: add job icon asset map"
```

---

### Task 4: Group RegisterView's job grid by category with icons

**Files:**
- Modify: `src/renderer/views/RegisterView.vue`

**Interfaces:**
- Consumes: `JOBS` (Task 1), `JOB_ICONS` (Task 3).
- Produces: nothing further downstream — UI leaf.

- [ ] **Step 1: Modify `src/renderer/views/RegisterView.vue`**

Find the step-2 form's job grid:

```html
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
```

Replace with:

```html
      <form v-else @submit.prevent="submit">
        <h3 class="category-label">Récolte</h3>
        <div v-for="job in recolteJobs" :key="job.name" class="job-row">
          <img :src="JOB_ICONS[job.name]" :alt="job.name" class="job-icon" />
          <label class="job-label">{{ job.name }}</label>
          <input
            v-model.number="jobLevels[job.name]"
            class="field job-input"
            type="number"
            min="0"
            max="155"
          />
        </div>

        <h3 class="category-label">Artisanat</h3>
        <div v-for="job in artisanatJobs" :key="job.name" class="job-row">
          <img :src="JOB_ICONS[job.name]" :alt="job.name" class="job-icon" />
          <label class="job-label">{{ job.name }}</label>
          <input
            v-model.number="jobLevels[job.name]"
            class="field job-input"
            type="number"
            min="0"
            max="155"
          />
        </div>

        <p v-if="authStore.errorMessage" class="error-text">{{ authStore.errorMessage }}</p>
```

Find the script block's inline job list and imports:

```typescript
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
```

Replace with:

```typescript
import { computed, reactive, ref } from 'vue'
import { useRouter } from 'vue-router'
import { useAuthStore } from '../stores/auth'
import { JOBS } from '../../main/jobs'
import { JOB_ICONS } from '../jobIcons'

const authStore = useAuthStore()
const router = useRouter()

const step = ref<1 | 2>(1)
const username = ref('')
const email = ref('')
const password = ref('')
const passwordConfirm = ref('')
const step1Error = ref<string | null>(null)
const submitting = ref(false)

const recolteJobs = computed(() => JOBS.filter((j) => j.category === 'recolte'))
const artisanatJobs = computed(() => JOBS.filter((j) => j.category === 'artisanat'))

const jobLevels = reactive<Record<string, number>>(
  Object.fromEntries(JOBS.map((job) => [job.name, 0]))
)
```

The rest of the script block (`goToStep2`, `submit`) is unchanged — `submit` already does
`jobs: { ...jobLevels }`, which now has 14 real job-name keys instead of 13 wrong ones.

Add these two style rules inside `<style scoped>`, near the existing `.job-row`/`.job-label`
rules:

```css
.category-label {
  font-family: 'Cinzel', serif;
  font-weight: 600;
  font-size: 13px;
  color: var(--gold);
  margin: 18px 0 8px 0;
}

.job-icon {
  width: 26px;
  height: 26px;
  border-radius: 4px;
  flex-shrink: 0;
}
```

And modify the existing `.job-row` rule to accommodate the icon (add `gap` if not already present
at the right value — check the current rule first since it already has `gap: 12px`, which is fine
to keep as-is for icon+label+input spacing).

- [ ] **Step 2: Typecheck**

Run: `npx vue-tsc --noEmit -p tsconfig.json`
Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add src/renderer/views/RegisterView.vue
git commit -m "client: group RegisterView job grid by category, add icons"
```

---

### Task 5: Group AdminUsersPanel's job grid by category with icons

**Files:**
- Modify: `src/renderer/components/AdminUsersPanel.vue`

**Interfaces:**
- Consumes: `JOBS` (Task 1), `JOB_ICONS` (Task 3).
- Produces: nothing further downstream — UI leaf.

- [ ] **Step 1: Modify `src/renderer/components/AdminUsersPanel.vue`**

Find the edit form's job grid:

```html
    <form v-else class="edit-form" @submit.prevent="submitEdit">
      <label class="field-label">Pseudo</label>
      <input v-model="editUsername" class="field full-input" type="text" required minlength="3" />

      <label class="field-label">Email</label>
      <input v-model="editEmail" class="field full-input" type="email" required />

      <div v-for="jobName in JOB_NAMES" :key="jobName" class="job-row">
        <label class="job-label">{{ jobName }}</label>
        <input
          v-model.number="editJobLevels[jobName]"
          class="field job-input"
          type="number"
          min="0"
          max="155"
        />
      </div>

      <div class="button-row">
```

Replace with:

```html
    <form v-else class="edit-form" @submit.prevent="submitEdit">
      <label class="field-label">Pseudo</label>
      <input v-model="editUsername" class="field full-input" type="text" required minlength="3" />

      <label class="field-label">Email</label>
      <input v-model="editEmail" class="field full-input" type="email" required />

      <h3 class="category-label">Récolte</h3>
      <div v-for="job in recolteJobs" :key="job.name" class="job-row">
        <img :src="JOB_ICONS[job.name]" :alt="job.name" class="job-icon" />
        <label class="job-label">{{ job.name }}</label>
        <input
          v-model.number="editJobLevels[job.name]"
          class="field job-input"
          type="number"
          min="0"
          max="155"
        />
      </div>

      <h3 class="category-label">Artisanat</h3>
      <div v-for="job in artisanatJobs" :key="job.name" class="job-row">
        <img :src="JOB_ICONS[job.name]" :alt="job.name" class="job-icon" />
        <label class="job-label">{{ job.name }}</label>
        <input
          v-model.number="editJobLevels[job.name]"
          class="field job-input"
          type="number"
          min="0"
          max="155"
        />
      </div>

      <div class="button-row">
```

Find the script block's inline job list and imports:

```typescript
import { onMounted, reactive, ref } from 'vue'
import { useAdminUsersStore, type AdminUserView } from '../stores/adminUsers'

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

const store = useAdminUsersStore()
```

Replace with:

```typescript
import { computed, onMounted, reactive, ref } from 'vue'
import { useAdminUsersStore, type AdminUserView } from '../stores/adminUsers'
import { JOBS } from '../../main/jobs'
import { JOB_ICONS } from '../jobIcons'

const recolteJobs = computed(() => JOBS.filter((j) => j.category === 'recolte'))
const artisanatJobs = computed(() => JOBS.filter((j) => j.category === 'artisanat'))

const store = useAdminUsersStore()
```

Find the `startEdit` function's job-name loop:

```typescript
function startEdit(user: AdminUserView): void {
  editingUser.value = user
  editUsername.value = user.username
  editEmail.value = user.email
  for (const jobName of JOB_NAMES) {
    const existing = user.jobs.find((j) => j.jobName === jobName)
    editJobLevels[jobName] = existing?.level ?? 0
  }
}
```

Replace with:

```typescript
function startEdit(user: AdminUserView): void {
  editingUser.value = user
  editUsername.value = user.username
  editEmail.value = user.email
  for (const job of JOBS) {
    const existing = user.jobs.find((j) => j.jobName === job.name)
    editJobLevels[job.name] = existing?.level ?? 0
  }
}
```

Add these two style rules inside `<style scoped>`, near the existing `.job-row`/`.job-label`
rules (same rules as Task 4, this component has its own separate `<style scoped>` block so they
must be added here too, not shared):

```css
.category-label {
  font-family: 'Cinzel', serif;
  font-weight: 600;
  font-size: 13px;
  color: var(--gold);
  margin: 18px 0 8px 0;
}

.job-icon {
  width: 26px;
  height: 26px;
  border-radius: 4px;
  flex-shrink: 0;
}
```

- [ ] **Step 2: Typecheck**

Run: `npx vue-tsc --noEmit -p tsconfig.json`
Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add src/renderer/components/AdminUsersPanel.vue
git commit -m "client: group AdminUsersPanel job grid by category, add icons"
```

---

### Task 6: Group FriendsView's job displays by category with icons

**Files:**
- Modify: `src/renderer/views/FriendsView.vue`

**Interfaces:**
- Consumes: `JOBS` (Task 1), `JOB_ICONS` (Task 3), `friendsStore.myJobs`/`friend.jobs` (existing —
  `{jobName, level}[]` arrays from the backend, not guaranteed to contain all 14 jobs or be in
  category order, hence the need to look up each entry's category by name rather than assuming
  array order).

Unlike Task 4/5 (which iterate `JOBS` directly to build a fixed-size input grid), this view
iterates two backend-provided arrays (`myJobs`, and each friend's `jobs`) whose entries are
`{jobName, level}` pairs — grouping means partitioning those arrays by looking up each entry's
category in `JOBS`, not filtering `JOBS` itself.

- [ ] **Step 1: Modify `src/renderer/views/FriendsView.vue`**

Find the "Mes métiers" panel:

```html
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
```

Replace with:

```html
    <div class="panel">
      <h2 class="h2">Mes métiers</h2>
      <h3 class="category-label">Récolte</h3>
      <div v-for="job in myRecolteJobs" :key="job.jobName" class="job-row">
        <img :src="JOB_ICONS[job.jobName]" :alt="job.jobName" class="job-icon" />
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
      <h3 class="category-label">Artisanat</h3>
      <div v-for="job in myArtisanatJobs" :key="job.jobName" class="job-row">
        <img :src="JOB_ICONS[job.jobName]" :alt="job.jobName" class="job-icon" />
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
```

Find the "Liste d'amis" panel's per-friend job loop:

```html
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
```

Replace with:

```html
    <div class="panel">
      <h2 class="h2">Liste d'amis</h2>
      <p v-if="friendsStore.friends.length === 0" class="subtitle">Aucun ami pour le moment.</p>
      <div v-for="friend in friendsStore.friends" :key="friend.username" class="friend-block">
        <h3 class="friend-name">{{ friend.username }}</h3>
        <h4 class="category-label">Récolte</h4>
        <div v-for="job in jobsByCategory(friend.jobs, 'recolte')" :key="job.jobName" class="job-row">
          <img :src="JOB_ICONS[job.jobName]" :alt="job.jobName" class="job-icon" />
          <span class="job-label">{{ job.jobName }}</span>
          <span class="job-value">{{ job.level }}</span>
        </div>
        <h4 class="category-label">Artisanat</h4>
        <div v-for="job in jobsByCategory(friend.jobs, 'artisanat')" :key="job.jobName" class="job-row">
          <img :src="JOB_ICONS[job.jobName]" :alt="job.jobName" class="job-icon" />
          <span class="job-label">{{ job.jobName }}</span>
          <span class="job-value">{{ job.level }}</span>
        </div>
      </div>
    </div>
```

Find the script block's imports and add the category-partitioning logic:

```typescript
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
```

Replace with:

```typescript
<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { useAuthStore } from '../stores/auth'
import { useFriendsStore } from '../stores/friends'
import { JOBS, type JobCategory } from '../../main/jobs'
import { JOB_ICONS } from '../jobIcons'

const authStore = useAuthStore()
const friendsStore = useFriendsStore()

const friendCodeInput = ref('')
const sendError = ref<string | null>(null)

const categoryByJobName = new Map(JOBS.map((job) => [job.name, job.category]))

function jobsByCategory(
  jobs: { jobName: string; level: number }[],
  category: JobCategory
): { jobName: string; level: number }[] {
  return jobs.filter((job) => categoryByJobName.get(job.jobName) === category)
}

const myRecolteJobs = computed(() => jobsByCategory(friendsStore.myJobs, 'recolte'))
const myArtisanatJobs = computed(() => jobsByCategory(friendsStore.myJobs, 'artisanat'))

onMounted(() => {
  friendsStore.refresh()
})
```

Add these two style rules inside `<style scoped>`, near the existing `.job-row`/`.job-label`
rules:

```css
.category-label {
  font-family: 'Cinzel', serif;
  font-weight: 600;
  font-size: 13px;
  color: var(--gold);
  margin: 14px 0 8px 0;
}

.job-icon {
  width: 26px;
  height: 26px;
  border-radius: 4px;
  flex-shrink: 0;
}
```

- [ ] **Step 2: Typecheck**

Run: `npx vue-tsc --noEmit -p tsconfig.json`
Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add src/renderer/views/FriendsView.vue
git commit -m "client: group FriendsView job displays by category, add icons"
```

---

### Task 7: Full verification pass

**Files:** none (verification only).

**Interfaces:** none.

- [ ] **Step 1: Run the full client test suite**

Run: `npm run test`
Expected: all PASS.

- [ ] **Step 2: Typecheck both main and renderer**

Run: `npx tsc --noEmit -p tsconfig.main.json && npx vue-tsc --noEmit -p tsconfig.json`
Expected: no errors.

- [ ] **Step 3: Full build**

Run: `npm run build`
Expected: succeeds, no errors. Confirms the `.webp` assets are correctly bundled by Vite.

- [ ] **Step 4: Manual smoke test**

Run: `npm run build && npx electron dist/main/main.js` (unset `ELECTRON_RUN_AS_NODE` first if set
— see CLAUDE.md Gotchas). Requires the backend (local or deployed) to already have Task 1-3 of
the backend plan applied, so registration/editing against the real 14-job list succeeds.

Manually verify: on the registration form's step 2, confirm exactly 14 jobs appear, split into a
"Récolte" section (6 jobs) and "Artisanat" section (8 jobs), each with a visible icon next to its
name; register a test account; log in as an admin, open the Comptes panel, edit that test
account's jobs, confirm the same grouped-with-icons layout appears; open the Amis tab and confirm
"Mes métiers" and any friend's job list are similarly grouped with icons.

- [ ] **Step 5: Report results**

Summarize pass/fail for each step above. Do not mark this task complete if any step failed.

---

## Post-plan note

If the backend plan (`2026-08-12-backend-job-catalog-fix.md`) hasn't been applied to whichever API
`DEFAULT_API_BASE_URL` in `src/main/apiClient.ts` points at, registration/job-editing will fail
with 400 "Unknown job" errors during the Task 7 manual smoke test even though this plan's own
tests pass — the backend's `isValidJobName` needs the same corrected list. Apply the backend plan
first (or confirm it's already deployed) before doing the manual smoke test, though the two plans'
own automated test suites are independent and can be run in isolation.
