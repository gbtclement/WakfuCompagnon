import { defineStore } from 'pinia'
import type { AppConfig } from '../../main/store'

interface AdminStateShape {
  config: AppConfig
}

export const useAdminStore = defineStore('admin', {
  state: (): AdminStateShape => ({
    config: {
      logPath: null,
      followedQuestIds: [],
      timers: [],
      history: [],
      environmentalQuests: [],
      archimonsters: [],
      exploits: []
    }
  }),
  actions: {
    async load(): Promise<void> {
      this.config = await window.wakfuApi.getConfig()
    },
    async addQuest(name: string): Promise<void> {
      this.config = await window.wakfuApi.addEnvironmentalQuest(name)
    },
    async updateQuest(id: string, name: string): Promise<void> {
      this.config = await window.wakfuApi.updateEnvironmentalQuest(id, name)
    },
    async removeQuest(id: string): Promise<void> {
      this.config = await window.wakfuApi.removeEnvironmentalQuest(id)
    },
    async addArchimonster(name: string, respawnMinutes: number): Promise<void> {
      this.config = await window.wakfuApi.addArchimonster(name, respawnMinutes)
    },
    async updateArchimonster(id: string, name: string, respawnMinutes: number): Promise<void> {
      this.config = await window.wakfuApi.updateArchimonster(id, name, respawnMinutes)
    },
    async removeArchimonster(id: string): Promise<void> {
      this.config = await window.wakfuApi.removeArchimonster(id)
    },
    async addExploit(name: string, questIds: string[], archimonsterIds: string[]): Promise<void> {
      this.config = await window.wakfuApi.addExploit(name, questIds, archimonsterIds)
    },
    async updateExploit(id: string, name: string, questIds: string[], archimonsterIds: string[]): Promise<void> {
      this.config = await window.wakfuApi.updateExploit(id, name, questIds, archimonsterIds)
    },
    async removeExploit(id: string): Promise<void> {
      this.config = await window.wakfuApi.removeExploit(id)
    }
  }
})
