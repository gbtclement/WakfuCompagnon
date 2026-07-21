import { describe, it, expect } from 'vitest'
import { parseServerConnection } from '../../src/main/parsers/serverConnection'
import { SERVER_CONNECTION_LINES, UNRELATED_LINES } from './fixtures'

describe('parseServerConnection', () => {
  it('extracts the server name from a proxy connection line', () => {
    const event = parseServerConnection(SERVER_CONNECTION_LINES.ogrest)
    expect(event).toEqual({ type: 'server-connection', server: 'ogrest', timestamp: '18:26:49,060' })
  })

  it('ignores the dispatcher lobby proxy', () => {
    expect(parseServerConnection(SERVER_CONNECTION_LINES.dispatcher)).toBeNull()
  })

  it('returns null for unrelated lines', () => {
    for (const line of UNRELATED_LINES) {
      expect(parseServerConnection(line)).toBeNull()
    }
  })
})
