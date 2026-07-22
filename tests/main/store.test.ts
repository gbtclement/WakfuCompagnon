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
      history: [],
      environmentalQuests: [],
      archimonsters: [],
      exploits: []
    })
  })

  it('persists a log path', () => {
    store.setLogPath('C:\\fake\\wakfu.log')
    expect(store.getConfig().logPath).toBe('C:\\fake\\wakfu.log')
  })

  it('adds and removes a followed quest id without duplicates', () => {
    store.addFollowedQuest('q1')
    store.addFollowedQuest('q1')
    expect(store.getConfig().followedQuestIds).toEqual(['q1'])
    store.removeFollowedQuest('q1')
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

  it('adds, updates, and removes an environmental quest with a generated id', () => {
    const created = store.addEnvironmentalQuest('Solo : Crocodailles de la Banquise')
    expect(created.name).toBe('Solo : Crocodailles de la Banquise')
    expect(typeof created.id).toBe('string')
    expect(store.getConfig().environmentalQuests).toEqual([created])

    store.updateEnvironmentalQuest(created.id, 'Nom corrigé')
    expect(store.getConfig().environmentalQuests).toEqual([{ id: created.id, name: 'Nom corrigé' }])

    store.removeEnvironmentalQuest(created.id)
    expect(store.getConfig().environmentalQuests).toEqual([])
  })

  it('adds, updates, and removes an archimonster', () => {
    store.addArchimonster({ id: 'a1', name: 'Comte Harebourg', respawnMinutes: 30 })
    expect(store.getConfig().archimonsters).toEqual([{ id: 'a1', name: 'Comte Harebourg', respawnMinutes: 30 }])

    store.updateArchimonster('a1', 'Comte Harebourg', 45)
    expect(store.getConfig().archimonsters).toEqual([{ id: 'a1', name: 'Comte Harebourg', respawnMinutes: 45 }])

    store.removeArchimonster('a1')
    expect(store.getConfig().archimonsters).toEqual([])
  })

  it('adds, updates, and removes an exploit', () => {
    store.addExploit({ id: 'e1', name: 'Maître des Silènes', questIds: ['q1'], archimonsterIds: ['a1'] })
    expect(store.getConfig().exploits).toEqual([{ id: 'e1', name: 'Maître des Silènes', questIds: ['q1'], archimonsterIds: ['a1'] }])

    store.updateExploit('e1', 'Maître des Silènes', ['q1', 'q2'], ['a1'])
    expect(store.getConfig().exploits).toEqual([{ id: 'e1', name: 'Maître des Silènes', questIds: ['q1', 'q2'], archimonsterIds: ['a1'] }])

    store.removeExploit('e1')
    expect(store.getConfig().exploits).toEqual([])
  })

  it('removing an environmental quest strips it from exploits that reference it', () => {
    store.addExploit({ id: 'e1', name: 'Maître des Silènes', questIds: ['q1', 'q2'], archimonsterIds: [] })
    store.removeEnvironmentalQuest('q1')
    expect(store.getConfig().exploits).toEqual([{ id: 'e1', name: 'Maître des Silènes', questIds: ['q2'], archimonsterIds: [] }])
  })

  it('removing an archimonster strips it from exploits that reference it', () => {
    store.addExploit({ id: 'e1', name: 'Maître des Silènes', questIds: [], archimonsterIds: ['a1', 'a2'] })
    store.removeArchimonster('a1')
    expect(store.getConfig().exploits).toEqual([{ id: 'e1', name: 'Maître des Silènes', questIds: [], archimonsterIds: ['a2'] }])
  })
})
