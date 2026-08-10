import { randomUUID } from 'crypto'
import { ipcMain, shell, dialog, BrowserWindow } from 'electron'
import { AppStore } from './store'
import { LogWatcher } from './logWatcher'
import { TimerManager } from './timers'
import { notify } from './notifications'
import { downloadUpdate } from './autoUpdate'
import { getApiClient, ApiError } from './apiClient'
import { isValidJobName, clampLevel } from './jobs'

export function registerIpcHandlers(
  store: AppStore,
  watcher: LogWatcher,
  timerManager: TimerManager,
  getWindow: () => BrowserWindow | null
): void {
  ipcMain.handle('get-config', () => store.getConfig())

  ipcMain.handle('update-download', () => downloadUpdate())

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

  const apiClient = getApiClient()

  ipcMain.handle(
    'auth-register',
    async (
      _event,
      payload: { username: string; email: string; password: string; jobs: Record<string, number> }
    ) => {
      for (const jobName of Object.keys(payload.jobs)) {
        if (!isValidJobName(jobName)) return { error: `Métier inconnu : ${jobName}` }
      }
      const clampedJobs = Object.fromEntries(
        Object.entries(payload.jobs).map(([name, level]) => [name, clampLevel(level)])
      )
      try {
        const result = await apiClient.register({ ...payload, jobs: clampedJobs })
        store.setSession(result.token, { username: result.user.username, friendCode: result.user.friendCode })
        return { user: { username: result.user.username, friendCode: result.user.friendCode } }
      } catch (err) {
        return { error: err instanceof ApiError ? err.message : 'Erreur réseau' }
      }
    }
  )

  ipcMain.handle('auth-login', async (_event, payload: { usernameOrEmail: string; password: string }) => {
    try {
      const result = await apiClient.login(payload)
      store.setSession(result.token, { username: result.user.username, friendCode: result.user.friendCode })
      return { user: { username: result.user.username, friendCode: result.user.friendCode } }
    } catch (err) {
      return { error: err instanceof ApiError ? err.message : 'Erreur réseau' }
    }
  })

  ipcMain.handle('auth-logout', () => {
    store.setSession(null, null)
  })

  ipcMain.handle('auth-get-session', () => {
    const { user } = store.getSession()
    return user
  })

  ipcMain.handle('job-get-mine', async () => {
    const { token } = store.getSession()
    if (!token) return []
    return apiClient.getMyJobs(token)
  })

  ipcMain.handle('job-update-manual', async (_event, jobName: string, level: number) => {
    const { token } = store.getSession()
    if (!token || !isValidJobName(jobName)) return null
    return apiClient.updateMyJob(token, jobName, clampLevel(level))
  })

  ipcMain.handle('friends-send-request', async (_event, friendCode: string) => {
    const { token } = store.getSession()
    if (!token) return
    await apiClient.sendFriendRequest(token, friendCode)
  })

  ipcMain.handle('friends-pending-requests', async () => {
    const { token } = store.getSession()
    if (!token) return []
    return apiClient.getPendingRequests(token)
  })

  ipcMain.handle('friends-accept-request', async (_event, id: string) => {
    const { token } = store.getSession()
    if (!token) return
    await apiClient.acceptFriendRequest(token, id)
  })

  ipcMain.handle('friends-reject-request', async (_event, id: string) => {
    const { token } = store.getSession()
    if (!token) return
    await apiClient.rejectFriendRequest(token, id)
  })

  ipcMain.handle('friends-list', async () => {
    const { token } = store.getSession()
    if (!token) return []
    return apiClient.getFriends(token)
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

    if (event.type === 'job-level-up') {
      const { token } = store.getSession()
      if (token) {
        void apiClient.getMyJobs(token).then((jobs) => {
          const current = jobs.find((j) => j.jobName === event.jobName)?.level ?? 0
          const newLevel = clampLevel(current + event.levelsGained)
          return apiClient.updateMyJob(token, event.jobName, newLevel)
        })
      }
    }
  })
}
