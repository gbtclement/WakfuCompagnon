import { ipcMain, dialog, BrowserWindow } from 'electron'
import { AppStore } from './store'
import { LogWatcher } from './logWatcher'
import { TimerManager } from './timers'
import { notify } from './notifications'
import environmentalQuests from './data/environmentalQuests.json'

function questName(id: number): string {
  return (environmentalQuests as Record<string, string>)[String(id)] ?? `Quête #${id}`
}

export function registerIpcHandlers(
  store: AppStore,
  watcher: LogWatcher,
  timerManager: TimerManager,
  getWindow: () => BrowserWindow | null
): void {
  ipcMain.handle('get-config', () => store.getConfig())

  ipcMain.handle('set-log-path', (_event, path: string) => {
    store.setLogPath(path)
    return store.getConfig()
  })

  ipcMain.handle('follow-quest', (_event, id: number) => {
    store.addFollowedQuest(id)
    return store.getConfig()
  })

  ipcMain.handle('unfollow-quest', (_event, id: number) => {
    store.removeFollowedQuest(id)
    return store.getConfig()
  })

  ipcMain.handle('create-timer', (_event, name: string, durationMs: number) => {
    return timerManager.createTimer(name, durationMs)
  })

  ipcMain.handle('cancel-timer', (_event, id: string) => {
    timerManager.cancelTimer(id)
    return store.getConfig()
  })

  ipcMain.handle('browse-log-file', async () => {
    const result = await dialog.showOpenDialog({
      properties: ['openFile'],
      filters: [{ name: 'Log files', extensions: ['log'] }]
    })
    if (result.canceled || result.filePaths.length === 0) return null
    const path = result.filePaths[0]
    store.setLogPath(path)
    return path
  })

  watcher.on('wakfu-event', (event) => {
    store.appendHistoryEvent(event)
    getWindow()?.webContents.send('wakfu-event-pushed', event)

    if (event.type === 'environmental-quest' && event.challengeId !== -1) {
      const followed = store.getConfig().followedQuestIds
      if (followed.includes(event.challengeId)) {
        notify('Quête environnementale rencontrée', questName(event.challengeId))
      }
    }

    if (event.type === 'server-connection') {
      notify('Connecté au serveur', event.server)
    }
  })
}
