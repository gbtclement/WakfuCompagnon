import type { BrowserWindow } from 'electron'

interface UpdaterLike {
  on(event: 'update-available', listener: (info: { version: string }) => void): unknown
  on(event: 'download-progress', listener: (info: { percent: number }) => void): unknown
  on(event: 'update-downloaded', listener: () => void): unknown
  on(event: 'error', listener: (err: Error) => void): unknown
  checkForUpdates(): unknown
  downloadUpdate(): unknown
  quitAndInstall(): unknown
}

export function createAutoUpdateRegistrar(updater: UpdaterLike) {
  function registerAutoUpdate(getWindow: () => BrowserWindow | null): void {
    updater.on('update-available', (info) => {
      getWindow()?.webContents.send('update-available-pushed', { version: info.version })
    })

    updater.on('download-progress', (info) => {
      getWindow()?.webContents.send('update-download-progress-pushed', { percent: info.percent })
    })

    updater.on('update-downloaded', () => {
      getWindow()?.webContents.send('update-downloaded-pushed')
      updater.quitAndInstall()
    })

    updater.on('error', (err) => {
      getWindow()?.webContents.send('update-error-pushed', { message: err.message })
    })

    updater.checkForUpdates()
  }

  async function downloadUpdate(): Promise<void> {
    await updater.downloadUpdate()
  }

  return { registerAutoUpdate, downloadUpdate }
}

let defaultRegistrar: ReturnType<typeof createAutoUpdateRegistrar> | null = null

function getDefaultRegistrar(): ReturnType<typeof createAutoUpdateRegistrar> {
  if (!defaultRegistrar) {
    // Deferred require: electron-updater touches Electron's `app` at import
    // time (to read app.getVersion()), which throws outside a running
    // Electron process (e.g. under vitest, plain Node). Only load it when
    // actually registering/downloading, inside the real app.
    const { autoUpdater } = require('electron-updater') as typeof import('electron-updater')
    defaultRegistrar = createAutoUpdateRegistrar(autoUpdater as unknown as UpdaterLike)
  }
  return defaultRegistrar
}

export function registerAutoUpdate(getWindow: () => BrowserWindow | null): void {
  getDefaultRegistrar().registerAutoUpdate(getWindow)
}

export function downloadUpdate(): Promise<void> {
  return getDefaultRegistrar().downloadUpdate()
}
