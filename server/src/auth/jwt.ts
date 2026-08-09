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
