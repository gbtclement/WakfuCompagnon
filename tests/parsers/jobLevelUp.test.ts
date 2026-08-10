import { describe, it, expect } from 'vitest'
import { parseJobLevelUp } from '../../src/main/parsers/jobLevelUp'
import { JOB_LEVEL_UP_LINES, UNRELATED_LINES } from './fixtures'

describe('parseJobLevelUp', () => {
  it('extracts job name and levels gained from a single-level-up line', () => {
    const event = parseJobLevelUp(JOB_LEVEL_UP_LINES.trappeurSingleLevel)
    expect(event).toEqual({
      type: 'job-level-up',
      jobName: 'Trappeur',
      levelsGained: 1,
      timestamp: '20:04:47,496'
    })
  })

  it('extracts a multi-level-up gain', () => {
    const event = parseJobLevelUp(JOB_LEVEL_UP_LINES.bucheronMultiLevel)
    expect(event).toEqual({
      type: 'job-level-up',
      jobName: 'Bûcheron',
      levelsGained: 3,
      timestamp: '09:12:03,001'
    })
  })

  it('returns null for an unknown job name', () => {
    expect(parseJobLevelUp(JOB_LEVEL_UP_LINES.unknownJob)).toBeNull()
  })

  it('returns null for unrelated lines', () => {
    for (const line of UNRELATED_LINES) {
      expect(parseJobLevelUp(line)).toBeNull()
    }
  })
})
