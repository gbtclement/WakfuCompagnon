import { contextBridge, ipcRenderer } from 'electron'
import type { AppConfig, TimerRecord } from '../main/store'
import type { WakfuEvent } from '../main/parsers/types'

const api = {
  getConfig: (): Promise<AppConfig> => ipcRenderer.invoke('get-config'),
  openExternal: (url: string): Promise<void> => ipcRenderer.invoke('open-external', url),
  setLogPath: (path: string): Promise<AppConfig> => ipcRenderer.invoke('set-log-path', path),
  browseLogFile: (): Promise<string | null> => ipcRenderer.invoke('browse-log-file'),
  followQuest: (id: string): Promise<AppConfig> => ipcRenderer.invoke('follow-quest', id),
  unfollowQuest: (id: string): Promise<AppConfig> => ipcRenderer.invoke('unfollow-quest', id),
  createTimer: (name: string, durationMs: number): Promise<TimerRecord> =>
    ipcRenderer.invoke('create-timer', name, durationMs),
  cancelTimer: (id: string): Promise<AppConfig> => ipcRenderer.invoke('cancel-timer', id),
  onWakfuEvent: (callback: (event: WakfuEvent) => void): void => {
    ipcRenderer.on('wakfu-event-pushed', (_event, payload: WakfuEvent) => callback(payload))
  },
  onTimerExpired: (callback: (timer: TimerRecord) => void): void => {
    ipcRenderer.on('timer-expired', (_event, payload: TimerRecord) => callback(payload))
  },
  addEnvironmentalQuest: (name: string): Promise<AppConfig> =>
    ipcRenderer.invoke('add-environmental-quest', name),
  updateEnvironmentalQuest: (id: string, name: string): Promise<AppConfig> =>
    ipcRenderer.invoke('update-environmental-quest', id, name),
  removeEnvironmentalQuest: (id: string): Promise<AppConfig> =>
    ipcRenderer.invoke('remove-environmental-quest', id),
  addArchimonster: (name: string, respawnMinutes: number): Promise<AppConfig> =>
    ipcRenderer.invoke('add-archimonster', name, respawnMinutes),
  updateArchimonster: (id: string, name: string, respawnMinutes: number): Promise<AppConfig> =>
    ipcRenderer.invoke('update-archimonster', id, name, respawnMinutes),
  removeArchimonster: (id: string): Promise<AppConfig> =>
    ipcRenderer.invoke('remove-archimonster', id),
  addExploit: (name: string, questIds: string[], archimonsterIds: string[]): Promise<AppConfig> =>
    ipcRenderer.invoke('add-exploit', name, questIds, archimonsterIds),
  updateExploit: (id: string, name: string, questIds: string[], archimonsterIds: string[]): Promise<AppConfig> =>
    ipcRenderer.invoke('update-exploit', id, name, questIds, archimonsterIds),
  removeExploit: (id: string): Promise<AppConfig> =>
    ipcRenderer.invoke('remove-exploit', id),
  authRegister: (payload: {
    username: string
    email: string
    password: string
    jobs: Record<string, number>
  }): Promise<{ user: { username: string; friendCode: string; role: 'player' | 'admin' } } | { error: string }> =>
    ipcRenderer.invoke('auth-register', payload),
  authLogin: (payload: {
    usernameOrEmail: string
    password: string
  }): Promise<{ user: { username: string; friendCode: string; role: 'player' | 'admin' } } | { error: string }> =>
    ipcRenderer.invoke('auth-login', payload),
  authLogout: (): Promise<void> => ipcRenderer.invoke('auth-logout'),
  authGetSession: (): Promise<{ username: string; friendCode: string; role: 'player' | 'admin' } | null> =>
    ipcRenderer.invoke('auth-get-session'),
  getMyJobs: (): Promise<{ jobName: string; level: number }[]> => ipcRenderer.invoke('job-get-mine'),
  updateJobManual: (jobName: string, level: number): Promise<{ jobName: string; level: number } | null> =>
    ipcRenderer.invoke('job-update-manual', jobName, level),
  sendFriendRequest: (friendCode: string): Promise<void> =>
    ipcRenderer.invoke('friends-send-request', friendCode),
  getPendingFriendRequests: (): Promise<{ id: string; fromUsername: string }[]> =>
    ipcRenderer.invoke('friends-pending-requests'),
  acceptFriendRequest: (id: string): Promise<void> => ipcRenderer.invoke('friends-accept-request', id),
  rejectFriendRequest: (id: string): Promise<void> => ipcRenderer.invoke('friends-reject-request', id),
  getFriends: (): Promise<{ username: string; jobs: { jobName: string; level: number }[] }[]> =>
    ipcRenderer.invoke('friends-list'),
  adminListUsers: (): Promise<
    { id: string; username: string; email: string; role: string; createdAt: string; jobs: { jobName: string; level: number }[] }[]
  > => ipcRenderer.invoke('admin-list-users'),
  adminUpdateUser: (
    id: string,
    payload: { username?: string; email?: string; jobs?: Record<string, number> }
  ): Promise<void> => ipcRenderer.invoke('admin-update-user', id, payload),
  adminDeleteUser: (id: string): Promise<void> => ipcRenderer.invoke('admin-delete-user', id),
  downloadUpdate: (): Promise<void> => ipcRenderer.invoke('update-download'),
  onUpdateAvailable: (callback: (info: { version: string }) => void): void => {
    ipcRenderer.on('update-available-pushed', (_event, payload: { version: string }) => callback(payload))
  },
  onUpdateDownloadProgress: (callback: (info: { percent: number }) => void): void => {
    ipcRenderer.on('update-download-progress-pushed', (_event, payload: { percent: number }) => callback(payload))
  },
  onUpdateDownloaded: (callback: () => void): void => {
    ipcRenderer.on('update-downloaded-pushed', () => callback())
  },
  onUpdateError: (callback: (info: { message: string }) => void): void => {
    ipcRenderer.on('update-error-pushed', (_event, payload: { message: string }) => callback(payload))
  }
}

export type WakfuApi = typeof api

contextBridge.exposeInMainWorld('wakfuApi', api)
