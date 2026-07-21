import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { writeFileSync, appendFileSync, mkdtempSync, rmSync } from 'fs'
import { join } from 'path'
import { tmpdir } from 'os'
import { LogWatcher } from '../../src/main/logWatcher'
import { WakfuEvent } from '../../src/main/parsers/types'
import { ACHIEVEMENT_LINES, SERVER_CONNECTION_LINES } from '../parsers/fixtures'

describe('LogWatcher', () => {
  let dir: string
  let logPath: string
  let watcher: LogWatcher

  beforeEach(() => {
    dir = mkdtempSync(join(tmpdir(), 'wakfu-log-test-'))
    logPath = join(dir, 'wakfu.log')
    writeFileSync(logPath, '')
  })

  afterEach(() => {
    watcher?.stop()
    rmSync(dir, { recursive: true, force: true })
  })

  it('emits a parsed event for each new appended line', async () => {
    watcher = new LogWatcher(logPath, { pollIntervalMs: 50 })
    const received: WakfuEvent[] = []
    watcher.on('wakfu-event', (e) => received.push(e))
    watcher.start()

    appendFileSync(logPath, ACHIEVEMENT_LINES.activated + '\n')

    await new Promise((resolve) => setTimeout(resolve, 200))

    expect(received).toEqual([{ type: 'achievement', achievementId: 4267, timestamp: '16:29:51,226' }])
  })

  it('resumes from the new content after file truncation (rotation)', async () => {
    appendFileSync(logPath, SERVER_CONNECTION_LINES.dispatcher + '\n')
    watcher = new LogWatcher(logPath, { pollIntervalMs: 50 })
    const received: WakfuEvent[] = []
    watcher.on('wakfu-event', (e) => received.push(e))
    watcher.start()

    await new Promise((resolve) => setTimeout(resolve, 150))

    writeFileSync(logPath, ACHIEVEMENT_LINES.activated + '\n')

    await new Promise((resolve) => setTimeout(resolve, 200))

    expect(received).toEqual([{ type: 'achievement', achievementId: 4267, timestamp: '16:29:51,226' }])
  })
})
