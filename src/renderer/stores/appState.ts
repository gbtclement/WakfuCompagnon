import { defineStore } from 'pinia'
import type { AppConfig, TimerRecord } from '../../main/store'
import type { WakfuEvent } from '../../main/parsers/types'

interface AppStateShape {
  config: AppConfig
  liveEvents: WakfuEvent[]
}

export const useAppStore = defineStore('app', {
  state: (): AppStateShape => ({
    config: { logPath: null, followedQuestIds: [], timers: [], history: [] },
    liveEvents: []
  }),
  actions: {
    async load(): Promise<void> {
      this.config = await window.wakfuApi.getConfig()
      window.wakfuApi.onWakfuEvent((event) => {
        this.liveEvents = [event, ...this.liveEvents]
      })
      window.wakfuApi.onTimerExpired((timer) => {
        this.config.timers = this.config.timers.filter((t: TimerRecord) => t.id !== timer.id)
      })
    },
    async setLogPath(path: string): Promise<void> {
      this.config = await window.wakfuApi.setLogPath(path)
    },
    async browseLogFile(): Promise<void> {
      const path = await window.wakfuApi.browseLogFile()
      if (path) this.config = await window.wakfuApi.getConfig()
    },
    async followQuest(id: number): Promise<void> {
      this.config = await window.wakfuApi.followQuest(id)
    },
    async unfollowQuest(id: number): Promise<void> {
      this.config = await window.wakfuApi.unfollowQuest(id)
    },
    async createTimer(name: string, durationMs: number): Promise<void> {
      const timer = await window.wakfuApi.createTimer(name, durationMs)
      this.config.timers = [...this.config.timers, timer]
    },
    async cancelTimer(id: string): Promise<void> {
      this.config = await window.wakfuApi.cancelTimer(id)
    }
  }
})
