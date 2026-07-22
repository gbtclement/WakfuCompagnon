export type WakfuEvent =
  | { type: 'server-connection'; server: string; timestamp: string }
  | { type: 'quest-completed'; questName: string; timestamp: string }
  | { type: 'quest-failed'; questName: string; timestamp: string }
  | { type: 'achievement'; achievementId: number; timestamp: string }

export type LineParser = (line: string) => WakfuEvent | null
