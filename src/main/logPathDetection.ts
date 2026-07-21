import { join } from 'path'

export const ZAAP_LOG_PATH = join(
  process.env.APPDATA ?? '',
  'zaap', 'gamesLogs', 'wakfu', 'logs', 'wakfu.log'
)

export const STEAM_LOG_PATH =
  'C:\\Program Files (x86)\\Steam\\steamapps\\common\\Wakfu\\logs\\wakfu.log'

export function detectDefaultLogPath(fileExists: (path: string) => boolean): string | null {
  if (fileExists(ZAAP_LOG_PATH)) return ZAAP_LOG_PATH
  if (fileExists(STEAM_LOG_PATH)) return STEAM_LOG_PATH
  return null
}
