import { describe, it, expect } from 'vitest'
import { parseQuestCompleted } from '../../src/main/parsers/questCompleted'
import { QUEST_COMPLETED_LINES, UNRELATED_LINES } from './fixtures'

describe('parseQuestCompleted', () => {
  it('extracts the quest name on a win', () => {
    const event = parseQuestCompleted(QUEST_COMPLETED_LINES.won)
    expect(event).toEqual({
      type: 'quest-completed',
      questName: 'Course : Salbatroce Voyageur',
      timestamp: '18:22:57,585'
    })
  })

  it('extracts the quest name on a failure', () => {
    const event = parseQuestCompleted(QUEST_COMPLETED_LINES.failed)
    expect(event).toEqual({
      type: 'quest-failed',
      questName: 'Collaboratif : Hordes de Vandaliénés',
      timestamp: '20:05:36,472'
    })
  })

  it('returns null for unrelated lines', () => {
    for (const line of UNRELATED_LINES) {
      expect(parseQuestCompleted(line)).toBeNull()
    }
  })
})
