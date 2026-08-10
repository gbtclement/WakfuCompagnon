import { describe, it, expect } from 'vitest'
import { encryptToken, decryptToken } from '../../src/main/session'

describe('session token encryption', () => {
  it('round-trips a token through encrypt/decrypt', () => {
    const token = 'a.fake.jwt.token'
    const encrypted = encryptToken(token)
    expect(encrypted).not.toBe(token)
    expect(decryptToken(encrypted)).toBe(token)
  })
})
