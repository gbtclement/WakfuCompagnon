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
