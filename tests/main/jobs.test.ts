import { describe, it, expect } from 'vitest'
import { JOBS, JOB_NAMES, isValidJobName, clampLevel } from '../../src/main/jobs'

describe('jobs', () => {
  it('lists exactly the 14 real Wakfu professions', () => {
    expect(JOB_NAMES).toEqual([
      'Paysan',
      'Pêcheur',
      'Trappeur',
      'Mineur',
      'Herboriste',
      'Forestier',
      'Ébéniste',
      'Tailleur',
      'Bijoutier',
      'Armurier',
      "Maître d'Armes",
      'Maroquinier',
      'Cuisinier',
      'Boulanger'
    ])
    expect(JOB_NAMES.length).toBe(14)
  })

  it('no longer accepts the old incorrect job names', () => {
    expect(isValidJobName('Bûcheron')).toBe(false)
    expect(isValidJobName('Alchimiste')).toBe(false)
    expect(isValidJobName('Forgeron')).toBe(false)
    expect(isValidJobName('Sculpteur')).toBe(false)
    expect(isValidJobName('Cordonnier')).toBe(false)
    expect(isValidJobName('Façonneur')).toBe(false)
  })

  it('accepts a known real job name', () => {
    expect(isValidJobName('Trappeur')).toBe(true)
    expect(isValidJobName("Maître d'Armes")).toBe(true)
  })

  it('rejects an unknown job name', () => {
    expect(isValidJobName('NotAJob')).toBe(false)
  })

  it('clamps levels within 0 and 155', () => {
    expect(clampLevel(-5)).toBe(0)
    expect(clampLevel(200)).toBe(155)
    expect(clampLevel(80)).toBe(80)
  })

  it('categorizes every job as recolte or artisanat', () => {
    const recolte = JOBS.filter((j) => j.category === 'recolte').map((j) => j.name)
    const artisanat = JOBS.filter((j) => j.category === 'artisanat').map((j) => j.name)

    expect(recolte).toEqual(['Paysan', 'Pêcheur', 'Trappeur', 'Mineur', 'Herboriste', 'Forestier'])
    expect(artisanat).toEqual([
      'Ébéniste',
      'Tailleur',
      'Bijoutier',
      'Armurier',
      "Maître d'Armes",
      'Maroquinier',
      'Cuisinier',
      'Boulanger'
    ])
  })
})
