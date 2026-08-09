# Backend — Comptes, amis, métiers — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build the standalone backend API (Node + Fastify + PostgreSQL) that powers accounts,
friendships, and job-level tracking for Wakfu Companion, deployable to a free-tier host.

**Architecture:** A Fastify HTTP server in `server/`, connecting to a Supabase-hosted PostgreSQL
database via `pg`. Plain SQL via `pg` (no ORM). JWT auth via `@fastify/jwt`. Password hashing via
`argon2`. Routes grouped by domain (`auth`, `jobs`, `friends`), each a Fastify plugin. Migrations
are plain `.sql` files applied by a small runner script — no migration framework dependency.

**Tech Stack:** Node.js, TypeScript, Fastify, `pg`, `argon2`, `@fastify/jwt`, `zod` (request
validation), `vitest` (already used in the sibling client — reuse for consistency).

## Global Constraints

- Backend lives in `server/` at the repo root, **not** inside `src/` — `src/`, `tests/`, and all
  root config files (`tsconfig*.json`, `vite.config.ts`, `vitest.config.ts`,
  `electron-builder.yml`) are untouched by this plan.
- `server/` has its own `package.json`, own `node_modules`, own `tsconfig.json` — fully
  independent of the client's build.
- No secrets committed. Connection string, JWT secret read from environment variables only
  (`.env` for local dev, gitignored; real values set on the hosting platform).
- Passwords hashed with `argon2`, never stored or logged in plaintext.
- Job levels are integers clamped `0..155`, validated server-side on every write.
- Job names validated against a hardcoded list (see Task 2) — unknown job names rejected with 400.
- All mutating routes except `/auth/register` and `/auth/login` require `Authorization: Bearer
  <jwt>`; missing/invalid token → 401.
- Every route validates its request body with `zod`; invalid body → 400 with a clear message.

---

## File Structure

```
server/
  package.json
  tsconfig.json
  .env.example
  .gitignore
  src/
    app.ts                  # builds and returns the Fastify instance (no .listen())
    index.ts                # entrypoint: builds app, calls .listen()
    db.ts                   # pg Pool, query helper
    jobs.ts                 # hardcoded job name list + level bounds
    auth/
      plugin.ts             # registers /auth/register, /auth/login
      password.ts           # argon2 hash/verify wrappers
      jwt.ts                 # fastify-jwt plugin registration + auth-required preHandler
    jobsRoutes/
      plugin.ts             # registers GET /me/jobs, PUT /me/jobs/:jobName
    friends/
      plugin.ts             # registers /friends/* routes
      friendCode.ts          # friend code generation (e.g. "WC-A1B2C3")
  migrations/
    001_init.sql            # users, user_jobs, friendships tables
  scripts/
    migrate.ts               # applies migrations/*.sql in order, tracks applied ones in a table
  tests/
    password.test.ts
    friendCode.test.ts
    jobs.test.ts             # validation helpers (isValidJobName, clampLevel)
    routes/
      auth.test.ts            # integration tests against a real test Postgres (Fastify inject)
      jobsRoutes.test.ts
      friends.test.ts
    testDb.ts                 # test helper: fresh schema per test run, truncate between tests
```

**Interfaces summary (for cross-task reference):**
- `db.ts` exports `pool: Pool` and `query<T>(text: string, params?: unknown[]): Promise<T[]>`.
- `jobs.ts` exports `JOB_NAMES: readonly string[]`, `isValidJobName(name: string): boolean`,
  `clampLevel(level: number): number`.
- `auth/password.ts` exports `hashPassword(plain: string): Promise<string>`,
  `verifyPassword(hash: string, plain: string): Promise<boolean>`.
- `auth/jwt.ts` exports `registerJwt(app: FastifyInstance): void`,
  `requireAuth: preHandlerHookHandler` (sets `request.userId: string` on success).
- `friends/friendCode.ts` exports `generateFriendCode(): string`.
- `app.ts` exports `buildApp(): FastifyInstance`.

---

### Task 1: Project scaffold

**Files:**
- Create: `server/package.json`
- Create: `server/tsconfig.json`
- Create: `server/.env.example`
- Create: `server/.gitignore`
- Create: `server/src/db.ts`

**Interfaces:**
- Produces: `pool: Pool`, `query<T>(text: string, params?: unknown[]): Promise<T[]>` from
  `server/src/db.ts`, used by every later task that touches the database.

- [ ] **Step 1: Create `server/package.json`**

```json
{
  "name": "wakfu-companion-server",
  "version": "1.0.0",
  "private": true,
  "type": "commonjs",
  "main": "dist/index.js",
  "scripts": {
    "build": "tsc -p tsconfig.json",
    "start": "node dist/index.js",
    "dev": "tsc -p tsconfig.json --watch",
    "migrate": "ts-node scripts/migrate.ts",
    "test": "vitest run"
  },
  "dependencies": {
    "fastify": "^5.1.0",
    "@fastify/jwt": "^9.0.1",
    "pg": "^8.13.1",
    "argon2": "^0.41.1",
    "zod": "^3.24.1",
    "dotenv": "^16.4.7"
  },
  "devDependencies": {
    "typescript": "^5.9.3",
    "ts-node": "^10.9.2",
    "vitest": "^4.1.10",
    "@types/node": "^22.10.2",
    "@types/pg": "^8.11.10"
  }
}
```

- [ ] **Step 2: Create `server/tsconfig.json`**

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
    "forceConsistentCasingInFileNames": true,
    "resolveJsonModule": true,
    "types": ["node"]
  },
  "include": ["src"]
}
```

- [ ] **Step 3: Create `server/.env.example`**

```
DATABASE_URL=postgres://user:password@host:5432/dbname
JWT_SECRET=replace-with-a-long-random-string
PORT=3000
```

- [ ] **Step 4: Create `server/.gitignore`**

```
node_modules/
dist/
.env
```

- [ ] **Step 5: Install dependencies**

Run (from `server/`): `npm install`

- [ ] **Step 6: Write `server/src/db.ts`**

```typescript
import { Pool } from 'pg';

export const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
});

export async function query<T = unknown>(text: string, params?: unknown[]): Promise<T[]> {
  const result = await pool.query(text, params);
  return result.rows as T[];
}
```

- [ ] **Step 7: Verify it compiles**

Run: `cd server && npx tsc --noEmit`
Expected: no errors.

- [ ] **Step 8: Commit**

```bash
git add server/package.json server/package-lock.json server/tsconfig.json server/.env.example server/.gitignore server/src/db.ts
git commit -m "server: scaffold backend project with pg connection helper"
```

---

### Task 2: Job name list and validation helpers

**Files:**
- Create: `server/src/jobs.ts`
- Test: `server/tests/jobs.test.ts`

**Interfaces:**
- Consumes: nothing.
- Produces: `JOB_NAMES: readonly string[]`, `isValidJobName(name: string): boolean`,
  `clampLevel(level: number): number` — used by Task 5 (jobs routes) and Task 3 (register route)
  for validation.

- [ ] **Step 1: Write the failing test**

```typescript
// server/tests/jobs.test.ts
import { describe, it, expect } from 'vitest';
import { JOB_NAMES, isValidJobName, clampLevel } from '../src/jobs';

describe('jobs', () => {
  it('lists all known Wakfu professions', () => {
    expect(JOB_NAMES).toContain('Trappeur');
    expect(JOB_NAMES.length).toBeGreaterThan(0);
  });

  it('accepts a known job name', () => {
    expect(isValidJobName('Trappeur')).toBe(true);
  });

  it('rejects an unknown job name', () => {
    expect(isValidJobName('NotAJob')).toBe(false);
  });

  it('clamps levels within 0 and 155', () => {
    expect(clampLevel(-5)).toBe(0);
    expect(clampLevel(200)).toBe(155);
    expect(clampLevel(80)).toBe(80);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd server && npx vitest run tests/jobs.test.ts`
Expected: FAIL — `src/jobs.ts` does not exist.

- [ ] **Step 3: Write `server/src/jobs.ts`**

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
  'Boulanger',
] as const;

export function isValidJobName(name: string): boolean {
  return (JOB_NAMES as readonly string[]).includes(name);
}

export function clampLevel(level: number): number {
  return Math.min(155, Math.max(0, level));
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd server && npx vitest run tests/jobs.test.ts`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add server/src/jobs.ts server/tests/jobs.test.ts
git commit -m "server: add hardcoded job list and validation helpers"
```

---

### Task 3: Database schema and migration runner

**Files:**
- Create: `server/migrations/001_init.sql`
- Create: `server/scripts/migrate.ts`
- Create: `server/tests/testDb.ts`

**Interfaces:**
- Consumes: `pool` from `server/src/db.ts` (Task 1).
- Produces: `users`, `user_jobs`, `friendships` tables in the target database.
  `server/tests/testDb.ts` exports `resetTestDb(): Promise<void>` — truncates all tables, used by
  every route integration test (Tasks 4, 5, 6) to isolate test runs.

- [ ] **Step 1: Write `server/migrations/001_init.sql`**

```sql
CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE TABLE users (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  username text UNIQUE NOT NULL,
  email text UNIQUE NOT NULL,
  password_hash text NOT NULL,
  friend_code text UNIQUE NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE user_jobs (
  user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  job_name text NOT NULL,
  level int NOT NULL CHECK (level BETWEEN 0 AND 155),
  updated_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, job_name)
);

CREATE TABLE friendships (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  requester_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  addressee_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  status text NOT NULL DEFAULT 'pending',
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (requester_id, addressee_id)
);
```

- [ ] **Step 2: Write `server/scripts/migrate.ts`**

```typescript
import 'dotenv/config';
import fs from 'fs';
import path from 'path';
import { pool } from '../src/db';

async function main() {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS _migrations (
      name text PRIMARY KEY,
      applied_at timestamptz NOT NULL DEFAULT now()
    )
  `);

  const dir = path.join(__dirname, '..', 'migrations');
  const files = fs.readdirSync(dir).filter((f) => f.endsWith('.sql')).sort();

  for (const file of files) {
    const { rows } = await pool.query('SELECT 1 FROM _migrations WHERE name = $1', [file]);
    if (rows.length > 0) continue;

    const sql = fs.readFileSync(path.join(dir, file), 'utf-8');
    console.log(`Applying ${file}...`);
    await pool.query(sql);
    await pool.query('INSERT INTO _migrations (name) VALUES ($1)', [file]);
  }

  console.log('Migrations complete.');
  await pool.end();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
```

- [ ] **Step 3: Write `server/tests/testDb.ts`**

```typescript
import 'dotenv/config';
import { pool } from '../src/db';

export async function resetTestDb(): Promise<void> {
  await pool.query('TRUNCATE friendships, user_jobs, users CASCADE');
}
```

- [ ] **Step 4: Run migration against a real local/dev Postgres**

This requires a `DATABASE_URL` pointing at a real Postgres instance (a local Postgres via Docker,
or a throwaway Supabase project for development — set it in `server/.env`, copied from
`.env.example`).

Run: `cd server && npx ts-node scripts/migrate.ts`
Expected: logs `Applying 001_init.sql...` then `Migrations complete.`

- [ ] **Step 5: Verify tables exist**

Run: `cd server && npx ts-node -e "import('./src/db').then(m => m.query('SELECT tablename FROM pg_tables WHERE schemaname = $1', ['public']).then(r => console.log(r)).then(() => process.exit(0)))"`
Expected: output includes `users`, `user_jobs`, `friendships`, `_migrations`.

- [ ] **Step 6: Commit**

```bash
git add server/migrations/001_init.sql server/scripts/migrate.ts server/tests/testDb.ts
git commit -m "server: add initial schema migration and migration runner"
```

---

### Task 4: Password hashing and JWT auth helpers

**Files:**
- Create: `server/src/auth/password.ts`
- Create: `server/src/auth/jwt.ts`
- Test: `server/tests/password.test.ts`

**Interfaces:**
- Consumes: nothing new (uses `argon2`, `@fastify/jwt` directly).
- Produces: `hashPassword(plain: string): Promise<string>`,
  `verifyPassword(hash: string, plain: string): Promise<boolean>` from `auth/password.ts`.
  `registerJwt(app: FastifyInstance): void`, `requireAuth: preHandlerHookHandler` (sets
  `request.userId: string`) from `auth/jwt.ts` — used by Task 3 app assembly and every protected
  route in Tasks 5 and 6.

- [ ] **Step 1: Write the failing test**

```typescript
// server/tests/password.test.ts
import { describe, it, expect } from 'vitest';
import { hashPassword, verifyPassword } from '../src/auth/password';

describe('password', () => {
  it('hashes and verifies a correct password', async () => {
    const hash = await hashPassword('correct-horse-battery-staple');
    expect(await verifyPassword(hash, 'correct-horse-battery-staple')).toBe(true);
  });

  it('rejects an incorrect password', async () => {
    const hash = await hashPassword('correct-horse-battery-staple');
    expect(await verifyPassword(hash, 'wrong-password')).toBe(false);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd server && npx vitest run tests/password.test.ts`
Expected: FAIL — `src/auth/password.ts` does not exist.

- [ ] **Step 3: Write `server/src/auth/password.ts`**

```typescript
import argon2 from 'argon2';

export async function hashPassword(plain: string): Promise<string> {
  return argon2.hash(plain);
}

export async function verifyPassword(hash: string, plain: string): Promise<boolean> {
  return argon2.verify(hash, plain);
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd server && npx vitest run tests/password.test.ts`
Expected: PASS

- [ ] **Step 5: Write `server/src/auth/jwt.ts` (no test — thin wrapper over `@fastify/jwt`,
  exercised end-to-end by Task 5's route tests)**

```typescript
import fastifyJwt from '@fastify/jwt';
import type { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';

export function registerJwt(app: FastifyInstance): void {
  app.register(fastifyJwt, { secret: process.env.JWT_SECRET as string });
}

export async function requireAuth(request: FastifyRequest, reply: FastifyReply): Promise<void> {
  try {
    const payload = await request.jwtVerify<{ userId: string }>();
    (request as FastifyRequest & { userId: string }).userId = payload.userId;
  } catch {
    reply.code(401).send({ error: 'Unauthorized' });
  }
}
```

- [ ] **Step 6: Commit**

```bash
git add server/src/auth/password.ts server/src/auth/jwt.ts server/tests/password.test.ts
git commit -m "server: add password hashing and JWT auth helpers"
```

---

### Task 5: Friend code generator

**Files:**
- Create: `server/src/friends/friendCode.ts`
- Test: `server/tests/friendCode.test.ts`

**Interfaces:**
- Consumes: nothing.
- Produces: `generateFriendCode(): string` — used by Task 6 (`/auth/register`).

- [ ] **Step 1: Write the failing test**

```typescript
// server/tests/friendCode.test.ts
import { describe, it, expect } from 'vitest';
import { generateFriendCode } from '../src/friends/friendCode';

describe('generateFriendCode', () => {
  it('produces a WC- prefixed 6-character uppercase alphanumeric code', () => {
    const code = generateFriendCode();
    expect(code).toMatch(/^WC-[A-Z0-9]{6}$/);
  });

  it('produces different codes across calls', () => {
    const codes = new Set(Array.from({ length: 20 }, () => generateFriendCode()));
    expect(codes.size).toBe(20);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd server && npx vitest run tests/friendCode.test.ts`
Expected: FAIL — `src/friends/friendCode.ts` does not exist.

- [ ] **Step 3: Write `server/src/friends/friendCode.ts`**

```typescript
import crypto from 'crypto';

const ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; // no O/0/I/1 ambiguity

export function generateFriendCode(): string {
  const bytes = crypto.randomBytes(6);
  let code = '';
  for (const b of bytes) {
    code += ALPHABET[b % ALPHABET.length];
  }
  return `WC-${code}`;
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd server && npx vitest run tests/friendCode.test.ts`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add server/src/friends/friendCode.ts server/tests/friendCode.test.ts
git commit -m "server: add friend code generator"
```

---

### Task 6: App assembly and `/auth/register`, `/auth/login`

**Files:**
- Create: `server/src/app.ts`
- Create: `server/src/index.ts`
- Create: `server/src/auth/plugin.ts`
- Test: `server/tests/routes/auth.test.ts`

**Interfaces:**
- Consumes: `pool`/`query` (Task 1), `JOB_NAMES`/`isValidJobName`/`clampLevel` (Task 2),
  `resetTestDb` (Task 3), `hashPassword`/`verifyPassword`/`registerJwt`/`requireAuth` (Task 4),
  `generateFriendCode` (Task 5).
- Produces: `buildApp(): FastifyInstance` from `app.ts` — used by every remaining route task and by
  `index.ts`. Registers `POST /auth/register`, `POST /auth/login`.

- [ ] **Step 1: Write the failing test**

```typescript
// server/tests/routes/auth.test.ts
import { describe, it, expect, beforeEach } from 'vitest';
import { buildApp } from '../../src/app';
import { resetTestDb } from '../testDb';

describe('POST /auth/register', () => {
  beforeEach(async () => {
    await resetTestDb();
  });

  it('creates a user with jobs and returns a token', async () => {
    const app = buildApp();
    const response = await app.inject({
      method: 'POST',
      url: '/auth/register',
      payload: {
        username: 'clement',
        email: 'clement@example.com',
        password: 'hunter2hunter2',
        jobs: { Trappeur: 42, Bûcheron: 10 },
      },
    });

    expect(response.statusCode).toBe(201);
    const body = response.json();
    expect(body.token).toBeTypeOf('string');
    expect(body.user.username).toBe('clement');
    expect(body.user.friendCode).toMatch(/^WC-/);
  });

  it('rejects a duplicate username', async () => {
    const app = buildApp();
    const payload = {
      username: 'clement',
      email: 'clement@example.com',
      password: 'hunter2hunter2',
      jobs: {},
    };
    await app.inject({ method: 'POST', url: '/auth/register', payload });
    const second = await app.inject({
      method: 'POST',
      url: '/auth/register',
      payload: { ...payload, email: 'other@example.com' },
    });

    expect(second.statusCode).toBe(409);
  });

  it('rejects an unknown job name', async () => {
    const app = buildApp();
    const response = await app.inject({
      method: 'POST',
      url: '/auth/register',
      payload: {
        username: 'clement',
        email: 'clement@example.com',
        password: 'hunter2hunter2',
        jobs: { NotAJob: 10 },
      },
    });

    expect(response.statusCode).toBe(400);
  });
});

describe('POST /auth/login', () => {
  beforeEach(async () => {
    await resetTestDb();
  });

  it('logs in with correct credentials', async () => {
    const app = buildApp();
    await app.inject({
      method: 'POST',
      url: '/auth/register',
      payload: {
        username: 'clement',
        email: 'clement@example.com',
        password: 'hunter2hunter2',
        jobs: {},
      },
    });

    const response = await app.inject({
      method: 'POST',
      url: '/auth/login',
      payload: { usernameOrEmail: 'clement', password: 'hunter2hunter2' },
    });

    expect(response.statusCode).toBe(200);
    expect(response.json().token).toBeTypeOf('string');
  });

  it('rejects wrong password', async () => {
    const app = buildApp();
    await app.inject({
      method: 'POST',
      url: '/auth/register',
      payload: {
        username: 'clement',
        email: 'clement@example.com',
        password: 'hunter2hunter2',
        jobs: {},
      },
    });

    const response = await app.inject({
      method: 'POST',
      url: '/auth/login',
      payload: { usernameOrEmail: 'clement', password: 'wrong' },
    });

    expect(response.statusCode).toBe(401);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd server && npx vitest run tests/routes/auth.test.ts`
Expected: FAIL — `src/app.ts` does not exist.

- [ ] **Step 3: Write `server/src/auth/plugin.ts`**

```typescript
import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { pool } from '../db';
import { hashPassword, verifyPassword } from './password';
import { generateFriendCode } from '../friends/friendCode';
import { isValidJobName, clampLevel } from '../jobs';

const registerSchema = z.object({
  username: z.string().min(3).max(32),
  email: z.string().email(),
  password: z.string().min(8),
  jobs: z.record(z.string(), z.number()),
});

const loginSchema = z.object({
  usernameOrEmail: z.string(),
  password: z.string(),
});

export async function authPlugin(app: FastifyInstance): Promise<void> {
  app.post('/auth/register', async (request, reply) => {
    const parsed = registerSchema.safeParse(request.body);
    if (!parsed.success) {
      return reply.code(400).send({ error: parsed.error.message });
    }
    const { username, email, password, jobs } = parsed.data;

    for (const jobName of Object.keys(jobs)) {
      if (!isValidJobName(jobName)) {
        return reply.code(400).send({ error: `Unknown job: ${jobName}` });
      }
    }

    const client = await pool.connect();
    try {
      await client.query('BEGIN');

      const passwordHash = await hashPassword(password);
      const friendCode = generateFriendCode();

      const userRows = await client.query(
        `INSERT INTO users (username, email, password_hash, friend_code)
         VALUES ($1, $2, $3, $4)
         RETURNING id, username, friend_code`,
        [username, email, passwordHash, friendCode]
      );
      const user = userRows.rows[0];

      for (const [jobName, level] of Object.entries(jobs)) {
        await client.query(
          `INSERT INTO user_jobs (user_id, job_name, level) VALUES ($1, $2, $3)`,
          [user.id, jobName, clampLevel(level)]
        );
      }

      await client.query('COMMIT');

      const token = app.jwt.sign({ userId: user.id });
      return reply.code(201).send({
        token,
        user: { id: user.id, username: user.username, friendCode: user.friend_code },
      });
    } catch (err) {
      await client.query('ROLLBACK');
      if ((err as { code?: string }).code === '23505') {
        return reply.code(409).send({ error: 'Username or email already taken' });
      }
      throw err;
    } finally {
      client.release();
    }
  });

  app.post('/auth/login', async (request, reply) => {
    const parsed = loginSchema.safeParse(request.body);
    if (!parsed.success) {
      return reply.code(400).send({ error: parsed.error.message });
    }
    const { usernameOrEmail, password } = parsed.data;

    const rows = await pool.query(
      `SELECT id, username, friend_code, password_hash FROM users
       WHERE username = $1 OR email = $1`,
      [usernameOrEmail]
    );
    const user = rows.rows[0];
    if (!user || !(await verifyPassword(user.password_hash, password))) {
      return reply.code(401).send({ error: 'Invalid credentials' });
    }

    const token = app.jwt.sign({ userId: user.id });
    return reply.send({
      token,
      user: { id: user.id, username: user.username, friendCode: user.friend_code },
    });
  });
}
```

- [ ] **Step 4: Write `server/src/app.ts`**

```typescript
import Fastify, { type FastifyInstance } from 'fastify';
import { registerJwt } from './auth/jwt';
import { authPlugin } from './auth/plugin';

export function buildApp(): FastifyInstance {
  const app = Fastify();
  registerJwt(app);
  app.register(authPlugin);
  return app;
}
```

- [ ] **Step 5: Write `server/src/index.ts`**

```typescript
import 'dotenv/config';
import { buildApp } from './app';

const app = buildApp();
const port = Number(process.env.PORT) || 3000;

app.listen({ port, host: '0.0.0.0' }).catch((err) => {
  app.log.error(err);
  process.exit(1);
});
```

- [ ] **Step 6: Run test to verify it passes**

Requires `server/.env` with a real `DATABASE_URL` (migrations from Task 3 already applied) and
`JWT_SECRET` set.

Run: `cd server && npx vitest run tests/routes/auth.test.ts`
Expected: PASS

- [ ] **Step 7: Commit**

```bash
git add server/src/app.ts server/src/index.ts server/src/auth/plugin.ts server/tests/routes/auth.test.ts
git commit -m "server: add app assembly and auth register/login routes"
```

---

### Task 7: Jobs routes (`GET /me/jobs`, `PUT /me/jobs/:jobName`)

**Files:**
- Create: `server/src/jobsRoutes/plugin.ts`
- Modify: `server/src/app.ts`
- Test: `server/tests/routes/jobsRoutes.test.ts`

**Interfaces:**
- Consumes: `requireAuth` (Task 4), `pool` (Task 1), `isValidJobName`/`clampLevel` (Task 2),
  `buildApp` (Task 6, modified here).
- Produces: authenticated `GET /me/jobs`, `PUT /me/jobs/:jobName` routes.

- [ ] **Step 1: Write the failing test**

```typescript
// server/tests/routes/jobsRoutes.test.ts
import { describe, it, expect, beforeEach } from 'vitest';
import { buildApp } from '../../src/app';
import { resetTestDb } from '../testDb';

async function registerAndGetToken(app: ReturnType<typeof buildApp>) {
  const response = await app.inject({
    method: 'POST',
    url: '/auth/register',
    payload: {
      username: 'clement',
      email: 'clement@example.com',
      password: 'hunter2hunter2',
      jobs: { Trappeur: 42 },
    },
  });
  return response.json().token as string;
}

describe('GET /me/jobs', () => {
  beforeEach(async () => {
    await resetTestDb();
  });

  it('returns the jobs set at registration', async () => {
    const app = buildApp();
    const token = await registerAndGetToken(app);

    const response = await app.inject({
      method: 'GET',
      url: '/me/jobs',
      headers: { authorization: `Bearer ${token}` },
    });

    expect(response.statusCode).toBe(200);
    expect(response.json()).toEqual([{ jobName: 'Trappeur', level: 42 }]);
  });

  it('rejects without a token', async () => {
    const app = buildApp();
    const response = await app.inject({ method: 'GET', url: '/me/jobs' });
    expect(response.statusCode).toBe(401);
  });
});

describe('PUT /me/jobs/:jobName', () => {
  beforeEach(async () => {
    await resetTestDb();
  });

  it('sets a job level', async () => {
    const app = buildApp();
    const token = await registerAndGetToken(app);

    const response = await app.inject({
      method: 'PUT',
      url: '/me/jobs/Trappeur',
      headers: { authorization: `Bearer ${token}` },
      payload: { level: 55 },
    });

    expect(response.statusCode).toBe(200);
    expect(response.json()).toEqual({ jobName: 'Trappeur', level: 55 });
  });

  it('rejects an unknown job name', async () => {
    const app = buildApp();
    const token = await registerAndGetToken(app);

    const response = await app.inject({
      method: 'PUT',
      url: '/me/jobs/NotAJob',
      headers: { authorization: `Bearer ${token}` },
      payload: { level: 10 },
    });

    expect(response.statusCode).toBe(400);
  });

  it('clamps a level above 155', async () => {
    const app = buildApp();
    const token = await registerAndGetToken(app);

    const response = await app.inject({
      method: 'PUT',
      url: '/me/jobs/Trappeur',
      headers: { authorization: `Bearer ${token}` },
      payload: { level: 999 },
    });

    expect(response.json().level).toBe(155);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd server && npx vitest run tests/routes/jobsRoutes.test.ts`
Expected: FAIL — route not registered (404).

- [ ] **Step 3: Write `server/src/jobsRoutes/plugin.ts`**

```typescript
import type { FastifyInstance, FastifyRequest } from 'fastify';
import { z } from 'zod';
import { pool } from '../db';
import { isValidJobName, clampLevel } from '../jobs';
import { requireAuth } from '../auth/jwt';

const putJobSchema = z.object({ level: z.number() });

export async function jobsRoutesPlugin(app: FastifyInstance): Promise<void> {
  app.get('/me/jobs', { preHandler: requireAuth }, async (request) => {
    const userId = (request as FastifyRequest & { userId: string }).userId;
    const rows = await pool.query(
      'SELECT job_name, level FROM user_jobs WHERE user_id = $1 ORDER BY job_name',
      [userId]
    );
    return rows.rows.map((r) => ({ jobName: r.job_name, level: r.level }));
  });

  app.put('/me/jobs/:jobName', { preHandler: requireAuth }, async (request, reply) => {
    const userId = (request as FastifyRequest & { userId: string }).userId;
    const { jobName } = request.params as { jobName: string };

    if (!isValidJobName(jobName)) {
      return reply.code(400).send({ error: `Unknown job: ${jobName}` });
    }

    const parsed = putJobSchema.safeParse(request.body);
    if (!parsed.success) {
      return reply.code(400).send({ error: parsed.error.message });
    }

    const level = clampLevel(parsed.data.level);

    await pool.query(
      `INSERT INTO user_jobs (user_id, job_name, level, updated_at)
       VALUES ($1, $2, $3, now())
       ON CONFLICT (user_id, job_name) DO UPDATE SET level = $3, updated_at = now()`,
      [userId, jobName, level]
    );

    return { jobName, level };
  });
}
```

- [ ] **Step 4: Modify `server/src/app.ts`**

```typescript
import Fastify, { type FastifyInstance } from 'fastify';
import { registerJwt } from './auth/jwt';
import { authPlugin } from './auth/plugin';
import { jobsRoutesPlugin } from './jobsRoutes/plugin';

export function buildApp(): FastifyInstance {
  const app = Fastify();
  registerJwt(app);
  app.register(authPlugin);
  app.register(jobsRoutesPlugin);
  return app;
}
```

- [ ] **Step 5: Run test to verify it passes**

Run: `cd server && npx vitest run tests/routes/jobsRoutes.test.ts`
Expected: PASS

- [ ] **Step 6: Commit**

```bash
git add server/src/jobsRoutes/plugin.ts server/src/app.ts server/tests/routes/jobsRoutes.test.ts
git commit -m "server: add authenticated job level get/set routes"
```

---

### Task 8: Friends routes

**Files:**
- Create: `server/src/friends/plugin.ts`
- Modify: `server/src/app.ts`
- Test: `server/tests/routes/friends.test.ts`

**Interfaces:**
- Consumes: `requireAuth` (Task 4), `pool` (Task 1), `buildApp` (Task 7, modified here).
- Produces: `POST /friends/request`, `GET /friends/requests`,
  `POST /friends/requests/:id/accept`, `POST /friends/requests/:id/reject`, `GET /friends`.

- [ ] **Step 1: Write the failing test**

```typescript
// server/tests/routes/friends.test.ts
import { describe, it, expect, beforeEach } from 'vitest';
import { buildApp } from '../../src/app';
import { resetTestDb } from '../testDb';

async function registerUser(app: ReturnType<typeof buildApp>, username: string) {
  const response = await app.inject({
    method: 'POST',
    url: '/auth/register',
    payload: {
      username,
      email: `${username}@example.com`,
      password: 'hunter2hunter2',
      jobs: { Trappeur: 10 },
    },
  });
  return response.json() as { token: string; user: { id: string; friendCode: string } };
}

describe('friends flow', () => {
  beforeEach(async () => {
    await resetTestDb();
  });

  it('sends a request, lists it as pending, accepts it, then lists as friends', async () => {
    const app = buildApp();
    const alice = await registerUser(app, 'alice');
    const bob = await registerUser(app, 'bob');

    const sendResponse = await app.inject({
      method: 'POST',
      url: '/friends/request',
      headers: { authorization: `Bearer ${alice.token}` },
      payload: { friendCode: bob.user.friendCode },
    });
    expect(sendResponse.statusCode).toBe(201);

    const pendingResponse = await app.inject({
      method: 'GET',
      url: '/friends/requests',
      headers: { authorization: `Bearer ${bob.token}` },
    });
    expect(pendingResponse.statusCode).toBe(200);
    const pending = pendingResponse.json();
    expect(pending).toHaveLength(1);
    expect(pending[0].fromUsername).toBe('alice');

    const acceptResponse = await app.inject({
      method: 'POST',
      url: `/friends/requests/${pending[0].id}/accept`,
      headers: { authorization: `Bearer ${bob.token}` },
    });
    expect(acceptResponse.statusCode).toBe(200);

    const aliceFriends = await app.inject({
      method: 'GET',
      url: '/friends',
      headers: { authorization: `Bearer ${alice.token}` },
    });
    const friendsList = aliceFriends.json();
    expect(friendsList).toHaveLength(1);
    expect(friendsList[0].username).toBe('bob');
    expect(friendsList[0].jobs).toEqual([{ jobName: 'Trappeur', level: 10 }]);
  });

  it('rejects a request to an unknown friend code', async () => {
    const app = buildApp();
    const alice = await registerUser(app, 'alice');

    const response = await app.inject({
      method: 'POST',
      url: '/friends/request',
      headers: { authorization: `Bearer ${alice.token}` },
      payload: { friendCode: 'WC-NOTFND' },
    });

    expect(response.statusCode).toBe(404);
  });

  it('rejecting a request removes it without creating a friendship', async () => {
    const app = buildApp();
    const alice = await registerUser(app, 'alice');
    const bob = await registerUser(app, 'bob');

    await app.inject({
      method: 'POST',
      url: '/friends/request',
      headers: { authorization: `Bearer ${alice.token}` },
      payload: { friendCode: bob.user.friendCode },
    });

    const pendingResponse = await app.inject({
      method: 'GET',
      url: '/friends/requests',
      headers: { authorization: `Bearer ${bob.token}` },
    });
    const requestId = pendingResponse.json()[0].id;

    await app.inject({
      method: 'POST',
      url: `/friends/requests/${requestId}/reject`,
      headers: { authorization: `Bearer ${bob.token}` },
    });

    const bobFriends = await app.inject({
      method: 'GET',
      url: '/friends',
      headers: { authorization: `Bearer ${bob.token}` },
    });
    expect(bobFriends.json()).toHaveLength(0);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd server && npx vitest run tests/routes/friends.test.ts`
Expected: FAIL — routes not registered (404).

- [ ] **Step 3: Write `server/src/friends/plugin.ts`**

```typescript
import type { FastifyInstance, FastifyRequest } from 'fastify';
import { z } from 'zod';
import { pool } from '../db';
import { requireAuth } from '../auth/jwt';

const requestSchema = z.object({ friendCode: z.string() });

export async function friendsPlugin(app: FastifyInstance): Promise<void> {
  app.post('/friends/request', { preHandler: requireAuth }, async (request, reply) => {
    const userId = (request as FastifyRequest & { userId: string }).userId;
    const parsed = requestSchema.safeParse(request.body);
    if (!parsed.success) {
      return reply.code(400).send({ error: parsed.error.message });
    }

    const target = await pool.query('SELECT id FROM users WHERE friend_code = $1', [
      parsed.data.friendCode,
    ]);
    if (target.rows.length === 0) {
      return reply.code(404).send({ error: 'Friend code not found' });
    }
    const addresseeId = target.rows[0].id;

    if (addresseeId === userId) {
      return reply.code(400).send({ error: 'Cannot add yourself' });
    }

    try {
      await pool.query(
        `INSERT INTO friendships (requester_id, addressee_id, status)
         VALUES ($1, $2, 'pending')`,
        [userId, addresseeId]
      );
    } catch (err) {
      if ((err as { code?: string }).code === '23505') {
        return reply.code(409).send({ error: 'Request already exists' });
      }
      throw err;
    }

    return reply.code(201).send({ ok: true });
  });

  app.get('/friends/requests', { preHandler: requireAuth }, async (request) => {
    const userId = (request as FastifyRequest & { userId: string }).userId;
    const rows = await pool.query(
      `SELECT f.id, u.username AS "fromUsername"
       FROM friendships f
       JOIN users u ON u.id = f.requester_id
       WHERE f.addressee_id = $1 AND f.status = 'pending'`,
      [userId]
    );
    return rows.rows;
  });

  app.post(
    '/friends/requests/:id/accept',
    { preHandler: requireAuth },
    async (request, reply) => {
      const userId = (request as FastifyRequest & { userId: string }).userId;
      const { id } = request.params as { id: string };

      const result = await pool.query(
        `UPDATE friendships SET status = 'accepted'
         WHERE id = $1 AND addressee_id = $2 AND status = 'pending'
         RETURNING id`,
        [id, userId]
      );
      if (result.rows.length === 0) {
        return reply.code(404).send({ error: 'Request not found' });
      }
      return { ok: true };
    }
  );

  app.post(
    '/friends/requests/:id/reject',
    { preHandler: requireAuth },
    async (request, reply) => {
      const userId = (request as FastifyRequest & { userId: string }).userId;
      const { id } = request.params as { id: string };

      const result = await pool.query(
        `DELETE FROM friendships
         WHERE id = $1 AND addressee_id = $2 AND status = 'pending'
         RETURNING id`,
        [id, userId]
      );
      if (result.rows.length === 0) {
        return reply.code(404).send({ error: 'Request not found' });
      }
      return { ok: true };
    }
  );

  app.get('/friends', { preHandler: requireAuth }, async (request) => {
    const userId = (request as FastifyRequest & { userId: string }).userId;

    const friendRows = await pool.query(
      `SELECT u.id, u.username
       FROM friendships f
       JOIN users u ON u.id = CASE
         WHEN f.requester_id = $1 THEN f.addressee_id
         ELSE f.requester_id
       END
       WHERE (f.requester_id = $1 OR f.addressee_id = $1) AND f.status = 'accepted'`,
      [userId]
    );

    const friends = [];
    for (const friend of friendRows.rows) {
      const jobRows = await pool.query(
        'SELECT job_name, level FROM user_jobs WHERE user_id = $1 ORDER BY job_name',
        [friend.id]
      );
      friends.push({
        username: friend.username,
        jobs: jobRows.rows.map((r) => ({ jobName: r.job_name, level: r.level })),
      });
    }

    return friends;
  });
}
```

- [ ] **Step 4: Modify `server/src/app.ts`**

```typescript
import Fastify, { type FastifyInstance } from 'fastify';
import { registerJwt } from './auth/jwt';
import { authPlugin } from './auth/plugin';
import { jobsRoutesPlugin } from './jobsRoutes/plugin';
import { friendsPlugin } from './friends/plugin';

export function buildApp(): FastifyInstance {
  const app = Fastify();
  registerJwt(app);
  app.register(authPlugin);
  app.register(jobsRoutesPlugin);
  app.register(friendsPlugin);
  return app;
}
```

- [ ] **Step 5: Run test to verify it passes**

Run: `cd server && npx vitest run tests/routes/friends.test.ts`
Expected: PASS

- [ ] **Step 6: Commit**

```bash
git add server/src/friends/plugin.ts server/src/app.ts server/tests/routes/friends.test.ts
git commit -m "server: add friend request/accept/reject/list routes"
```

---

### Task 9: Full backend test suite and deployment prep

**Files:**
- Create: `server/README.md`
- Modify: `.gitignore` (repo root, if it doesn't already ignore `server/node_modules` etc. — check
  first, root `.gitignore` may already cover `node_modules/` and `.env` globally)

**Interfaces:**
- Consumes: everything from Tasks 1–8.
- Produces: nothing new — this task verifies the whole backend end-to-end and documents
  deployment.

- [ ] **Step 1: Run the full backend test suite**

Run: `cd server && npx vitest run`
Expected: all tests PASS (password, friendCode, jobs, auth routes, jobsRoutes, friends).

- [ ] **Step 2: Run a full build**

Run: `cd server && npm run build`
Expected: `server/dist/` produced, no TypeScript errors.

- [ ] **Step 3: Check root `.gitignore` covers `server/`**

Read the root `.gitignore`. If it has bare `node_modules/`, `.env`, `dist/` entries (no leading
path), they already match inside `server/` too — no change needed. If any entry is anchored to the
root only (e.g. `/dist`), add `server/dist/` and `server/node_modules/` explicitly.

- [ ] **Step 4: Write `server/README.md`**

```markdown
# wakfu-companion-server

Backend API for Wakfu Companion accounts, friends, and job level tracking.

## Setup

1. `npm install`
2. Copy `.env.example` to `.env` and fill in `DATABASE_URL` (a Supabase Postgres connection
   string) and `JWT_SECRET` (a long random string).
3. `npm run migrate` — applies `migrations/*.sql` to the target database.
4. `npm run build && npm start` — or `npm run dev` for a TypeScript watch build alongside
   `node dist/index.js` run manually.

## Testing

`npm test` runs the full suite against the database in `DATABASE_URL` — point it at a disposable
test database, not production, since tests truncate all tables between runs.

## Deployment

Deploy to any Node-capable free-tier host (e.g. Fly.io). Set `DATABASE_URL` and `JWT_SECRET` as
environment variables on the host — never commit them. Run `npm run migrate` once against the
production database before first deploy, and again after pulling any new migration file.
```

- [ ] **Step 5: Commit**

```bash
git add server/README.md .gitignore
git commit -m "server: add README and verify full test suite passes"
```

---

## Post-plan note

This plan produces a working, independently testable backend. It does **not** deploy it — actual
deployment to Fly.io/Supabase (creating accounts, setting environment variables, running the first
migration against production) is a manual step for the user to perform when ready, using
`server/README.md` as the guide. The client-side plan (Electron app changes) is written and
executed separately, once a deployed API base URL exists to point it at.
