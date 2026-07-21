import { LineParser } from './types'

const WON_PATTERN = /^\s*INFO\s+(\d{2}:\d{2}:\d{2},\d{3}).*Vous venez de remporter la quête\s*"([^"]+)"/
const FAILED_PATTERN = /^\s*INFO\s+(\d{2}:\d{2}:\d{2},\d{3}).*Quête échouée\s*:\s*"([^"]+)"/

export const parseQuestCompleted: LineParser = (line) => {
  const won = WON_PATTERN.exec(line)
  if (won) {
    const [, timestamp, questName] = won
    return { type: 'quest-completed', questName, timestamp }
  }

  const failed = FAILED_PATTERN.exec(line)
  if (failed) {
    const [, timestamp, questName] = failed
    return { type: 'quest-failed', questName, timestamp }
  }

  return null
}
