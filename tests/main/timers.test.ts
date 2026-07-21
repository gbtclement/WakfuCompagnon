import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { mkdtempSync, rmSync } from 'fs'
import { join } from 'path'
import { tmpdir } from 'os'
import { AppStore, TimerRecord } from '../../src/main/store'
import { TimerManager } from '../../src/main/timers'

describe('TimerManager', () => {
  let cwd: string
  let store: AppStore

  beforeEach(() => {
    vi.useFakeTimers()
    cwd = mkdtempSync(join(tmpdir(), 'wakfu-timers-test-'))
    store = new AppStore(cwd)
  })

  afterEach(() => {
    vi.useRealTimers()
    rmSync(cwd, { recursive: true, force: true })
  })

  it('creates a timer, persists it, and fires onExpire after the duration', () => {
    const expired: TimerRecord[] = []
    const manager = new TimerManager(store, (t) => expired.push(t))
    manager.start()

    const timer = manager.createTimer('Boss X', 5000)
    expect(store.getConfig().timers.map((t) => t.id)).toContain(timer.id)

    vi.advanceTimersByTime(5000)

    expect(expired).toEqual([timer])
    expect(store.getConfig().timers).toEqual([])
  })

  it('cancels a timer before it fires', () => {
    const expired: TimerRecord[] = []
    const manager = new TimerManager(store, (t) => expired.push(t))
    manager.start()

    const timer = manager.createTimer('Boss Y', 5000)
    manager.cancelTimer(timer.id)

    vi.advanceTimersByTime(5000)

    expect(expired).toEqual([])
    expect(store.getConfig().timers).toEqual([])
  })

  it('re-arms a persisted future timer on start()', () => {
    store.addTimer({ id: 'persisted-1', name: 'Boss Z', endsAt: Date.now() + 3000 })
    const expired: TimerRecord[] = []
    const manager = new TimerManager(store, (t) => expired.push(t))
    manager.start()

    vi.advanceTimersByTime(3000)

    expect(expired.map((t) => t.id)).toEqual(['persisted-1'])
  })
})
