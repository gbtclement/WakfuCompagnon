import { EventEmitter } from 'events'
import { openSync, closeSync, readSync, statSync, existsSync } from 'fs'
import { LineParser, WakfuEvent } from './parsers/types'
import { parseServerConnection } from './parsers/serverConnection'
import { parseEnvironmentalQuest } from './parsers/environmentalQuest'
import { parseQuestCompleted } from './parsers/questCompleted'
import { parseAchievement } from './parsers/achievement'

const PARSERS: LineParser[] = [
  parseServerConnection,
  parseEnvironmentalQuest,
  parseQuestCompleted,
  parseAchievement
]

interface LogWatcherOptions {
  pollIntervalMs?: number
}

export class LogWatcher extends EventEmitter {
  private offset = 0
  private timer: NodeJS.Timeout | null = null
  private readonly pollIntervalMs: number

  constructor(private readonly logPath: string, options: LogWatcherOptions = {}) {
    super()
    this.pollIntervalMs = options.pollIntervalMs ?? 1000
  }

  start(): void {
    if (existsSync(this.logPath)) {
      this.offset = statSync(this.logPath).size
    }
    this.timer = setInterval(() => this.poll(), this.pollIntervalMs)
  }

  stop(): void {
    if (this.timer) clearInterval(this.timer)
    this.timer = null
  }

  private poll(): void {
    if (!existsSync(this.logPath)) return

    const size = statSync(this.logPath).size
    if (size < this.offset) {
      this.offset = 0
    }
    if (size === this.offset) return

    const fd = openSync(this.logPath, 'r')
    try {
      const length = size - this.offset
      const buffer = Buffer.alloc(length)
      readSync(fd, buffer, 0, length, this.offset)
      this.offset = size

      const text = buffer.toString('utf-8')
      const lines = text.split('\n').filter((l) => l.trim().length > 0)
      for (const line of lines) {
        const event = this.parseLine(line)
        if (event) this.emit('wakfu-event', event)
      }
    } finally {
      closeSync(fd)
    }
  }

  private parseLine(line: string): WakfuEvent | null {
    for (const parser of PARSERS) {
      const event = parser(line)
      if (event) return event
    }
    return null
  }
}
