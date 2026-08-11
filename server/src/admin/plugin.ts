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
