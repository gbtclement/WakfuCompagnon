import { LineParser } from './types'

const PATTERN = /^\s*INFO\s+(\d{2}:\d{2}:\d{2},\d{3}).*Connexion au proxy\s*:wakfu-([a-z0-9-]+)\.ankama-games\.com/

export const parseServerConnection: LineParser = (line) => {
  const match = PATTERN.exec(line)
  if (!match) return null

  const [, timestamp, server] = match
  if (server === 'dispatcher') return null

  return { type: 'server-connection', server, timestamp }
}
