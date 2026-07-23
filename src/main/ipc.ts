import { randomUUID } from 'crypto'
import { ipcMain, shell, app, dialog, BrowserWindow } from 'electron'
import { AppStore } from './store'
import { LogWatcher } from './logWatcher'
import { TimerManager } from './timers'
import { notify } from './notifications'
import { checkForUpdate } from './updateCheck'

export function registerIpcHandlers(
  store: AppStore,
  watcher: LogWatcher,
  timerManager: TimerManager,
  getWindow: () => BrowserWindow | null
): void {
  ipcMain.handle('get-config', () => store.getConfig())

  ipcMain.handle('check-for-update', () => checkForUpdate(app.getVersion()))

  ipcMain.handle('open-external', (_event, url: string) => {
    let parsed: URL
    try {
      parsed = new URL(url)
    } catch {
      return
    }
    if (parsed.protocol !== 'https:' || parsed.hostname !== 'github.com') return
    return shell.openExternal(parsed.toString())
  })

  ipcMain.handle('set-log-path', (_event, path: string) => {
    store.setLogPath(path)
    return store.getConfig()
  })

  ipcMain.handle('follow-quest', (_event, id: string) => {
    store.addFollowedQuest(id)
    return store.getConfig()
  })

  ipcMain.handle('unfollow-quest', (_event, id: string) => {
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

  ipcMain.handle('add-environmental-quest', (_event, name: string) => {
    store.addEnvironmentalQuest(name)
    return store.getConfig()
  })

  ipcMain.handle('update-environmental-quest', (_event, id: string, name: string) => {
    store.updateEnvironmentalQuest(id, name)
    return store.getConfig()
  })

  ipcMain.handle('remove-environmental-quest', (_event, id: string) => {
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

  ipcMain.handle('add-exploit', (_event, name: string, questIds: string[], archimonsterIds: string[]) => {
    store.addExploit({ id: randomUUID(), name, questIds, archimonsterIds })
    return store.getConfig()
  })

  ipcMain.handle('update-exploit', (_event, id: string, name: string, questIds: string[], archimonsterIds: string[]) => {
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

    if (event.type === 'quest-completed' || event.type === 'quest-failed') {
      const followedIds = store.getConfig().followedQuestIds
      const quest = store.getConfig().environmentalQuests.find(
        (q) => q.name === event.questName && followedIds.includes(q.id)
      )
      if (quest) {
        notify('Quête environnementale rencontrée', quest.name)
      }
    }

    if (event.type === 'server-connection') {
      notify('Connecté au serveur', event.server)
    }
  })
}
