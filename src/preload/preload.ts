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
  },
  addEnvironmentalQuest: (id: number, name: string): Promise<AppConfig> =>
    ipcRenderer.invoke('add-environmental-quest', id, name),
  updateEnvironmentalQuest: (id: number, name: string): Promise<AppConfig> =>
    ipcRenderer.invoke('update-environmental-quest', id, name),
  removeEnvironmentalQuest: (id: number): Promise<AppConfig> =>
    ipcRenderer.invoke('remove-environmental-quest', id),
  addArchimonster: (name: string, respawnMinutes: number): Promise<AppConfig> =>
    ipcRenderer.invoke('add-archimonster', name, respawnMinutes),
  updateArchimonster: (id: string, name: string, respawnMinutes: number): Promise<AppConfig> =>
    ipcRenderer.invoke('update-archimonster', id, name, respawnMinutes),
  removeArchimonster: (id: string): Promise<AppConfig> =>
    ipcRenderer.invoke('remove-archimonster', id),
  addExploit: (name: string, questIds: number[], archimonsterIds: string[]): Promise<AppConfig> =>
    ipcRenderer.invoke('add-exploit', name, questIds, archimonsterIds),
  updateExploit: (id: string, name: string, questIds: number[], archimonsterIds: string[]): Promise<AppConfig> =>
    ipcRenderer.invoke('update-exploit', id, name, questIds, archimonsterIds),
  removeExploit: (id: string): Promise<AppConfig> =>
    ipcRenderer.invoke('remove-exploit', id)
}

export type WakfuApi = typeof api

contextBridge.exposeInMainWorld('wakfuApi', api)
