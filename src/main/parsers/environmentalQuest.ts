import { LineParser } from './types'

const PATTERN = /^\s*INFO\s+(\d{2}:\d{2}:\d{2},\d{3}).*Challenge courant\s*:\s*(-?\d+)/

export const parseEnvironmentalQuest: LineParser = (line) => {
  const match = PATTERN.exec(line)
  if (!match) return null

  const [, timestamp, idStr] = match
  return { type: 'environmental-quest', challengeId: Number(idStr), timestamp }
}
