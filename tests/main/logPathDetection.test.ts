import { describe, it, expect } from 'vitest'
import { detectDefaultLogPath, ZAAP_LOG_PATH, STEAM_LOG_PATH } from '../../src/main/logPathDetection'

describe('detectDefaultLogPath', () => {
  it('returns the Zaap path when it exists', () => {
    const exists = (p: string) => p === ZAAP_LOG_PATH
    expect(detectDefaultLogPath(exists)).toBe(ZAAP_LOG_PATH)
  })

  it('falls back to the Steam path when Zaap path is missing', () => {
    const exists = (p: string) => p === STEAM_LOG_PATH
    expect(detectDefaultLogPath(exists)).toBe(STEAM_LOG_PATH)
  })

  it('returns null when neither path exists', () => {
    expect(detectDefaultLogPath(() => false)).toBeNull()
  })
})
