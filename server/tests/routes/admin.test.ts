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

  it("lets an admin edit another user's username, email, and jobs", async () => {
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
