import Store from 'electron-store'
import { WakfuEvent } from './parsers/types'

export interface TimerRecord {
  id: string
  name: string
  endsAt: number
}

export interface AppConfig {
  logPath: string | null
  followedQuestIds: number[]
  timers: TimerRecord[]
  history: WakfuEvent[]
}

const DEFAULTS: AppConfig = {
  logPath: null,
  followedQuestIds: [],
  timers: [],
  history: []
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
      history: this.store.get('history')
    }
  }

  setLogPath(path: string): void {
    this.store.set('logPath', path)
  }

  addFollowedQuest(id: number): void {
    const ids = this.store.get('followedQuestIds')
    if (!ids.includes(id)) {
      this.store.set('followedQuestIds', [...ids, id])
    }
  }

  removeFollowedQuest(id: number): void {
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
}
