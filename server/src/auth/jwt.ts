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
