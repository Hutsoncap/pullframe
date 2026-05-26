import { app, BrowserWindow } from 'electron'
import { autoUpdater } from 'electron-updater'
import { is } from '@electron-toolkit/utils'
import Store from 'electron-store'

interface UpdateStore {
  get<T = unknown>(key: string, defaultValue?: T): T
}

const updateStore = new Store({ name: 'pullframe-state' }) as unknown as UpdateStore

export const pullframeUpdateFeedBaseUrl = process.env.PULLFRAME_UPDATES_BASE_URL ?? 'https://nexus.htsn.io/repository/raw-hosted/pullframe'
let configured = false

export function getPullframeUpdateChannel(version: string): 'stable' | 'beta' {
  return version.includes('-') ? 'beta' : 'stable'
}

export function getPullframeUpdateFeedUrl(version: string): string {
  return `${pullframeUpdateFeedBaseUrl}/${getPullframeUpdateChannel(version)}/`
}

function sendUpdateStatus(status: {
  state: 'checking' | 'available' | 'not-available' | 'downloading' | 'downloaded' | 'error'
  version?: string
  releaseNotes?: string
  message?: string
  percent?: number
  bytesPerSecond?: number
  transferred?: number
  total?: number
}): void {
  for (const window of BrowserWindow.getAllWindows()) {
    if (!window.isDestroyed()) {
      window.webContents.send('app-update-status', status)
    }
  }
}

export function refreshAppUpdateAuth(): void {
  const entitlementToken = updateStore.get<string | null>('license.entitlementToken', null)
  autoUpdater.requestHeaders = entitlementToken
    ? { Authorization: `Bearer ${entitlementToken}` }
    : {}
}

export async function checkForPullframeUpdates(): Promise<{ status: 'available' | 'not-available'; version?: string }> {
  if (is.dev || !app.isPackaged) {
    return { status: 'not-available', version: app.getVersion() }
  }

  refreshAppUpdateAuth()
  sendUpdateStatus({ state: 'checking' })
  const result = await autoUpdater.checkForUpdates()
  const updateInfo = result?.updateInfo

  if (updateInfo && updateInfo.version !== app.getVersion()) {
    return { status: 'available', version: updateInfo.version }
  }

  return { status: 'not-available', version: updateInfo?.version ?? app.getVersion() }
}

function formatReleaseNotes(releaseNotes: unknown): string | undefined {
  if (typeof releaseNotes === 'string') return releaseNotes
  if (Array.isArray(releaseNotes)) {
    return releaseNotes
      .map((item) => {
        if (typeof item === 'string') return item
        if (item && typeof item === 'object' && 'note' in item) {
          return String((item as { note?: unknown }).note ?? '')
        }
        return ''
      })
      .filter(Boolean)
      .join('\n\n')
  }
  return undefined
}

export async function downloadPullframeUpdate(): Promise<void> {
  if (is.dev || !app.isPackaged) {
    throw new Error('Updates are only available in packaged builds')
  }

  refreshAppUpdateAuth()
  sendUpdateStatus({ state: 'downloading', percent: 0 })
  await autoUpdater.downloadUpdate()
}

export function installPullframeUpdate(): void {
  if (is.dev || !app.isPackaged) {
    throw new Error('Updates are only available in packaged builds')
  }

  autoUpdater.quitAndInstall(false, true)
}

export function configureAppUpdates(): void {
  if (is.dev || !app.isPackaged) {
    return
  }

  if (configured) {
    refreshAppUpdateAuth()
    return
  }

  configured = true
  autoUpdater.autoDownload = false
  refreshAppUpdateAuth()
  autoUpdater.setFeedURL({
    provider: 'generic',
    url: getPullframeUpdateFeedUrl(app.getVersion())
  })

  autoUpdater.on('error', (error) => {
    console.error('App update check failed:', error)
    sendUpdateStatus({ state: 'error', message: error.message })
  })

  autoUpdater.on('update-available', (info) => {
    console.info('App update available:', info.version)
    sendUpdateStatus({ state: 'available', version: info.version, releaseNotes: formatReleaseNotes(info.releaseNotes) })
  })

  autoUpdater.on('update-not-available', (info) => {
    console.info('App is up to date:', info.version)
    sendUpdateStatus({ state: 'not-available', version: info.version })
  })

  autoUpdater.on('download-progress', (progress) => {
    sendUpdateStatus({
      state: 'downloading',
      percent: Math.round(progress.percent * 10) / 10,
      bytesPerSecond: progress.bytesPerSecond,
      transferred: progress.transferred,
      total: progress.total
    })
  })

  autoUpdater.on('update-downloaded', (info) => {
    sendUpdateStatus({ state: 'downloaded', version: info.version, releaseNotes: formatReleaseNotes(info.releaseNotes) })
  })

  checkForPullframeUpdates().catch((error: unknown) => {
    console.error('App update check failed:', error)
  })
}
