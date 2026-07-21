import { contextBridge, ipcRenderer } from 'electron'
import type { AppConfig, TimerRecord } from '../main/store'
import type { WakfuEvent } from '../main/parsers/types'

const api = {
  getConfig: (): Promise<AppConfig> => ipcRenderer.invoke('get-config'),
  setLogPath: (path: string): Promise<AppConfig> => ipcRenderer.invoke('set-log-path', path),
  browseLogFile: (): Promise<string | null> => ipcRenderer.invoke('browse-log-file'),
  followQuest: (id: number): Promise<AppConfig> => ipcRenderer.invoke('follow-quest', id),
  unfollowQuest: (id: number): Promise<AppConfig> => ipcRenderer.invoke('unfollow-quest', id),
  createTimer: (name: string, durationMs: number): Promise<TimerRecord> =>
    ipcRenderer.invoke('create-timer', name, durationMs),
  cancelTimer: (id: string): Promise<AppConfig> => ipcRenderer.invoke('cancel-timer', id),
  onWakfuEvent: (callback: (event: WakfuEvent) => void): void => {
    ipcRenderer.on('wakfu-event-pushed', (_event, payload: WakfuEvent) => callback(payload))
  },
  onTimerExpired: (callback: (timer: TimerRecord) => void): void => {
    ipcRenderer.on('timer-expired', (_event, payload: TimerRecord) => callback(payload))
  }
}

export type WakfuApi = typeof api

contextBridge.exposeInMainWorld('wakfuApi', api)
