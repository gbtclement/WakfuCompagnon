import { randomUUID } from 'crypto'
import { ipcMain, dialog, BrowserWindow } from 'electron'
import { AppStore } from './store'
import { LogWatcher } from './logWatcher'
import { TimerManager } from './timers'
import { notify } from './notifications'

function questName(store: AppStore, id: number): string {
  const quest = store.getConfig().environmentalQuests.find((q) => q.id === id)
  return quest?.name ?? `Quête #${id}`
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

  ipcMain.handle('add-environmental-quest', (_event, id: number, name: string) => {
    store.addEnvironmentalQuest({ id, name })
    return store.getConfig()
  })

  ipcMain.handle('update-environmental-quest', (_event, id: number, name: string) => {
    store.updateEnvironmentalQuest(id, name)
    return store.getConfig()
  })

  ipcMain.handle('remove-environmental-quest', (_event, id: number) => {
    store.removeEnvironmentalQuest(id)
    return store.getConfig()
  })

  ipcMain.handle('add-archimonster', (_event, name: string, respawnMinutes: number) => {
    store.addArchimonster({ id: randomUUID(), name, respawnMinutes })
    return store.getConfig()
  })

  ipcMain.handle('update-archimonster', (_event, id: string, name: string, respawnMinutes: number) => {
    store.updateArchimonster(id, name, respawnMinutes)
    return store.getConfig()
  })

  ipcMain.handle('remove-archimonster', (_event, id: string) => {
    store.removeArchimonster(id)
    return store.getConfig()
  })

  ipcMain.handle('add-exploit', (_event, name: string, questIds: number[], archimonsterIds: string[]) => {
    store.addExploit({ id: randomUUID(), name, questIds, archimonsterIds })
    return store.getConfig()
  })

  ipcMain.handle('update-exploit', (_event, id: string, name: string, questIds: number[], archimonsterIds: string[]) => {
    store.updateExploit(id, name, questIds, archimonsterIds)
    return store.getConfig()
  })

  ipcMain.handle('remove-exploit', (_event, id: string) => {
    store.removeExploit(id)
    return store.getConfig()
  })

  watcher.on('wakfu-event', (event) => {
    store.appendHistoryEvent(event)
    getWindow()?.webContents.send('wakfu-event-pushed', event)

    if (event.type === 'environmental-quest' && event.challengeId !== -1) {
      const followed = store.getConfig().followedQuestIds
      if (followed.includes(event.challengeId)) {
        notify('Quête environnementale rencontrée', questName(store, event.challengeId))
      }
    }

    if (event.type === 'server-connection') {
      notify('Connecté au serveur', event.server)
    }
  })
}
