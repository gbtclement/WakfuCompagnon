import { app, BrowserWindow } from 'electron'
import { join } from 'path'
import { AppStore } from './store'
import { LogWatcher } from './logWatcher'
import { TimerManager } from './timers'
import { notify } from './notifications'
import { registerIpcHandlers } from './ipc'
import { detectDefaultLogPath, ZAAP_LOG_PATH } from './logPathDetection'
import { existsSync } from 'fs'

let mainWindow: BrowserWindow | null = null

function createWindow(): void {
  mainWindow = new BrowserWindow({
    width: 1280,
    height: 800,
    minWidth: 960,
    minHeight: 600,
    webPreferences: {
      preload: join(__dirname, '../preload/preload.js'),
      contextIsolation: true,
      nodeIntegration: false
    }
  })

  if (process.env.VITE_DEV_SERVER_URL) {
    mainWindow.loadURL(process.env.VITE_DEV_SERVER_URL)
  } else {
    mainWindow.loadFile(join(__dirname, '../renderer/index.html'))
  }

  mainWindow.on('closed', () => {
    mainWindow = null
  })
}

app.whenReady().then(() => {
  createWindow()

  const store = new AppStore()

  const hasOldNumericQuestIds = store.getConfig().environmentalQuests.some(
    (q) => typeof (q as { id: unknown }).id === 'number'
  )
  if (hasOldNumericQuestIds) {
    const config = store.getConfig()
    for (const quest of config.environmentalQuests) {
      store.removeEnvironmentalQuest(quest.id)
    }
    for (const followedId of config.followedQuestIds) {
      store.removeFollowedQuest(followedId)
    }
  }

  const configuredPath = store.getConfig().logPath ?? detectDefaultLogPath((p) => existsSync(p))
  if (configuredPath && !store.getConfig().logPath) {
    store.setLogPath(configuredPath)
  }

  const watcher = new LogWatcher(configuredPath ?? ZAAP_LOG_PATH)
  if (configuredPath) watcher.start()

  const timerManager = new TimerManager(store, (timer) => {
    notify('Timer expiré', timer.name)
    mainWindow?.webContents.send('timer-expired', timer)
  })
  timerManager.start()

  registerIpcHandlers(store, watcher, timerManager, () => mainWindow)
})

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit()
})
