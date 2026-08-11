import { net } from 'electron'

export const DEFAULT_API_BASE_URL = 'https://wakfu-companion-server.onrender.com'

export class ApiError extends Error {
  status: number

  constructor(status: number, message: string) {
    super(message)
    this.status = status
  }
}

export interface AuthResult {
  token: string
  user: { id: string; username: string; friendCode: string; role: string }
}

export interface JobEntry {
  jobName: string
  level: number
}

export interface FriendRequestSummary {
  id: string
  fromUsername: string
}

export interface FriendWithJobs {
  username: string
  jobs: JobEntry[]
}

export interface AdminUserView {
  id: string
  username: string
  email: string
  role: string
  createdAt: string
  jobs: JobEntry[]
}

type FetchFn = typeof net.fetch

async function request<T>(
  fetchFn: FetchFn,
  baseUrl: string,
  path: string,
  options: { method?: string; token?: string; body?: unknown } = {}
): Promise<T> {
  const headers: Record<string, string> = { 'Content-Type': 'application/json' }
  if (options.token) headers.Authorization = `Bearer ${options.token}`

  const response = await fetchFn(`${baseUrl}${path}`, {
    method: options.method ?? 'GET',
    headers,
    body: options.body !== undefined ? JSON.stringify(options.body) : undefined
  })

  const data = await response.json()
  if (!response.ok) {
    throw new ApiError(response.status, (data as { error?: string }).error ?? 'Request failed')
  }
  return data as T
}

export function createApiClient(baseUrl: string, fetchFn?: FetchFn) {
  const resolvedFetch = fetchFn ?? net.fetch
  return {
    register(payload: {
      username: string
      email: string
      password: string
      jobs: Record<string, number>
    }): Promise<AuthResult> {
      return request(resolvedFetch, baseUrl, '/auth/register', { method: 'POST', body: payload })
    },

    login(payload: { usernameOrEmail: string; password: string }): Promise<AuthResult> {
      return request(resolvedFetch, baseUrl, '/auth/login', { method: 'POST', body: payload })
    },

    getMyJobs(token: string): Promise<JobEntry[]> {
      return request(resolvedFetch, baseUrl, '/me/jobs', { token })
    },

    updateMyJob(token: string, jobName: string, level: number): Promise<JobEntry> {
      return request(resolvedFetch, baseUrl, `/me/jobs/${encodeURIComponent(jobName)}`, {
        method: 'PUT',
        token,
        body: { level }
      })
    },

    sendFriendRequest(token: string, friendCode: string): Promise<void> {
      return request(resolvedFetch, baseUrl, '/friends/request', { method: 'POST', token, body: { friendCode } })
    },

    getPendingRequests(token: string): Promise<FriendRequestSummary[]> {
      return request(resolvedFetch, baseUrl, '/friends/requests', { token })
    },

    acceptFriendRequest(token: string, id: string): Promise<void> {
      return request(resolvedFetch, baseUrl, `/friends/requests/${encodeURIComponent(id)}/accept`, {
        method: 'POST',
        token
      })
    },

    rejectFriendRequest(token: string, id: string): Promise<void> {
      return request(resolvedFetch, baseUrl, `/friends/requests/${encodeURIComponent(id)}/reject`, {
        method: 'POST',
        token
      })
    },

    getFriends(token: string): Promise<FriendWithJobs[]> {
      return request(resolvedFetch, baseUrl, '/friends', { token })
    },

    getAdminUsers(token: string): Promise<AdminUserView[]> {
      return request(resolvedFetch, baseUrl, '/admin/users', { token })
    },

    updateAdminUser(
      token: string,
      id: string,
      payload: { username?: string; email?: string; jobs?: Record<string, number> }
    ): Promise<void> {
      return request(resolvedFetch, baseUrl, `/admin/users/${encodeURIComponent(id)}`, {
        method: 'PUT',
        token,
        body: payload
      })
    },

    deleteAdminUser(token: string, id: string): Promise<void> {
      return request(resolvedFetch, baseUrl, `/admin/users/${encodeURIComponent(id)}`, {
        method: 'DELETE',
        token
      })
    }
  }
}

let defaultClient: ReturnType<typeof createApiClient> | null = null

export function getApiClient(): ReturnType<typeof createApiClient> {
  if (!defaultClient) {
    defaultClient = createApiClient(DEFAULT_API_BASE_URL)
  }
  return defaultClient
}
