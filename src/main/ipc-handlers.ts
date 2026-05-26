import { ipcMain, dialog, shell, app, BrowserWindow } from 'electron'
import path from 'path'
import fs from 'fs'
import { writeFile, mkdir } from 'fs/promises'
import Store from 'electron-store'

// electron-store v11 type definitions are broken under noEmit; the runtime API is correct.
interface PersistedStore {
  get<T = unknown>(key: string, defaultValue?: T): T
  set(key: string, value: unknown): void
  delete(key: string): void
}

const persistedStore = new Store({
  name: 'pullframe-state',
  defaults: {
    settings: {
      downloadDir: '',
      subtitleFormat: 'original',
      cookieBrowser: 'none',
      preferredContainer: 'mp4',
      audioConvertFormat: 'original',
      videoTranscodeFormat: 'original',
      analyticsEnabled: true,
      organizeIntoFolders: true,
      downloadAllIncludes: {
        formats: true,
        subtitles: true,
        thumbnails: true,
        description: true,
        infoJson: false,
        comments: false
      }
    },
    tabUrls: [] as string[],
    downloadHistory: [] as unknown[]
  }
}) as unknown as PersistedStore

import {
  getBinaryStatus,
  updateYtdlp,
  updateFfmpeg,
  useBundledYtdlp,
  useBundledFfmpeg,
  getYtdlpPath,
  getFfmpegPath,
  ensureYtdlpFresh,
  downloadFfmpeg
} from './ytdlp/binary-manager'
import { generateChapterExport } from './ytdlp/chapter-export'
import { fetchVideoInfo, fetchPlaylistEntries, fetchUrlPreview, checkBrowserSignIn } from './ytdlp/format-fetcher'
import { startDownload, cancelDownload } from './ytdlp/downloader'
import type { CookieBrowser, DownloadRequest, DownloadProgress, DownloadComplete, DownloadError } from './ytdlp/types'
import { activateLicense, deactivateLicense, refreshLicenseState } from './license-manager'
import { checkForPullframeUpdates, downloadPullframeUpdate, installPullframeUpdate } from './app-updater'
import { submitFeedback, trackProductEvent } from './telemetry'

let mainWindow: BrowserWindow | null = null

function sendToRenderer(channel: string, data: DownloadProgress | DownloadComplete | DownloadError): void {
  if (mainWindow && !mainWindow.isDestroyed()) {
    mainWindow.webContents.send(channel, data)
  }
}

function getDownloadTelemetryCategory(type: DownloadRequest['type']): string {
  if (type === 'subtitle' || type === 'auto-subtitle') return 'subtitle'
  if (type === 'thumbnail') return 'thumbnail'
  if (type === 'description' || type === 'info-json' || type === 'comments') return 'extra'
  return 'format'
}

export function setupDownloadEvents(window: BrowserWindow): void {
  mainWindow = window

  window.on('closed', () => {
    mainWindow = null
  })

  ipcMain.on('window-minimize', () => mainWindow?.minimize())
  ipcMain.on('window-maximize', () => {
    if (mainWindow?.isMaximized()) mainWindow.unmaximize()
    else mainWindow?.maximize()
  })
  ipcMain.on('window-close', () => mainWindow?.close())
}

export function registerIpcHandlers(): void {
  ensureYtdlpFresh().catch(() => {})
  getFfmpegPath().catch(() => {})

  ipcMain.handle('fetch-video-info', async (_event, url: string, cookieBrowser?: CookieBrowser) => {
    try {
      const ytdlpPath = await getYtdlpPath()
      return await fetchVideoInfo(url, ytdlpPath, cookieBrowser)
    } catch (err) {
      trackProductEvent(persistedStore, {
        eventType: 'download.failed',
        properties: {
          result: 'failed',
          category: 'metadata',
          phase: 'video_info',
          source: 'app',
          failureReason: err instanceof Error ? err.message : String(err)
        }
      }).catch(() => {})
      throw err
    }
  })

  ipcMain.handle('fetch-playlist', async (_event, url: string, cookieBrowser?: CookieBrowser) => {
    try {
      const ytdlpPath = await getYtdlpPath()
      return await fetchPlaylistEntries(url, ytdlpPath, cookieBrowser)
    } catch (err) {
      trackProductEvent(persistedStore, {
        eventType: 'download.failed',
        properties: {
          result: 'failed',
          category: 'metadata',
          phase: 'playlist_info',
          source: 'app',
          failureReason: err instanceof Error ? err.message : String(err)
        }
      }).catch(() => {})
      throw err
    }
  })

  ipcMain.handle('fetch-url-preview', async (_event, url: string, cookieBrowser?: CookieBrowser) => {
    const ytdlpPath = await getYtdlpPath()
    return fetchUrlPreview(url, ytdlpPath, cookieBrowser)
  })

  ipcMain.handle('check-browser-sign-in', async (_event, browser: CookieBrowser) => {
    const ytdlpPath = await getYtdlpPath()
    return checkBrowserSignIn(browser, ytdlpPath)
  })

  ipcMain.handle('start-download', async (_event, request: DownloadRequest) => {
    const ytdlpPath = await getYtdlpPath()
    let ffmpegPath: string | undefined
    try {
      ffmpegPath = await getFfmpegPath()
    } catch {
      // ffmpeg not available - merging won't work but basic downloads will
    }

    startDownload(request, ytdlpPath, (progress: DownloadProgress) => {
      sendToRenderer('download-progress', progress)
    }, ffmpegPath)
      .then((result: DownloadComplete) => {
        sendToRenderer('download-complete', result)
      })
      .catch((err: Error) => {
        const error: DownloadError = { id: request.id, error: err.message }
        sendToRenderer('download-error', error)
      })

    trackProductEvent(persistedStore, {
      eventType: 'download.started',
      properties: {
        category: getDownloadTelemetryCategory(request.type),
        type: request.type,
        source: 'app'
      }
    }).catch(() => {})

    return request.id
  })

  ipcMain.handle('cancel-download', async (_event, id: string) => {
    cancelDownload(id)
  })

  ipcMain.handle('select-directory', async () => {
    const result = await dialog.showOpenDialog({
      properties: ['openDirectory', 'createDirectory']
    })

    if (result.canceled || result.filePaths.length === 0) {
      return null
    }

    return result.filePaths[0]
  })

  ipcMain.handle('get-binary-status', async (_event, includeLatest?: boolean) => {
    return getBinaryStatus(includeLatest === true)
  })

  ipcMain.handle('get-app-version', () => {
    return app.getVersion()
  })

  ipcMain.handle('get-license-state', async () => {
    return refreshLicenseState(persistedStore)
  })

  ipcMain.handle('activate-license', async (_event, licenseKey: string) => {
    trackProductEvent(persistedStore, {
      eventType: 'license.activation.started',
      properties: { source: 'app' }
    }).catch(() => {})
    try {
      const state = await activateLicense(persistedStore, licenseKey)
      trackProductEvent(persistedStore, {
        eventType: 'license.activation.succeeded',
        properties: { result: 'succeeded', source: 'app' }
      }).catch(() => {})
      checkForPullframeUpdates().catch(() => {})
      return state
    } catch (err) {
      trackProductEvent(persistedStore, {
        eventType: 'license.activation.failed',
        properties: {
          result: 'failed',
          source: 'app',
          failureReason: err instanceof Error ? err.message : String(err)
        }
      }).catch(() => {})
      throw err
    }
  })

  ipcMain.handle('deactivate-license', async () => {
    const state = await deactivateLicense(persistedStore)
    trackProductEvent(persistedStore, {
      eventType: 'license.deactivation.succeeded',
      properties: { result: 'succeeded', source: 'app' }
    }).catch(() => {})
    return state
  })

  ipcMain.handle('check-for-updates', async () => {
    trackProductEvent(persistedStore, {
      eventType: 'update.check.started',
      properties: { source: 'updater' }
    }).catch(() => {})
    try {
      const result = await checkForPullframeUpdates()
      trackProductEvent(persistedStore, {
        eventType: 'update.check.succeeded',
        properties: {
          result: 'succeeded',
          source: 'updater',
          updateVersion: result.version
        }
      }).catch(() => {})
      return result
    } catch (err) {
      trackProductEvent(persistedStore, {
        eventType: 'update.check.failed',
        properties: {
          result: 'failed',
          source: 'updater',
          failureReason: err instanceof Error ? err.message : String(err)
        }
      }).catch(() => {})
      throw err
    }
  })

  ipcMain.handle('download-app-update', async () => {
    trackProductEvent(persistedStore, {
      eventType: 'update.download.started',
      properties: { source: 'updater' }
    }).catch(() => {})
    try {
      await downloadPullframeUpdate()
      trackProductEvent(persistedStore, {
        eventType: 'update.download.succeeded',
        properties: { result: 'succeeded', source: 'updater' }
      }).catch(() => {})
    } catch (err) {
      trackProductEvent(persistedStore, {
        eventType: 'update.download.failed',
        properties: {
          result: 'failed',
          source: 'updater',
          failureReason: err instanceof Error ? err.message : String(err)
        }
      }).catch(() => {})
      throw err
    }
  })

  ipcMain.handle('install-app-update', () => {
    installPullframeUpdate()
  })

  ipcMain.handle('update-ytdlp', async () => {
    return updateYtdlp()
  })

  ipcMain.handle('download-ffmpeg', async () => {
    return downloadFfmpeg()
  })

  ipcMain.handle('update-ffmpeg', async () => {
    return updateFfmpeg()
  })

  ipcMain.handle('use-bundled-ytdlp', async () => {
    return useBundledYtdlp()
  })

  ipcMain.handle('use-bundled-ffmpeg', async () => {
    return useBundledFfmpeg()
  })

  ipcMain.handle('open-file', async (_event, filePath: string) => {
    const resolved = path.resolve(filePath)
    const downloadsDir = app.getPath('downloads')
    const homeDir = app.getPath('home')
    if (!resolved.startsWith(downloadsDir) && !resolved.startsWith(homeDir)) {
      throw new Error('Path is outside allowed directories')
    }
    shell.showItemInFolder(resolved)
  })

  ipcMain.handle('reveal-in-folder', async (_event, filePath: string) => {
    shell.showItemInFolder(path.resolve(filePath))
  })

  ipcMain.handle('file-exists', async (_event, filePath: string) => {
    return fs.existsSync(path.resolve(filePath))
  })

  ipcMain.handle('open-external', async (_event, url: string) => {
    const parsed = new URL(url)
    if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
      throw new Error('Only HTTP(S) URLs are allowed')
    }
    await shell.openExternal(url)
  })

  ipcMain.handle('open-full-disk-access-settings', async () => {
    await shell.openExternal('x-apple.systempreferences:com.apple.preference.security?Privacy_AllFiles')
  })

  ipcMain.handle('get-default-download-dir', () => {
    return app.getPath('downloads')
  })

  ipcMain.handle('load-persisted-state', () => {
    return {
      settings: persistedStore.get('settings'),
      tabUrls: persistedStore.get('tabUrls')
    }
  })

  ipcMain.handle('save-persisted-state', (_event, state: { settings: Record<string, unknown>; tabUrls: string[] }) => {
    persistedStore.set('settings', state.settings)
    persistedStore.set('tabUrls', state.tabUrls)
  })

  ipcMain.handle('track-product-event', async (_event, input: {
    eventType: Parameters<typeof trackProductEvent>[1]['eventType']
    properties?: Record<string, unknown>
  }) => {
    return trackProductEvent(persistedStore, input)
  })

  ipcMain.handle('submit-feedback', async (_event, input: {
    category: 'general' | 'bug' | 'feature' | 'license' | 'download' | 'update'
    message: string
    email?: string | null
    diagnostics?: Record<string, unknown>
  }) => {
    return submitFeedback(persistedStore, input)
  })

  ipcMain.handle('load-download-history', () => {
    return persistedStore.get('downloadHistory', [])
  })

  ipcMain.handle('save-download-history', (_event, history: unknown[]) => {
    const capped = history.slice(-500)
    persistedStore.set('downloadHistory', capped)
  })

  ipcMain.handle('download-thumbnail', async (_event, opts: {
    url: string
    outputDir: string
    filename: string
  }) => {
    const https = await import('https')
    const http = await import('http')
    const { writeFile: fsWriteFile } = await import('fs/promises')

    await mkdir(opts.outputDir, { recursive: true })
    const destPath = path.join(opts.outputDir, opts.filename)

    const data = await new Promise<Buffer>((resolve, reject) => {
      const proto = opts.url.startsWith('https') ? https : http
      proto.get(opts.url, (res: import('http').IncomingMessage) => {
        if (res.statusCode && res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
          proto.get(res.headers.location!, (res2: import('http').IncomingMessage) => {
            const chunks: Buffer[] = []
            res2.on('data', (c: Buffer) => chunks.push(c))
            res2.on('end', () => resolve(Buffer.concat(chunks)))
            res2.on('error', reject)
          }).on('error', reject)
          return
        }
        const chunks: Buffer[] = []
        res.on('data', (c: Buffer) => chunks.push(c))
        res.on('end', () => resolve(Buffer.concat(chunks)))
        res.on('error', reject)
      }).on('error', reject)
    })

    await fsWriteFile(destPath, data)
    return { filePath: destPath, fileSize: data.length }
  })

  ipcMain.handle(
    'export-chapters',
    async (
      _event,
      opts: {
        chapters: { title: string; startTime: number; endTime: number }[]
        title: string
        format: 'premiere-csv' | 'edl' | 'csv' | 'txt'
        outputDir: string
        fps?: number
      }
    ) => {
      await mkdir(opts.outputDir, { recursive: true })

      const { content, extension } = generateChapterExport(
        opts.chapters,
        opts.title,
        opts.format,
        opts.fps
      )

      const safeTitle = opts.title.replace(/[<>:"/\\|?*]/g, '_').slice(0, 200)
      const filename = `${safeTitle}_chapters.${extension}`
      const filePath = path.join(opts.outputDir, filename)

      await writeFile(filePath, content, 'utf-8')

      return { filePath, fileSize: Buffer.byteLength(content, 'utf-8') }
    }
  )
}
