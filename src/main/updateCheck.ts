import { net } from 'electron'

const RELEASES_API_URL = 'https://api.github.com/repos/gbtclement/WakfuCompagnon/releases/latest'

export interface UpdateInfo {
  version: string
  releaseUrl: string
}

interface GitHubRelease {
  tag_name: string
  html_url: string
}

function compareVersions(a: string, b: string): number {
  const partsA = a.split('.').map(Number)
  const partsB = b.split('.').map(Number)
  for (let i = 0; i < 3; i++) {
    if (partsA[i] !== partsB[i]) return (partsA[i] ?? 0) - (partsB[i] ?? 0)
  }
  return 0
}

export function parseLatestRelease(release: GitHubRelease, currentVersion: string): UpdateInfo | null {
  const version = release.tag_name.replace(/^v/, '')
  if (compareVersions(version, currentVersion) <= 0) return null
  return { version, releaseUrl: release.html_url }
}

export async function checkForUpdate(currentVersion: string): Promise<UpdateInfo | null> {
  try {
    const response = await net.fetch(RELEASES_API_URL, {
      headers: { Accept: 'application/vnd.github+json' }
    })
    if (!response.ok) return null
    const release = (await response.json()) as GitHubRelease
    return parseLatestRelease(release, currentVersion)
  } catch {
    return null
  }
}
