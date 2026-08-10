import { safeStorage } from 'electron'

// safeStorage is undefined when this module is loaded outside a running Electron
// process (e.g. under vitest, which runs on plain Node) — fall back to base64 in
// that case. The packaged app always runs inside Electron, where safeStorage is
// present and isEncryptionAvailable() reflects real OS-backed encryption support.
function encryptionAvailable(): boolean {
  return typeof safeStorage !== 'undefined' && safeStorage.isEncryptionAvailable()
}

export function encryptToken(token: string): string {
  if (encryptionAvailable()) {
    return safeStorage.encryptString(token).toString('base64')
  }
  return Buffer.from(token, 'utf-8').toString('base64')
}

export function decryptToken(encrypted: string): string {
  const buffer = Buffer.from(encrypted, 'base64')
  if (encryptionAvailable()) {
    return safeStorage.decryptString(buffer)
  }
  return buffer.toString('utf-8')
}
