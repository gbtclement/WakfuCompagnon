export const JOB_NAMES = [
  'Bûcheron',
  'Mineur',
  'Trappeur',
  'Pêcheur',
  'Paysan',
  'Alchimiste',
  'Forgeron',
  'Bijoutier',
  'Sculpteur',
  'Tailleur',
  'Cordonnier',
  'Façonneur',
  'Boulanger',
] as const;

export function isValidJobName(name: string): boolean {
  return (JOB_NAMES as readonly string[]).includes(name);
}

export function clampLevel(level: number): number {
  return Math.min(155, Math.max(0, level));
}
