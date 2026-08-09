import Fastify, { type FastifyInstance } from 'fastify';
import { registerJwt } from './auth/jwt';
import { authPlugin } from './auth/plugin';

export function buildApp(): FastifyInstance {
  const app = Fastify();
  registerJwt(app);
  app.register(authPlugin);
  return app;
}
