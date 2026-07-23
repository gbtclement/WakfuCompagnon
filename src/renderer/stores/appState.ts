import { defineStore } from 'pinia'
import type { AppConfig, TimerRecord } from '../../main/store'
import type { WakfuEvent } from '../../main/parsers/types'
import { useToastStore } from './toasts'

interface AppStateShape {
  config: AppConfig
  liveEvents: WakfuEvent[]
}

export const useAppStore = defineStore('app', {
  state: (): AppStateShape => ({
    config: {
      logPath: null,
      followedQuestIds: [],
      timers: [],
      history: [],
      environmentalQuests: [],
      archimonsters: [],
      exploits: []
    },
    liveEvents: []
  }),
  actions: {
    async load(): Promise<void> {
      this.config = await window.wakfuApi.getConfig()
      const toastStore = useToastStore()

      window.wakfuApi.onWakfuEvent((event) => {
        this.liveEvents = [event, ...this.liveEvents]

        if (event.type === 'server-connection') {
          toastStore.push('info', 'Connecté au serveur', event.server)
        }
        if (event.type === 'quest-completed' || event.type === 'quest-failed') {
          const isFollowedEnvironmentalQuest = this.config.environmentalQuests.some(
            (q) => q.name === event.questName && this.config.followedQuestIds.includes(q.id)
          )
          if (isFollowedEnvironmentalQuest) {
            toastStore.push('success', 'Quête environnementale rencontrée', event.questName)
          }
        }
        if (event.type === 'quest-completed') {
          toastStore.push('success', 'Quête remportée', event.questName)
        }
        if (event.type === 'quest-failed') {
          toastStore.push('warning', 'Quête échouée', event.questName)
        }
      })
      window.wakfuApi.onTimerExpired((timer) => {
        this.config.timers = this.config.timers.filter((t: TimerRecord) => t.id !== timer.id)
        toastStore.push('warning', 'Timer expiré', timer.name)
      })
    },
    async setLogPath(path: string): Promise<void> {
      this.config = await window.wakfuApi.setLogPath(path)
    },
    async browseLogFile(): Promise<void> {
      const path = await window.wakfuApi.browseLogFile()
      if (path) this.config = await window.wakfuApi.getConfig()
    },
    async followQuest(id: string): Promise<void> {
      this.config = await window.wakfuApi.followQuest(id)
    },
    async unfollowQuest(id: string): Promise<void> {
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
