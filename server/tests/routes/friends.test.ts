import { describe, it, expect, beforeEach } from 'vitest';
import { buildApp } from '../../src/app';
import { resetTestDb } from '../testDb';

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
  });
  return response.json() as { token: string; user: { id: string; friendCode: string } };
}

describe('friends flow', () => {
  beforeEach(async () => {
    await resetTestDb();
  });

  it('sends a request, lists it as pending, accepts it, then lists as friends', async () => {
    const app = buildApp();
    const alice = await registerUser(app, 'alice');
    const bob = await registerUser(app, 'bob');

    const sendResponse = await app.inject({
      method: 'POST',
      url: '/friends/request',
      headers: { authorization: `Bearer ${alice.token}` },
      payload: { friendCode: bob.user.friendCode },
    });
    expect(sendResponse.statusCode).toBe(201);

    const pendingResponse = await app.inject({
      method: 'GET',
      url: '/friends/requests',
      headers: { authorization: `Bearer ${bob.token}` },
    });
    expect(pendingResponse.statusCode).toBe(200);
    const pending = pendingResponse.json();
    expect(pending).toHaveLength(1);
    expect(pending[0].fromUsername).toBe('alice');

    const acceptResponse = await app.inject({
      method: 'POST',
      url: `/friends/requests/${pending[0].id}/accept`,
      headers: { authorization: `Bearer ${bob.token}` },
    });
    expect(acceptResponse.statusCode).toBe(200);

    const aliceFriends = await app.inject({
      method: 'GET',
      url: '/friends',
      headers: { authorization: `Bearer ${alice.token}` },
    });
    const friendsList = aliceFriends.json();
    expect(friendsList).toHaveLength(1);
    expect(friendsList[0].username).toBe('bob');
    expect(friendsList[0].jobs).toEqual([{ jobName: 'Trappeur', level: 10 }]);
  });

  it('rejects a request to an unknown friend code', async () => {
    const app = buildApp();
    const alice = await registerUser(app, 'alice');

    const response = await app.inject({
      method: 'POST',
      url: '/friends/request',
      headers: { authorization: `Bearer ${alice.token}` },
      payload: { friendCode: 'WC-NOTFND' },
    });

    expect(response.statusCode).toBe(404);
  });

  it('rejecting a request removes it without creating a friendship', async () => {
    const app = buildApp();
    const alice = await registerUser(app, 'alice');
    const bob = await registerUser(app, 'bob');

    await app.inject({
      method: 'POST',
      url: '/friends/request',
      headers: { authorization: `Bearer ${alice.token}` },
      payload: { friendCode: bob.user.friendCode },
    });

    const pendingResponse = await app.inject({
      method: 'GET',
      url: '/friends/requests',
      headers: { authorization: `Bearer ${bob.token}` },
    });
    const requestId = pendingResponse.json()[0].id;

    await app.inject({
      method: 'POST',
      url: `/friends/requests/${requestId}/reject`,
      headers: { authorization: `Bearer ${bob.token}` },
    });

    const bobFriends = await app.inject({
      method: 'GET',
      url: '/friends',
      headers: { authorization: `Bearer ${bob.token}` },
    });
    expect(bobFriends.json()).toHaveLength(0);
  });
});
