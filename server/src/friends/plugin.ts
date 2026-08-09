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
