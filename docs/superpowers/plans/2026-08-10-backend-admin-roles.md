# Backend — Rôles admin/player et gestion des comptes — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a `role` column (`player`/`admin`) to `users`, encode it in the JWT, and expose
`/admin/users` (list/edit/delete) protected by a new `requireAdmin` middleware.

**Architecture:** An additive SQL migration adds `role` with a `player` default. `login`/`register`
sign the role into the JWT payload alongside `userId`. A new `requireAdmin` preHandler (built on
top of the existing `requireAuth` logic) rejects non-admin callers with 403. Three new routes under
a new `adminPlugin` Fastify plugin.

**Tech Stack:** Same as the rest of `server/` — Fastify, `pg`, `zod`, `@fastify/jwt`, `vitest`.

## Global Constraints

- Migration is purely additive (`ALTER TABLE ... ADD COLUMN ... DEFAULT`) — no data loss, existing
  rows become `player`.
- The JWT payload carries `role` from the moment it's signed; `requireAdmin` trusts the token's
  role claim, it does not re-query the database. A role change in the database only takes effect
  for a user the next time they log in (accepted trade-off — see spec).
- `PUT /admin/users/:id` never accepts or applies a `role` field, even if present in the request
  body — role changes are database-only, by explicit design decision.
- `DELETE /admin/users/:id` relies on existing `ON DELETE CASCADE` on `user_jobs.user_id` and
  `friendships.requester_id`/`addressee_id` — no additional cleanup code needed.
- All `/admin/*` routes require `requireAdmin`; unauthenticated → 401, authenticated non-admin →
  403.

---

## File Structure

```
server/
  migrations/
    002_add_user_role.sql      # NEW — ALTER TABLE users ADD COLUMN role
  src/
    auth/
      jwt.ts                    # MODIFY — requireAdmin preHandler, role in requireAuth's request augmentation
      plugin.ts                  # MODIFY — sign role into JWT, insert role explicitly, return role in user object
    admin/
      plugin.ts                   # NEW — GET/PUT/DELETE /admin/users routes
  tests/
    routes/
      admin.test.ts                # NEW — requireAdmin 401/403/200 + all 3 routes
    routes/
      auth.test.ts                  # MODIFY — assert role is present in register/login responses
```

**Interfaces summary (for cross-task reference):**
- `server/src/auth/jwt.ts` exports (in addition to existing `registerJwt`, `requireAuth`):
  `requireAdmin: preHandlerHookHandler` (sets `request.userId` and `request.userRole`, rejects with
  403 if role isn't `'admin'`). `requireAuth` is modified to also set `request.userRole: string` in
  addition to the existing `request.userId`.
- `server/src/admin/plugin.ts` exports `adminPlugin: FastifyPluginAsync`, registered in `app.ts`.
- JWT payload shape becomes `{ userId: string; role: string }` everywhere it's signed or verified.

---

### Task 1: Migration — add `role` column

**Files:**
- Create: `server/migrations/002_add_user_role.sql`

**Interfaces:**
- Consumes: nothing.
- Produces: `users.role` column, `player`/`admin` values, `CHECK` constraint — relied on by every
  later task.

- [ ] **Step 1: Write `server/migrations/002_add_user_role.sql`**

```sql
ALTER TABLE users ADD COLUMN role text NOT NULL DEFAULT 'player'
  CHECK (role IN ('player', 'admin'));
```

- [ ] **Step 2: Apply the migration to the local/dev database**

Requires `server/.env` with a real `DATABASE_URL` (the Dockerized Postgres or Supabase pooler
connection already used for this project's development).

Run: `cd server && npx ts-node scripts/migrate.ts`
Expected: logs `Applying 002_add_user_role.sql...` then `Migrations complete.`

- [ ] **Step 3: Verify the column exists**

Run: `cd server && node -e "require('dotenv').config(); const {Pool}=require('pg'); const p=new Pool({connectionString:process.env.DATABASE_URL}); p.query(\"SELECT column_name, column_default FROM information_schema.columns WHERE table_name='users' AND column_name='role'\").then(r=>{console.log(r.rows); return p.end();})"`
Expected: one row showing `role` with default `'player'::text`.

- [ ] **Step 4: Commit**

```bash
git add server/migrations/002_add_user_role.sql
git commit -m "server: add role column to users (player/admin)"
```

---

### Task 2: `requireAdmin` middleware and role in JWT/auth responses

**Files:**
- Modify: `server/src/auth/jwt.ts`
- Modify: `server/src/auth/plugin.ts`
- Modify: `server/tests/routes/auth.test.ts`

**Interfaces:**
- Consumes: `users.role` column (Task 1).
- Produces: `requireAdmin` preHandler and `request.userRole: string` (set by both `requireAuth` and
  `requireAdmin`) — used by Task 3 (`admin/plugin.ts`) and every future route needing the caller's
  role without a database round-trip.

- [ ] **Step 1: Write the failing test**

Add to `server/tests/routes/auth.test.ts` (existing file — insert into the `POST /auth/register`
and `POST /auth/login` describe blocks, don't remove existing tests):

```typescript
  it('register returns role "player" for a new account', async () => {
    const app = buildApp();
    const response = await app.inject({
      method: 'POST',
      url: '/auth/register',
      payload: {
        username: 'roletest',
        email: 'roletest@example.com',
        password: 'hunter2hunter2',
        jobs: {},
      },
    });

    expect(response.json().user.role).toBe('player');
  });
```

Add this as a new test inside the `describe('POST /auth/login', ...)` block:

```typescript
  it('login returns the account role', async () => {
    const app = buildApp();
    await app.inject({
      method: 'POST',
      url: '/auth/register',
      payload: {
        username: 'roletest2',
        email: 'roletest2@example.com',
        password: 'hunter2hunter2',
        jobs: {},
      },
    });

    const response = await app.inject({
      method: 'POST',
      url: '/auth/login',
      payload: { usernameOrEmail: 'roletest2', password: 'hunter2hunter2' },
    });

    expect(response.json().user.role).toBe('player');
  });
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd server && npx vitest run tests/routes/auth.test.ts`
Expected: FAIL — `user.role` is `undefined` (not yet returned by either route).

- [ ] **Step 3: Modify `server/src/auth/jwt.ts`**

```typescript
import fastifyJwt from '@fastify/jwt';
import type { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';

export function registerJwt(app: FastifyInstance): void {
  app.register(fastifyJwt, { secret: process.env.JWT_SECRET as string });
}

export async function requireAuth(request: FastifyRequest, reply: FastifyReply): Promise<void> {
  try {
    const payload = await request.jwtVerify<{ userId: string; role: string }>();
    (request as FastifyRequest & { userId: string; userRole: string }).userId = payload.userId;
    (request as FastifyRequest & { userId: string; userRole: string }).userRole = payload.role;
  } catch {
    reply.code(401).send({ error: 'Unauthorized' });
  }
}

export async function requireAdmin(request: FastifyRequest, reply: FastifyReply): Promise<void> {
  await requireAuth(request, reply);
  if (reply.sent) return;

  const role = (request as FastifyRequest & { userRole: string }).userRole;
  if (role !== 'admin') {
    reply.code(403).send({ error: 'Forbidden' });
  }
}
```

- [ ] **Step 4: Modify `server/src/auth/plugin.ts`**

In the `/auth/register` handler, change the `INSERT` to include `role` explicitly and select it
back:

```typescript
      const userRows = await client.query(
        `INSERT INTO users (username, email, password_hash, friend_code, role)
         VALUES ($1, $2, $3, $4, 'player')
         RETURNING id, username, friend_code, role`,
        [username, email, passwordHash, friendCode]
      );
      const user = userRows.rows[0];
```

Change the token signing and response to include `role`:

```typescript
      const token = app.jwt.sign({ userId: user.id, role: user.role }, { expiresIn: '30d' });
      return reply.code(201).send({
        token,
        user: { id: user.id, username: user.username, friendCode: user.friend_code, role: user.role },
      });
```

In the `/auth/login` handler, add `role` to the `SELECT`:

```typescript
    const rows = await pool.query(
      `SELECT id, username, friend_code, password_hash, role FROM users
       WHERE username = $1
       UNION ALL
       SELECT id, username, friend_code, password_hash, role FROM users
       WHERE email = $1
       LIMIT 1`,
      [usernameOrEmail]
    );
```

Change the token signing and response to include `role`:

```typescript
    const token = app.jwt.sign({ userId: user.id, role: user.role }, { expiresIn: '30d' });
    return reply.send({
      token,
      user: { id: user.id, username: user.username, friendCode: user.friend_code, role: user.role },
    });
```

- [ ] **Step 5: Run test to verify it passes**

Run: `cd server && npx vitest run tests/routes/auth.test.ts`
Expected: PASS (all existing tests plus the two new ones).

- [ ] **Step 6: Run the full backend test suite to check for regressions**

Run: `cd server && npx vitest run`
Expected: all PASS — `jobsRoutes.test.ts` and `friends.test.ts` still work since `requireAuth`'s
existing behavior (setting `request.userId`) is unchanged, only augmented.

- [ ] **Step 7: Commit**

```bash
git add server/src/auth/jwt.ts server/src/auth/plugin.ts server/tests/routes/auth.test.ts
git commit -m "server: sign role into JWT, add requireAdmin middleware"
```

---

### Task 3: `/admin/users` routes (list, edit, delete)

**Files:**
- Create: `server/src/admin/plugin.ts`
- Modify: `server/src/app.ts`
- Test: `server/tests/routes/admin.test.ts`

**Interfaces:**
- Consumes: `requireAdmin` (Task 2), `pool` (`server/src/db.ts`), `isValidJobName`/`clampLevel`
  (`server/src/jobs.ts`).
- Produces: `GET /admin/users`, `PUT /admin/users/:id`, `DELETE /admin/users/:id`.

- [ ] **Step 1: Write the failing test**

```typescript
// server/tests/routes/admin.test.ts
import { describe, it, expect, beforeEach } from 'vitest'
import { buildApp } from '../../src/app'
import { resetTestDb } from '../testDb'
import { pool } from '../../src/db'

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
  })
  return response.json() as { token: string; user: { id: string; username: string } }
}

async function promoteToAdmin(userId: string): Promise<void> {
  await pool.query(`UPDATE users SET role = 'admin' WHERE id = $1`, [userId])
}

describe('/admin/users', () => {
  beforeEach(async () => {
    await resetTestDb()
  })

  it('rejects without a token', async () => {
    const app = buildApp()
    const response = await app.inject({ method: 'GET', url: '/admin/users' })
    expect(response.statusCode).toBe(401)
  })

  it('rejects a non-admin token with 403', async () => {
    const app = buildApp()
    const player = await registerUser(app, 'plainplayer')

    const response = await app.inject({
      method: 'GET',
      url: '/admin/users',
      headers: { authorization: `Bearer ${player.token}` },
    })

    expect(response.statusCode).toBe(403)
  })

  it('lists all users for an admin, including their jobs', async () => {
    const app = buildApp()
    const player = await registerUser(app, 'listedplayer')
    const admin = await registerUser(app, 'listadmin')
    await promoteToAdmin(admin.user.id)

    // admin's token was issued before promotion; re-login to get a fresh
    // token carrying role=admin (mirrors the documented re-login requirement)
    const loginResponse = await app.inject({
      method: 'POST',
      url: '/auth/login',
      payload: { usernameOrEmail: 'listadmin', password: 'hunter2hunter2' },
    })
    const adminToken = loginResponse.json().token as string

    const response = await app.inject({
      method: 'GET',
      url: '/admin/users',
      headers: { authorization: `Bearer ${adminToken}` },
    })

    expect(response.statusCode).toBe(200)
    const users = response.json() as Array<{ username: string; jobs: Array<{ jobName: string; level: number }> }>
    const playerEntry = users.find((u) => u.username === 'listedplayer')
    expect(playerEntry?.jobs).toEqual([{ jobName: 'Trappeur', level: 10 }])
  })

  it('lets an admin edit another user\'s username, email, and jobs', async () => {
    const app = buildApp()
    const player = await registerUser(app, 'editme')
    const admin = await registerUser(app, 'editadmin')
    await promoteToAdmin(admin.user.id)
    const loginResponse = await app.inject({
      method: 'POST',
      url: '/auth/login',
      payload: { usernameOrEmail: 'editadmin', password: 'hunter2hunter2' },
    })
    const adminToken = loginResponse.json().token as string

    const response = await app.inject({
      method: 'PUT',
      url: `/admin/users/${player.user.id}`,
      headers: { authorization: `Bearer ${adminToken}` },
      payload: { username: 'editedname', jobs: { Trappeur: 99 } },
    })

    expect(response.statusCode).toBe(200)

    const listResponse = await app.inject({
      method: 'GET',
      url: '/admin/users',
      headers: { authorization: `Bearer ${adminToken}` },
    })
    const users = listResponse.json() as Array<{ username: string; jobs: Array<{ jobName: string; level: number }> }>
    const edited = users.find((u) => u.username === 'editedname')
    expect(edited).toBeDefined()
    expect(edited?.jobs).toEqual([{ jobName: 'Trappeur', level: 99 }])
  })

  it('ignores a role field in the edit payload', async () => {
    const app = buildApp()
    const player = await registerUser(app, 'roleimmune')
    const admin = await registerUser(app, 'roleimmuneadmin')
    await promoteToAdmin(admin.user.id)
    const loginResponse = await app.inject({
      method: 'POST',
      url: '/auth/login',
      payload: { usernameOrEmail: 'roleimmuneadmin', password: 'hunter2hunter2' },
    })
    const adminToken = loginResponse.json().token as string

    await app.inject({
      method: 'PUT',
      url: `/admin/users/${player.user.id}`,
      headers: { authorization: `Bearer ${adminToken}` },
      payload: { role: 'admin' },
    })

    const rows = await pool.query('SELECT role FROM users WHERE id = $1', [player.user.id])
    expect(rows.rows[0].role).toBe('player')
  })

  it('lets an admin delete another user', async () => {
    const app = buildApp()
    const player = await registerUser(app, 'deleteme')
    const admin = await registerUser(app, 'deleteadmin')
    await promoteToAdmin(admin.user.id)
    const loginResponse = await app.inject({
      method: 'POST',
      url: '/auth/login',
      payload: { usernameOrEmail: 'deleteadmin', password: 'hunter2hunter2' },
    })
    const adminToken = loginResponse.json().token as string

    const response = await app.inject({
      method: 'DELETE',
      url: `/admin/users/${player.user.id}`,
      headers: { authorization: `Bearer ${adminToken}` },
    })

    expect(response.statusCode).toBe(200)

    const rows = await pool.query('SELECT id FROM users WHERE id = $1', [player.user.id])
    expect(rows.rows).toHaveLength(0)
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd server && npx vitest run tests/routes/admin.test.ts`
Expected: FAIL — routes not registered (404s where 200/403 expected).

- [ ] **Step 3: Write `server/src/admin/plugin.ts`**

```typescript
import type { FastifyInstance } from 'fastify'
import { z } from 'zod'
import { pool } from '../db'
import { requireAdmin } from '../auth/jwt'
import { isValidJobName, clampLevel } from '../jobs'

const updateUserSchema = z.object({
  username: z.string().min(3).max(32).optional(),
  email: z.string().email().optional(),
  jobs: z.record(z.string(), z.number()).optional(),
})

export async function adminPlugin(app: FastifyInstance): Promise<void> {
  app.get('/admin/users', { preHandler: requireAdmin }, async () => {
    const usersResult = await pool.query(
      'SELECT id, username, email, role, created_at FROM users ORDER BY created_at'
    )

    const users = []
    for (const user of usersResult.rows) {
      const jobsResult = await pool.query(
        'SELECT job_name, level FROM user_jobs WHERE user_id = $1 ORDER BY job_name',
        [user.id]
      )
      users.push({
        id: user.id,
        username: user.username,
        email: user.email,
        role: user.role,
        createdAt: user.created_at,
        jobs: jobsResult.rows.map((r) => ({ jobName: r.job_name, level: r.level })),
      })
    }

    return users
  })

  app.put('/admin/users/:id', { preHandler: requireAdmin }, async (request, reply) => {
    const { id } = request.params as { id: string }
    const parsed = updateUserSchema.safeParse(request.body)
    if (!parsed.success) {
      return reply.code(400).send({ error: parsed.error.message })
    }
    const { username, email, jobs } = parsed.data

    if (jobs) {
      for (const jobName of Object.keys(jobs)) {
        if (!isValidJobName(jobName)) {
          return reply.code(400).send({ error: `Unknown job: ${jobName}` })
        }
      }
    }

    const client = await pool.connect()
    try {
      await client.query('BEGIN')

      if (username !== undefined || email !== undefined) {
        const setParts: string[] = []
        const values: unknown[] = []
        if (username !== undefined) {
          values.push(username)
          setParts.push(`username = $${values.length}`)
        }
        if (email !== undefined) {
          values.push(email)
          setParts.push(`email = $${values.length}`)
        }
        values.push(id)
        await client.query(`UPDATE users SET ${setParts.join(', ')} WHERE id = $${values.length}`, values)
      }

      if (jobs) {
        for (const [jobName, level] of Object.entries(jobs)) {
          await client.query(
            `INSERT INTO user_jobs (user_id, job_name, level, updated_at)
             VALUES ($1, $2, $3, now())
             ON CONFLICT (user_id, job_name) DO UPDATE SET level = $3, updated_at = now()`,
            [id, jobName, clampLevel(level)]
          )
        }
      }

      await client.query('COMMIT')
      return { ok: true }
    } catch (err) {
      await client.query('ROLLBACK')
      if ((err as { code?: string }).code === '23505') {
        return reply.code(409).send({ error: 'Username or email already taken' })
      }
      throw err
    } finally {
      client.release()
    }
  })

  app.delete('/admin/users/:id', { preHandler: requireAdmin }, async (request) => {
    const { id } = request.params as { id: string }
    await pool.query('DELETE FROM users WHERE id = $1', [id])
    return { ok: true }
  })
}
```

- [ ] **Step 4: Modify `server/src/app.ts`**

```typescript
import Fastify, { type FastifyInstance } from 'fastify'
import { registerJwt } from './auth/jwt'
import { authPlugin } from './auth/plugin'
import { jobsRoutesPlugin } from './jobsRoutes/plugin'
import { friendsPlugin } from './friends/plugin'
import { adminPlugin } from './admin/plugin'

export function buildApp(): FastifyInstance {
  const app = Fastify()
  registerJwt(app)
  app.register(authPlugin)
  app.register(jobsRoutesPlugin)
  app.register(friendsPlugin)
  app.register(adminPlugin)
  return app
}
```

- [ ] **Step 5: Run test to verify it passes**

Run: `cd server && npx vitest run tests/routes/admin.test.ts`
Expected: PASS

- [ ] **Step 6: Run the full backend test suite**

Run: `cd server && npx vitest run`
Expected: all PASS.

- [ ] **Step 7: Typecheck and build**

Run: `cd server && npx tsc --noEmit && npm run build`
Expected: no errors.

- [ ] **Step 8: Commit**

```bash
git add server/src/admin/plugin.ts server/src/app.ts server/tests/routes/admin.test.ts
git commit -m "server: add admin routes for listing, editing, and deleting user accounts"
```

---

## Post-plan note

This plan does not deploy the migration or updated server code to the production Render/Supabase
setup. After merging, apply migration `002_add_user_role.sql` to the production database (same
`npx ts-node scripts/migrate.ts` process used for `001_init.sql`, pointed at production
`DATABASE_URL`) and redeploy the Render service before any admin promotion is attempted in
production. Promoting yourself to admin means running, against the production database:

```sql
UPDATE users SET role = 'admin' WHERE username = '<your-username>';
```

then logging out and back in inside the app to get a token carrying the new role.