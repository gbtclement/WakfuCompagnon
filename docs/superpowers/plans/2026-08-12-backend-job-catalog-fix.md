# Backend — Job Catalog Fix Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the backend's incorrect job name list with the 14 real Wakfu professions (with
category metadata), and clean up any existing `user_jobs` rows referencing the old wrong names.

**Architecture:** `server/src/jobs.ts` gains a typed `JOBS: JobDefinition[]` array (name +
category) alongside the existing flat `JOB_NAMES` (still exported, still what `isValidJobName`/
`clampLevel` use — no behavior change to those functions). A new migration deletes orphaned
`user_jobs` rows once the new list lands.

**Tech Stack:** Same as the rest of `server/` — TypeScript, `pg`, `vitest`, plain SQL migrations.

## Global Constraints

- The 14 real job names, exact spelling, one source of truth for this task:
  `Paysan, Pêcheur, Trappeur, Mineur, Herboriste, Forestier` (category `recolte`) and
  `Ébéniste, Tailleur, Bijoutier, Armurier, Maître d'Armes, Maroquinier, Cuisinier, Boulanger`
  (category `artisanat`).
- `JOB_NAMES` stays exported with the same type (`readonly string[]`) — every existing consumer
  (`isValidJobName`, `clampLevel`, all route handlers) keeps working unchanged.
- The migration is a pure `DELETE` against rows whose `job_name` isn't in the new list — no
  attempt to remap old names to new ones (the spec treats this as acceptable data loss given the
  system's young age).
- This plan does not touch the client (`src/`) — that's a separate plan
  (`2026-08-12-client-job-catalog-fix.md`). The two can be executed in either order; neither
  depends on the other's completion, since the contract (job names) is fixed by the spec, not
  discovered by one side's code.

---

## File Structure

```
server/
  src/
    jobs.ts                      # MODIFY — JOB_NAMES replaced with real names, JOBS added
  migrations/
    003_fix_job_names.sql          # NEW — deletes user_jobs rows with old/wrong job_name
  tests/
    jobs.test.ts                    # MODIFY — assert real names, category mapping
    routes/
      auth.test.ts                   # MODIFY — replace 'Bûcheron' with a real job name
```

**Interfaces summary (for cross-task reference):**
- `server/src/jobs.ts` exports (new): `JobCategory = 'recolte' | 'artisanat'`,
  `JobDefinition = { name: string; category: JobCategory }`, `JOBS: readonly JobDefinition[]`.
  Unchanged: `JOB_NAMES: readonly string[]`, `isValidJobName(name): boolean`,
  `clampLevel(level): number`.

---

### Task 1: Replace the job list with real names and add categories

**Files:**
- Modify: `server/src/jobs.ts`
- Modify: `server/tests/jobs.test.ts`

**Interfaces:**
- Consumes: nothing.
- Produces: `JOBS`, updated `JOB_NAMES` — used by Task 2 (migration references the same 14 names
  in raw SQL, kept in sync manually since SQL can't import TypeScript).

- [ ] **Step 1: Write the failing test**

Replace the entire contents of `server/tests/jobs.test.ts`:

```typescript
import { describe, it, expect } from 'vitest';
import { JOBS, JOB_NAMES, isValidJobName, clampLevel } from '../src/jobs';

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
      'Boulanger',
    ]);
    expect(JOB_NAMES.length).toBe(14);
  });

  it('no longer accepts the old incorrect job names', () => {
    expect(isValidJobName('Bûcheron')).toBe(false);
    expect(isValidJobName('Alchimiste')).toBe(false);
    expect(isValidJobName('Forgeron')).toBe(false);
    expect(isValidJobName('Sculpteur')).toBe(false);
    expect(isValidJobName('Cordonnier')).toBe(false);
    expect(isValidJobName('Façonneur')).toBe(false);
  });

  it('accepts a known real job name', () => {
    expect(isValidJobName('Trappeur')).toBe(true);
    expect(isValidJobName("Maître d'Armes")).toBe(true);
  });

  it('rejects an unknown job name', () => {
    expect(isValidJobName('NotAJob')).toBe(false);
  });

  it('clamps levels within 0 and 155', () => {
    expect(clampLevel(-5)).toBe(0);
    expect(clampLevel(200)).toBe(155);
    expect(clampLevel(80)).toBe(80);
  });

  it('categorizes every job as recolte or artisanat', () => {
    const recolte = JOBS.filter((j) => j.category === 'recolte').map((j) => j.name);
    const artisanat = JOBS.filter((j) => j.category === 'artisanat').map((j) => j.name);

    expect(recolte).toEqual(['Paysan', 'Pêcheur', 'Trappeur', 'Mineur', 'Herboriste', 'Forestier']);
    expect(artisanat).toEqual([
      'Ébéniste',
      'Tailleur',
      'Bijoutier',
      'Armurier',
      "Maître d'Armes",
      'Maroquinier',
      'Cuisinier',
      'Boulanger',
    ]);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd server && npx vitest run tests/jobs.test.ts`
Expected: FAIL — `JOBS` is not exported yet, and `JOB_NAMES` still has the old wrong names.

- [ ] **Step 3: Write `server/src/jobs.ts`**

```typescript
export type JobCategory = 'recolte' | 'artisanat';

export interface JobDefinition {
  name: string;
  category: JobCategory;
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
  { name: 'Boulanger', category: 'artisanat' },
] as const;

export const JOB_NAMES: readonly string[] = JOBS.map((j) => j.name);

export function isValidJobName(name: string): boolean {
  return (JOB_NAMES as readonly string[]).includes(name);
}

export function clampLevel(level: number): number {
  return Math.min(155, Math.max(0, level));
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd server && npx vitest run tests/jobs.test.ts`
Expected: PASS (6 tests).

- [ ] **Step 5: Commit**

```bash
git add server/src/jobs.ts server/tests/jobs.test.ts
git commit -m "server: replace job catalog with real Wakfu professions and categories"
```

---

### Task 2: Fix the `auth.test.ts` fixture using the old job name

**Files:**
- Modify: `server/tests/routes/auth.test.ts`

**Interfaces:**
- Consumes: `JOB_NAMES` (Task 1) — indirectly, via the route's `isValidJobName` validation now
  rejecting `'Bûcheron'`.
- Produces: nothing new — this task only fixes a test fixture broken by Task 1.

- [ ] **Step 1: Run the full backend test suite to confirm this test now fails**

Run: `cd server && npx vitest run`
Expected: `POST /auth/register > creates a user with jobs and returns a token` FAILS — its payload
`jobs: { Trappeur: 42, Bûcheron: 10 }` now gets rejected with 400 (`Unknown job: Bûcheron`)
instead of the expected 201, because Task 1 made `isValidJobName('Bûcheron')` return `false`.

- [ ] **Step 2: Fix the fixture in `server/tests/routes/auth.test.ts`**

Find (in the `POST /auth/register` describe block):

```typescript
        jobs: { Trappeur: 42, Bûcheron: 10 },
```

Replace with:

```typescript
        jobs: { Trappeur: 42, Mineur: 10 },
```

- [ ] **Step 3: Run the full backend test suite to verify it passes**

Run: `cd server && npx vitest run`
Expected: all PASS.

- [ ] **Step 4: Commit**

```bash
git add server/tests/routes/auth.test.ts
git commit -m "server: fix auth test fixture using an old incorrect job name"
```

---

### Task 3: Migration to delete orphaned `user_jobs` rows

**Files:**
- Create: `server/migrations/003_fix_job_names.sql`

**Interfaces:**
- Consumes: nothing (raw SQL, the 14-name list is copied by hand from Task 1 since SQL can't
  import the TypeScript source).
- Produces: no more `user_jobs` rows referencing a job name outside the current 14 — relied on by
  nothing programmatically, but required for data hygiene per the spec.

- [ ] **Step 1: Write `server/migrations/003_fix_job_names.sql`**

```sql
DELETE FROM user_jobs
WHERE job_name NOT IN (
  'Paysan', 'Pêcheur', 'Trappeur', 'Mineur', 'Herboriste', 'Forestier',
  'Ébéniste', 'Tailleur', 'Bijoutier', 'Armurier', 'Maître d''Armes', 'Maroquinier',
  'Cuisinier', 'Boulanger'
);
```

- [ ] **Step 2: Apply the migration to the local/dev database**

Requires `server/.env` with a real `DATABASE_URL` (the Dockerized Postgres used for local
development — **never point this at the production Supabase database while iterating**, though
this particular migration is idempotent and safe to re-run).

Run: `cd server && npx ts-node scripts/migrate.ts`
Expected: logs `Applying 003_fix_job_names.sql...` then `Migrations complete.`

- [ ] **Step 3: Verify no orphaned rows remain**

Run: `cd server && node -e "require('dotenv').config(); const {Pool}=require('pg'); const p=new Pool({connectionString:process.env.DATABASE_URL}); p.query(\"SELECT DISTINCT job_name FROM user_jobs WHERE job_name NOT IN ('Paysan','Pêcheur','Trappeur','Mineur','Herboriste','Forestier','Ébéniste','Tailleur','Bijoutier','Armurier','Maître d''Armes','Maroquinier','Cuisinier','Boulanger')\").then(r=>{console.log('orphaned rows:', r.rows); return p.end();})"`
Expected: `orphaned rows: []`.

- [ ] **Step 4: Commit**

```bash
git add server/migrations/003_fix_job_names.sql
git commit -m "server: add migration to remove user_jobs rows with old incorrect job names"
```

---

### Task 4: Full verification pass

**Files:** none (verification only).

**Interfaces:** none.

- [ ] **Step 1: Run the full backend test suite**

Run: `cd server && npx vitest run`
Expected: all PASS.

- [ ] **Step 2: Typecheck and build**

Run: `cd server && npx tsc --noEmit && npm run build`
Expected: no errors.

- [ ] **Step 3: Report results**

Summarize pass/fail for each step above. Do not mark this task complete if any step failed.

---

## Post-plan note

This plan does not apply migration `003_fix_job_names.sql` to the production Supabase database or
redeploy the backend. After merging: push to `main` (Render redeploys automatically), then apply
the migration against production by pointing `server/.env`'s `DATABASE_URL` at the production
Supabase pooler connection string temporarily and running `npx ts-node scripts/migrate.ts` — same
process documented in `CLAUDE.md`'s "Release process" section.
