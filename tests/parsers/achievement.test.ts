import { describe, it, expect } from 'vitest'
import { parseAchievement } from '../../src/main/parsers/achievement'
import { ACHIEVEMENT_LINES, UNRELATED_LINES } from './fixtures'

describe('parseAchievement', () => {
  it('extracts the id from "Achievement activated"', () => {
    const event = parseAchievement(ACHIEVEMENT_LINES.activated)
    expect(event).toEqual({ type: 'achievement', achievementId: 4267, timestamp: '16:29:51,226' })
  })

  it('extracts the id from "Achievement objective completed"', () => {
    const event = parseAchievement(ACHIEVEMENT_LINES.objectiveCompleted)
    expect(event).toEqual({ type: 'achievement', achievementId: 9388, timestamp: '21:03:16,003' })
  })

  it('returns null for unrelated lines', () => {
    for (const line of UNRELATED_LINES) {
      expect(parseAchievement(line)).toBeNull()
    }
  })
})
