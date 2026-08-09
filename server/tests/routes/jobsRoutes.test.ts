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
