import { describe, it, expect } from 'vitest'
import { JOB_NAMES, isValidJobName, clampLevel } from '../../src/main/jobs'

describe('jobs', () => {
  it('lists all known Wakfu professions', () => {
    expect(JOB_NAMES).toContain('Trappeur')
    expect(JOB_NAMES.length).toBe(13)
  })

  it('accepts a known job name', () => {
    expect(isValidJobName('Trappeur')).toBe(true)
  })

  it('rejects an unknown job name', () => {
    expect(isValidJobName('NotAJob')).toBe(false)
  })

  it('clamps levels within 0 and 155', () => {
    expect(clampLevel(-5)).toBe(0)
    expect(clampLevel(200)).toBe(155)
    expect(clampLevel(80)).toBe(80)
  })
})
