import { describe, it, expect } from 'vitest'
import { parseLatestRelease } from '../../src/main/updateCheck'

describe('parseLatestRelease', () => {
  it('returns null when the latest release is not newer than the current version', () => {
    const release = { tag_name: 'v1.0.0', html_url: 'https://github.com/gbtclement/WakfuCompagnon/releases/tag/v1.0.0' }
    expect(parseLatestRelease(release, '1.0.0')).toBeNull()
  })

  it('returns null when the latest release is older than the current version', () => {
    const release = { tag_name: 'v0.9.0', html_url: 'https://github.com/gbtclement/WakfuCompagnon/releases/tag/v0.9.0' }
    expect(parseLatestRelease(release, '1.0.0')).toBeNull()
  })

  it('returns update info when a newer release exists', () => {
    const release = { tag_name: 'v1.1.0', html_url: 'https://github.com/gbtclement/WakfuCompagnon/releases/tag/v1.1.0' }
    expect(parseLatestRelease(release, '1.0.0')).toEqual({
      version: '1.1.0',
      releaseUrl: 'https://github.com/gbtclement/WakfuCompagnon/releases/tag/v1.1.0'
    })
  })

  it('handles tag names without a leading v', () => {
    const release = { tag_name: '2.0.0', html_url: 'https://github.com/gbtclement/WakfuCompagnon/releases/tag/2.0.0' }
    expect(parseLatestRelease(release, '1.0.0')).toEqual({
      version: '2.0.0',
      releaseUrl: 'https://github.com/gbtclement/WakfuCompagnon/releases/tag/2.0.0'
    })
  })
})
