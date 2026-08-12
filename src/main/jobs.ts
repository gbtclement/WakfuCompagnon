export type JobCategory = 'recolte' | 'artisanat'

export interface JobDefinition {
  name: string
  category: JobCategory
}

export const JOBS: readonly JobDefinition[] = [
  { name: 'Paysan', category: 'recolte' },
  { name: 'Pêcheur', category: 'recolte' },
  { name: 'Trappeur', category: 'recolte' },
  { name: 'Mineur', category: 'recolte' },
  { name: 'Herboriste', category: 'recolte' },
  { name: 'Forestier', category: 'recolte' },
  { name: 'Ébéniste', category: 'artisanat' },
  { name: 'Tailleur', category: 'artisanat' },
  { name: 'Bijoutier', category: 'artisanat' },
  { name: 'Armurier', category: 'artisanat' },
  { name: "Maître d'Armes", category: 'artisanat' },
  { name: 'Maroquinier', category: 'artisanat' },
  { name: 'Cuisinier', category: 'artisanat' },
  { name: 'Boulanger', category: 'artisanat' }
] as const

export const JOB_NAMES: readonly string[] = JOBS.map((j) => j.name)

export function isValidJobName(name: string): boolean {
  return (JOB_NAMES as readonly string[]).includes(name)
}

export function clampLevel(level: number): number {
  return Math.min(155, Math.max(0, level))
}
