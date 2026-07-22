import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { mkdtempSync, rmSync } from 'fs'
import { join } from 'path'
import { tmpdir } from 'os'
import { AppStore } from '../../src/main/store'

describe('AppStore', () => {
  let cwd: string
  let store: AppStore

  beforeEach(() => {
    cwd = mkdtempSync(join(tmpdir(), 'wakfu-store-test-'))
    store = new AppStore(cwd)
  })

  afterEach(() => {
    rmSync(cwd, { recursive: true, force: true })
  })

  it('starts with an empty default config', () => {
    expect(store.getConfig()).toEqual({
      logPath: null,
      followedQuestIds: [],
      timers: [],
      history: []
    })
  })

  it('persists a log path', () => {
    store.setLogPath('C:\\fake\\wakfu.log')
    expect(store.getConfig().logPath).toBe('C:\\fake\\wakfu.log')
  })

  it('adds and removes a followed quest id without duplicates', () => {
    store.addFollowedQuest(-1123)
    store.addFollowedQuest(-1123)
    expect(store.getConfig().followedQuestIds).toEqual([-1123])
    store.removeFollowedQuest(-1123)
    expect(store.getConfig().followedQuestIds).toEqual([])
  })

  it('adds and removes a timer', () => {
    store.addTimer({ id: 't1', name: 'Boss X', endsAt: 123456, durationMs: 60000 })
    expect(store.getConfig().timers).toEqual([{ id: 't1', name: 'Boss X', endsAt: 123456, durationMs: 60000 }])
    store.removeTimer('t1')
    expect(store.getConfig().timers).toEqual([])
  })

  it('appends events to history', () => {
    const event = { type: 'achievement' as const, achievementId: 1, timestamp: '00:00:00,000' }
    store.appendHistoryEvent(event)
    expect(store.getConfig().history).toEqual([event])
  })
})
