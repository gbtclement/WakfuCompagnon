import { describe, it, expect } from 'vitest'
import { parseEnvironmentalQuest } from '../../src/main/parsers/environmentalQuest'
import { ENVIRONMENTAL_QUEST_LINES, UNRELATED_LINES } from './fixtures'

describe('parseEnvironmentalQuest', () => {
  it('extracts a negative challenge id', () => {
    const event = parseEnvironmentalQuest(ENVIRONMENTAL_QUEST_LINES.active1123)
    expect(event).toEqual({ type: 'environmental-quest', challengeId: -1123, timestamp: '20:05:41,377' })
  })

  it('extracts the "no challenge" id of -1', () => {
    const event = parseEnvironmentalQuest(ENVIRONMENTAL_QUEST_LINES.none)
    expect(event).toEqual({ type: 'environmental-quest', challengeId: -1, timestamp: '20:07:15,962' })
  })

  it('returns null for unrelated lines', () => {
    for (const line of UNRELATED_LINES) {
      expect(parseEnvironmentalQuest(line)).toBeNull()
    }
  })
})
