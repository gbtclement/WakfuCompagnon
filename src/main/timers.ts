import { randomUUID } from 'crypto'
import { AppStore, TimerRecord } from './store'

export class TimerManager {
  private handles = new Map<string, NodeJS.Timeout>()

  constructor(
    private readonly store: AppStore,
    private readonly onExpire: (timer: TimerRecord) => void
  ) {}

  start(): void {
    for (const timer of this.store.getConfig().timers) {
      this.arm(timer)
    }
  }

  stop(): void {
    for (const handle of this.handles.values()) clearTimeout(handle)
    this.handles.clear()
  }

  createTimer(name: string, durationMs: number): TimerRecord {
    const timer: TimerRecord = { id: randomUUID(), name, endsAt: Date.now() + durationMs, durationMs }
    this.store.addTimer(timer)
    this.arm(timer)
    return timer
  }

  cancelTimer(id: string): void {
    const handle = this.handles.get(id)
    if (handle) clearTimeout(handle)
    this.handles.delete(id)
    this.store.removeTimer(id)
  }

  private arm(timer: TimerRecord): void {
    const delay = Math.max(0, timer.endsAt - Date.now())
    const handle = setTimeout(() => {
      this.handles.delete(timer.id)
      this.store.removeTimer(timer.id)
      this.onExpire(timer)
    }, delay)
    this.handles.set(timer.id, handle)
  }
}
