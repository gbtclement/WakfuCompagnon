import { describe, it, expect, vi } from 'vitest'
import { EventEmitter } from 'events'
import { createAutoUpdateRegistrar } from '../../src/main/autoUpdate'

function fakeWindow() {
  return { webContents: { send: vi.fn() } }
}

function fakeUpdater() {
  const emitter = new EventEmitter() as EventEmitter & {
    checkForUpdates: () => void
    downloadUpdate: () => void
    quitAndInstall: () => void
  }
  emitter.checkForUpdates = vi.fn()
  emitter.downloadUpdate = vi.fn()
  emitter.quitAndInstall = vi.fn()
  return emitter
}

describe('createAutoUpdateRegistrar', () => {
  it('relays update-available with the version', () => {
    const updater = fakeUpdater()
    const win = fakeWindow()
    const { registerAutoUpdate } = createAutoUpdateRegistrar(updater as never)
    registerAutoUpdate(() => win as never)

    updater.emit('update-available', { version: '1.2.3' })

    expect(win.webContents.send).toHaveBeenCalledWith('update-available-pushed', { version: '1.2.3' })
  })

  it('relays download-progress with the percent', () => {
    const updater = fakeUpdater()
    const win = fakeWindow()
    const { registerAutoUpdate } = createAutoUpdateRegistrar(updater as never)
    registerAutoUpdate(() => win as never)

    updater.emit('download-progress', { percent: 42.7 })

    expect(win.webContents.send).toHaveBeenCalledWith('update-download-progress-pushed', { percent: 42.7 })
  })

  it('relays update-downloaded and then calls quitAndInstall', () => {
    const updater = fakeUpdater()
    const win = fakeWindow()
    const { registerAutoUpdate } = createAutoUpdateRegistrar(updater as never)
    registerAutoUpdate(() => win as never)

    updater.emit('update-downloaded')

    expect(win.webContents.send).toHaveBeenCalledWith('update-downloaded-pushed')
    expect(updater.quitAndInstall).toHaveBeenCalled()
  })

  it('relays error with a message string', () => {
    const updater = fakeUpdater()
    const win = fakeWindow()
    const { registerAutoUpdate } = createAutoUpdateRegistrar(updater as never)
    registerAutoUpdate(() => win as never)

    updater.emit('error', new Error('network down'))

    expect(win.webContents.send).toHaveBeenCalledWith('update-error-pushed', { message: 'network down' })
  })

  it('does nothing when the window is null', () => {
    const updater = fakeUpdater()
    const { registerAutoUpdate } = createAutoUpdateRegistrar(updater as never)
    registerAutoUpdate(() => null)

    expect(() => updater.emit('update-available', { version: '1.2.3' })).not.toThrow()
  })

  it('calls checkForUpdates when registered', () => {
    const updater = fakeUpdater()
    const { registerAutoUpdate } = createAutoUpdateRegistrar(updater as never)
    registerAutoUpdate(() => fakeWindow() as never)

    expect(updater.checkForUpdates).toHaveBeenCalled()
  })

  it('downloadUpdate calls the underlying autoUpdater.downloadUpdate', async () => {
    const updater = fakeUpdater()
    const { downloadUpdate } = createAutoUpdateRegistrar(updater as never)
    await downloadUpdate()

    expect(updater.downloadUpdate).toHaveBeenCalled()
  })
})
