import { app, shell, BrowserWindow, nativeImage, Menu } from 'electron'
import { join } from 'path'
import { electronApp, optimizer, is } from '@electron-toolkit/utils'
import { registerIpcHandlers, setupDownloadEvents } from './ipc-handlers'
import { killAllDownloads } from './ytdlp/downloader'
import { configureAppUpdates } from './app-updater'

type AppShortcutCommand =
  | 'open-settings'
  | 'new-tab'
  | 'reopen-closed-tab'
  | 'close-tab'
  | 'reload-tab'
  | 'focus-url'
  | `switch-tab:${number}`

function getAppShortcutCommand(input: Electron.Input): AppShortcutCommand | null {
  if (input.type !== 'keyDown') return null
  if (!input.meta && !input.control) return null

  const key = input.key.toLowerCase()
  if (key === ',') return 'open-settings'
  if (key === 't' && input.shift) return 'reopen-closed-tab'
  if (key === 't') return 'new-tab'
  if (key === 'w') return 'close-tab'
  if (key === 'r') return 'reload-tab'
  if (key === 'l') return 'focus-url'
  if (/^[1-9]$/.test(key)) return `switch-tab:${Number(key)}`
  return null
}

function createWindow(): BrowserWindow {
  const mainWindow = new BrowserWindow({
    width: 1100,
    height: 750,
    minWidth: 900,
    minHeight: 600,
    show: false,
    backgroundColor: '#020617',
    icon: nativeImage.createFromPath(join(__dirname, '../../build/icon.png')),
    ...(process.platform === 'darwin'
      ? { titleBarStyle: 'hiddenInset' as const }
      : { frame: false }),
    webPreferences: {
      preload: join(__dirname, '../preload/index.js')
    }
  })

  mainWindow.on('ready-to-show', () => {
    mainWindow.show()
  })

  mainWindow.webContents.on('before-input-event', (event, input) => {
    const command = getAppShortcutCommand(input)
    if (!command) return

    event.preventDefault()
    mainWindow.webContents.send('app-shortcut', command)
  })

  // Enable right-click context menu for text inputs
  mainWindow.webContents.on('context-menu', (_event, params) => {
    if (params.isEditable) {
      Menu.buildFromTemplate([
        { role: 'cut' },
        { role: 'copy' },
        { role: 'paste' },
        { role: 'selectAll' }
      ]).popup({ window: mainWindow })
    }
  })

  mainWindow.webContents.setWindowOpenHandler((details) => {
    shell.openExternal(details.url)
    return { action: 'deny' }
  })

  if (is.dev && process.env['ELECTRON_RENDERER_URL']) {
    mainWindow.loadURL(process.env['ELECTRON_RENDERER_URL'])
  } else {
    mainWindow.loadFile(join(__dirname, '../renderer/index.html'))
  }

  return mainWindow
}

app.whenReady().then(() => {
  electronApp.setAppUserModelId('com.pullframe.app')

  // Set app name for dock tooltip on macOS
  app.setName('Pullframe')

  // In dev, Electron.app has its own generic bundle icon. Use the app icns so
  // Dock sizing matches packaged builds more closely. Packaged builds use
  // CFBundleIconFile from the app bundle instead of a runtime PNG override.
  if (process.platform === 'darwin' && !app.isPackaged) {
    const iconPath = join(__dirname, '../../build/icon.icns')
    const icon = nativeImage.createFromPath(iconPath)
    if (!icon.isEmpty()) {
      app.dock.setIcon(icon)
    }
  }

  app.on('browser-window-created', (_, window) => {
    optimizer.watchWindowShortcuts(window)
  })

  registerIpcHandlers()
  configureAppUpdates()

  const mainWindow = createWindow()
  setupDownloadEvents(mainWindow)

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      const newWindow = createWindow()
      setupDownloadEvents(newWindow)
    }
  })
})

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit()
  }
})

// Kill all yt-dlp/ffmpeg child processes on quit
app.on('will-quit', () => {
  killAllDownloads()
})
