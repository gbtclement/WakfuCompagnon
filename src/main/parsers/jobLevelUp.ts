import { LineParser } from './types'
import { isValidJobName } from '../jobs'

const PATTERN =
  /^\s*INFO\s+(\d{2}:\d{2}:\d{2},\d{3}).*\[Information \(jeu\)\] ([^:]+?)\s*:\s*\+[\d\s]+points d'XP\.\s+\+(\d+)\s+niveaux?\./

export const parseJobLevelUp: LineParser = (line) => {
  const match = PATTERN.exec(line)
  if (!match) return null

  const [, timestamp, jobName, levelsGainedStr] = match
  if (!isValidJobName(jobName)) return null

  return { type: 'job-level-up', jobName, levelsGained: Number(levelsGainedStr), timestamp }
}
