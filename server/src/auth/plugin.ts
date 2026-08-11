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
        `INSERT INTO users (username, email, password_hash, friend_code, role)
         VALUES ($1, $2, $3, $4, 'player')
         RETURNING id, username, friend_code, role`,
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

      const token = app.jwt.sign({ userId: user.id, role: user.role }, { expiresIn: '30d' });
      return reply.code(201).send({
        token,
        user: { id: user.id, username: user.username, friendCode: user.friend_code, role: user.role },
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
      `SELECT id, username, friend_code, password_hash, role FROM users
       WHERE username = $1
       UNION ALL
       SELECT id, username, friend_code, password_hash, role FROM users
       WHERE email = $1
       LIMIT 1`,
      [usernameOrEmail]
    );
    const user = rows.rows[0];
    if (!user || !(await verifyPassword(user.password_hash, password))) {
      return reply.code(401).send({ error: 'Invalid credentials' });
    }

    const token = app.jwt.sign({ userId: user.id, role: user.role }, { expiresIn: '30d' });
    return reply.send({
      token,
      user: { id: user.id, username: user.username, friendCode: user.friend_code, role: user.role },
    });
  });
}
