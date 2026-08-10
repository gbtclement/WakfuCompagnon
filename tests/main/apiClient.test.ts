import { describe, it, expect, vi } from 'vitest'
import { createApiClient, ApiError } from '../../src/main/apiClient'

function mockFetch(status: number, body: unknown) {
  return vi.fn().mockResolvedValue({
    ok: status >= 200 && status < 300,
    status,
    json: async () => body
  })
}

describe('apiClient', () => {
  it('register posts credentials and jobs, returns token and user', async () => {
    const fetchFn = mockFetch(201, {
      token: 'tok123',
      user: { id: 'u1', username: 'clement', friendCode: 'WC-ABCDEF' }
    })
    const client = createApiClient('http://localhost:3000', fetchFn)

    const result = await client.register({
      username: 'clement',
      email: 'clement@example.com',
      password: 'hunter2hunter2',
      jobs: { Trappeur: 10 }
    })

    expect(result).toEqual({ token: 'tok123', user: { id: 'u1', username: 'clement', friendCode: 'WC-ABCDEF' } })
    expect(fetchFn).toHaveBeenCalledWith(
      'http://localhost:3000/auth/register',
      expect.objectContaining({
        method: 'POST',
        headers: expect.objectContaining({ 'Content-Type': 'application/json' }),
        body: JSON.stringify({
          username: 'clement',
          email: 'clement@example.com',
          password: 'hunter2hunter2',
          jobs: { Trappeur: 10 }
        })
      })
    )
  })

  it('login throws ApiError with the server message on 401', async () => {
    const fetchFn = mockFetch(401, { error: 'Invalid credentials' })
    const client = createApiClient('http://localhost:3000', fetchFn)

    await expect(
      client.login({ usernameOrEmail: 'clement', password: 'wrong' })
    ).rejects.toMatchObject({ status: 401, message: 'Invalid credentials' })
  })

  it('getMyJobs sends the bearer token and returns the job list', async () => {
    const fetchFn = mockFetch(200, [{ jobName: 'Trappeur', level: 10 }])
    const client = createApiClient('http://localhost:3000', fetchFn)

    const jobs = await client.getMyJobs('tok123')

    expect(jobs).toEqual([{ jobName: 'Trappeur', level: 10 }])
    expect(fetchFn).toHaveBeenCalledWith(
      'http://localhost:3000/me/jobs',
      expect.objectContaining({ headers: expect.objectContaining({ Authorization: 'Bearer tok123' }) })
    )
  })

  it('updateMyJob PUTs the level and returns the updated job', async () => {
    const fetchFn = mockFetch(200, { jobName: 'Trappeur', level: 55 })
    const client = createApiClient('http://localhost:3000', fetchFn)

    const job = await client.updateMyJob('tok123', 'Trappeur', 55)

    expect(job).toEqual({ jobName: 'Trappeur', level: 55 })
    expect(fetchFn).toHaveBeenCalledWith(
      'http://localhost:3000/me/jobs/Trappeur',
      expect.objectContaining({ method: 'PUT', body: JSON.stringify({ level: 55 }) })
    )
  })

  it('sendFriendRequest posts the friend code', async () => {
    const fetchFn = mockFetch(201, { ok: true })
    const client = createApiClient('http://localhost:3000', fetchFn)

    await client.sendFriendRequest('tok123', 'WC-ABCDEF')

    expect(fetchFn).toHaveBeenCalledWith(
      'http://localhost:3000/friends/request',
      expect.objectContaining({ method: 'POST', body: JSON.stringify({ friendCode: 'WC-ABCDEF' }) })
    )
  })

  it('getPendingRequests and getFriends GET their endpoints', async () => {
    const pendingFetch = mockFetch(200, [{ id: 'r1', fromUsername: 'alice' }])
    const pendingClient = createApiClient('http://localhost:3000', pendingFetch)
    expect(await pendingClient.getPendingRequests('tok123')).toEqual([{ id: 'r1', fromUsername: 'alice' }])

    const friendsFetch = mockFetch(200, [{ username: 'bob', jobs: [] }])
    const friendsClient = createApiClient('http://localhost:3000', friendsFetch)
    expect(await friendsClient.getFriends('tok123')).toEqual([{ username: 'bob', jobs: [] }])
  })

  it('acceptFriendRequest and rejectFriendRequest POST to the right paths', async () => {
    const acceptFetch = mockFetch(200, { ok: true })
    await createApiClient('http://localhost:3000', acceptFetch).acceptFriendRequest('tok123', 'r1')
    expect(acceptFetch).toHaveBeenCalledWith(
      'http://localhost:3000/friends/requests/r1/accept',
      expect.objectContaining({ method: 'POST' })
    )

    const rejectFetch = mockFetch(200, { ok: true })
    await createApiClient('http://localhost:3000', rejectFetch).rejectFriendRequest('tok123', 'r1')
    expect(rejectFetch).toHaveBeenCalledWith(
      'http://localhost:3000/friends/requests/r1/reject',
      expect.objectContaining({ method: 'POST' })
    )
  })
})
