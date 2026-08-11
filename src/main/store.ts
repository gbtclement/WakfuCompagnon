import { randomUUID } from 'crypto'
import Store from 'electron-store'
import { WakfuEvent } from './parsers/types'
import { encryptToken, decryptToken } from './session'

export interface TimerRecord {
  id: string
  name: string
  endsAt: number
  durationMs: number
}

export interface EnvironmentalQuest {
  id: string
  name: string
}

export interface Archimonster {
  id: string
  name: string
  respawnMinutes: number
}

export interface Exploit {
  id: string
  name: string
  questIds: string[]
  archimonsterIds: string[]
}

export interface AppConfig {
  logPath: string | null
  followedQuestIds: string[]
  timers: TimerRecord[]
  history: WakfuEvent[]
  environmentalQuests: EnvironmentalQuest[]
  archimonsters: Archimonster[]
  exploits: Exploit[]
  authToken: string | null
  currentUser: { username: string; friendCode: string; role: 'player' | 'admin' } | null
}

const DEFAULTS: AppConfig = {
  logPath: null,
  followedQuestIds: [],
  timers: [],
  history: [],
  environmentalQuests: [],
  archimonsters: [],
  exploits: [],
  authToken: null,
  currentUser: null
}

export class AppStore {
  private store: Store<AppConfig>

  constructor(cwd?: string) {
    this.store = new Store<AppConfig>({ defaults: DEFAULTS, cwd })
  }

  getConfig(): AppConfig {
    return {
      logPath: this.store.get('logPath'),
      followedQuestIds: this.store.get('followedQuestIds'),
      timers: this.store.get('timers'),
      history: this.store.get('history'),
      environmentalQuests: this.store.get('environmentalQuests'),
      archimonsters: this.store.get('archimonsters'),
      exploits: this.store.get('exploits'),
      authToken: this.store.get('authToken'),
      currentUser: this.store.get('currentUser')
    }
  }

  setLogPath(path: string): void {
    this.store.set('logPath', path)
  }

  addFollowedQuest(id: string): void {
    const ids = this.store.get('followedQuestIds')
    if (!ids.includes(id)) {
      this.store.set('followedQuestIds', [...ids, id])
    }
  }

  removeFollowedQuest(id: string): void {
    const ids = this.store.get('followedQuestIds')
    this.store.set('followedQuestIds', ids.filter((existing) => existing !== id))
  }

  addTimer(timer: TimerRecord): void {
    this.store.set('timers', [...this.store.get('timers'), timer])
  }

  removeTimer(id: string): void {
    this.store.set('timers', this.store.get('timers').filter((t) => t.id !== id))
  }

  appendHistoryEvent(event: WakfuEvent): void {
    this.store.set('history', [...this.store.get('history'), event])
  }

  addEnvironmentalQuest(name: string): EnvironmentalQuest {
    const quest: EnvironmentalQuest = { id: randomUUID(), name }
    this.store.set('environmentalQuests', [...this.store.get('environmentalQuests'), quest])
    return quest
  }

  updateEnvironmentalQuest(id: string, name: string): void {
    const quests = this.store.get('environmentalQuests').map((q) => (q.id === id ? { ...q, name } : q))
    this.store.set('environmentalQuests', quests)
  }

  removeEnvironmentalQuest(id: string): void {
    this.store.set('environmentalQuests', this.store.get('environmentalQuests').filter((q) => q.id !== id))
    const exploits = this.store.get('exploits').map((e) => ({
      ...e,
      questIds: e.questIds.filter((qid) => qid !== id)
    }))
    this.store.set('exploits', exploits)
  }

  addArchimonster(archimonster: Archimonster): void {
    this.store.set('archimonsters', [...this.store.get('archimonsters'), archimonster])
  }

  updateArchimonster(id: string, name: string, respawnMinutes: number): void {
    const archimonsters = this.store.get('archimonsters').map((a) => (a.id === id ? { ...a, name, respawnMinutes } : a))
    this.store.set('archimonsters', archimonsters)
  }

  removeArchimonster(id: string): void {
    this.store.set('archimonsters', this.store.get('archimonsters').filter((a) => a.id !== id))
    const exploits = this.store.get('exploits').map((e) => ({
      ...e,
      archimonsterIds: e.archimonsterIds.filter((aid) => aid !== id)
    }))
    this.store.set('exploits', exploits)
  }

  addExploit(exploit: Exploit): void {
    this.store.set('exploits', [...this.store.get('exploits'), exploit])
  }

  updateExploit(id: string, name: string, questIds: string[], archimonsterIds: string[]): void {
    const exploits = this.store.get('exploits').map((e) => (e.id === id ? { ...e, name, questIds, archimonsterIds } : e))
    this.store.set('exploits', exploits)
  }

  removeExploit(id: string): void {
    this.store.set('exploits', this.store.get('exploits').filter((e) => e.id !== id))
  }

  setSession(token: string | null, user: { username: string; friendCode: string; role: 'player' | 'admin' } | null): void {
    this.store.set('authToken', token ? encryptToken(token) : null)
    this.store.set('currentUser', user)
  }

  getSession(): { token: string | null; user: { username: string; friendCode: string; role: 'player' | 'admin' } | null } {
    const encrypted = this.store.get('authToken')
    return {
      token: encrypted ? decryptToken(encrypted) : null,
      user: this.store.get('currentUser')
    }
  }
}
