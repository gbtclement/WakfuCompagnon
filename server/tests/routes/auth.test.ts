import { describe, it, expect, beforeEach } from 'vitest';
import { buildApp } from '../../src/app';
import { resetTestDb } from '../testDb';

describe('POST /auth/register', () => {
  beforeEach(async () => {
    await resetTestDb();
  });

  it('creates a user with jobs and returns a token', async () => {
    const app = buildApp();
    const response = await app.inject({
      method: 'POST',
      url: '/auth/register',
      payload: {
        username: 'clement',
        email: 'clement@example.com',
        password: 'hunter2hunter2',
        jobs: { Trappeur: 42, Mineur: 10 },
      },
    });

    expect(response.statusCode).toBe(201);
    const body = response.json();
    expect(body.token).toBeTypeOf('string');
    expect(body.user.username).toBe('clement');
    expect(body.user.friendCode).toMatch(/^WC-/);
  });

  it('rejects a duplicate username', async () => {
    const app = buildApp();
    const payload = {
      username: 'clement',
      email: 'clement@example.com',
      password: 'hunter2hunter2',
      jobs: {},
    };
    await app.inject({ method: 'POST', url: '/auth/register', payload });
    const second = await app.inject({
      method: 'POST',
      url: '/auth/register',
      payload: { ...payload, email: 'other@example.com' },
    });

    expect(second.statusCode).toBe(409);
  });

  it('rejects an unknown job name', async () => {
    const app = buildApp();
    const response = await app.inject({
      method: 'POST',
      url: '/auth/register',
      payload: {
        username: 'clement',
        email: 'clement@example.com',
        password: 'hunter2hunter2',
        jobs: { NotAJob: 10 },
      },
    });

    expect(response.statusCode).toBe(400);
  });

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
});

describe('POST /auth/login', () => {
  beforeEach(async () => {
    await resetTestDb();
  });

  it('logs in with correct credentials', async () => {
    const app = buildApp();
    await app.inject({
      method: 'POST',
      url: '/auth/register',
      payload: {
        username: 'clement',
        email: 'clement@example.com',
        password: 'hunter2hunter2',
        jobs: {},
      },
    });

    const response = await app.inject({
      method: 'POST',
      url: '/auth/login',
      payload: { usernameOrEmail: 'clement', password: 'hunter2hunter2' },
    });

    expect(response.statusCode).toBe(200);
    expect(response.json().token).toBeTypeOf('string');
  });

  it('rejects wrong password', async () => {
    const app = buildApp();
    await app.inject({
      method: 'POST',
      url: '/auth/register',
      payload: {
        username: 'clement',
        email: 'clement@example.com',
        password: 'hunter2hunter2',
        jobs: {},
      },
    });

    const response = await app.inject({
      method: 'POST',
      url: '/auth/login',
      payload: { usernameOrEmail: 'clement', password: 'wrong' },
    });

    expect(response.statusCode).toBe(401);
  });

  it('logs into the account matched by username, not a different account whose email happens to equal that username', async () => {
    const app = buildApp();
    // victim's email equals attacker's chosen username
    await app.inject({
      method: 'POST',
      url: '/auth/register',
      payload: {
        username: 'victim',
        email: 'attacker@example.com',
        password: 'victim-password',
        jobs: {},
      },
    });
    await app.inject({
      method: 'POST',
      url: '/auth/register',
      payload: {
        username: 'attacker@example.com',
        email: 'attacker2@example.com',
        password: 'attacker-password',
        jobs: {},
      },
    });

    const response = await app.inject({
      method: 'POST',
      url: '/auth/login',
      payload: { usernameOrEmail: 'attacker@example.com', password: 'attacker-password' },
    });

    expect(response.statusCode).toBe(200);
    expect(response.json().user.username).toBe('attacker@example.com');
  });

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
});
