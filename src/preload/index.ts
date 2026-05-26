import { contextBridge, ipcRenderer } from 'electron'
import { electronAPI } from '@electron-toolkit/preload'

type AppTelemetryEventName =
  | 'app.launched'
  | 'license.activation.started'
  | 'license.activation.succeeded'
  | 'license.activation.failed'
  | 'license.deactivation.succeeded'
  | 'license.recovery.started'
  | 'license.recovery.succeeded'
  | 'license.recovery.failed'
  | 'download.started'
  | 'download.succeeded'
  | 'download.failed'
  | 'update.check.started'
  | 'update.check.succeeded'
  | 'update.check.failed'
  | 'update.download.started'
  | 'update.download.succeeded'
  | 'update.download.failed'
  | 'feedback.opened'
  | 'feedback.submitted'

type AppShortcutCommand =
  | 'open-settings'
  | 'new-tab'
  | 'reopen-closed-tab'
  | 'close-tab'
  | 'reload-tab'
  | 'focus-url'
  | `switch-tab:${number}`

type CookieBrowser = 'none' | 'chrome' | 'firefox' | 'safari' | 'edge' | 'brave' | 'zen' | 'helium'

const api = {
  fetchVideoInfo: (url: string, cookieBrowser?: CookieBrowser) =>
    ipcRenderer.invoke('fetch-video-info', url, cookieBrowser),

  fetchPlaylist: (url: string, cookieBrowser?: CookieBrowser) =>
    ipcRenderer.invoke('fetch-playlist', url, cookieBrowser),

  fetchUrlPreview: (url: string, cookieBrowser?: CookieBrowser) =>
    ipcRenderer.invoke('fetch-url-preview', url, cookieBrowser),

  checkBrowserSignIn: (browser: CookieBrowser) =>
    ipcRenderer.invoke('check-browser-sign-in', browser),

  startDownload: (request: unknown) => ipcRenderer.invoke('start-download', request),

  cancelDownload: (id: string) => ipcRenderer.invoke('cancel-download', id),

  selectDirectory: () => ipcRenderer.invoke('select-directory'),

  getBinaryStatus: (includeLatest?: boolean) => ipcRenderer.invoke('get-binary-status', includeLatest),

  getAppVersion: () => ipcRenderer.invoke('get-app-version') as Promise<string>,

  getLicenseState: () => ipcRenderer.invoke('get-license-state'),

  activateLicense: (licenseKey: string) => ipcRenderer.invoke('activate-license', licenseKey),

  deactivateLicense: () => ipcRenderer.invoke('deactivate-license'),

  checkForUpdates: () => ipcRenderer.invoke('check-for-updates'),

  downloadAppUpdate: () => ipcRenderer.invoke('download-app-update'),

  installAppUpdate: () => ipcRenderer.invoke('install-app-update'),

  updateYtdlp: () => ipcRenderer.invoke('update-ytdlp'),

  downloadFfmpeg: () => ipcRenderer.invoke('download-ffmpeg'),

  updateFfmpeg: () => ipcRenderer.invoke('update-ffmpeg'),

  useBundledYtdlp: () => ipcRenderer.invoke('use-bundled-ytdlp'),

  useBundledFfmpeg: () => ipcRenderer.invoke('use-bundled-ffmpeg'),

  openFile: (path: string) => ipcRenderer.invoke('open-file', path),

  revealInFolder: (path: string) => ipcRenderer.invoke('reveal-in-folder', path),

  fileExists: (path: string): Promise<boolean> => ipcRenderer.invoke('file-exists', path),

  openExternal: (url: string) => ipcRenderer.invoke('open-external', url),

  openFullDiskAccessSettings: () => ipcRenderer.invoke('open-full-disk-access-settings'),

  getDefaultDownloadDir: () => ipcRenderer.invoke('get-default-download-dir'),

  loadPersistedState: () => ipcRenderer.invoke('load-persisted-state'),

  savePersistedState: (state: { settings: Record<string, unknown>; tabUrls: string[] }) =>
    ipcRenderer.invoke('save-persisted-state', state),

  trackEvent: (input: { eventType: AppTelemetryEventName; properties?: Record<string, unknown> }) =>
    ipcRenderer.invoke('track-product-event', input),

  submitFeedback: (input: {
    category: 'general' | 'bug' | 'feature' | 'license' | 'download' | 'update'
    message: string
    email?: string | null
    diagnostics?: Record<string, unknown>
  }) => ipcRenderer.invoke('submit-feedback', input),

  exportChapters: (opts: {
    chapters: { title: string; startTime: number; endTime: number }[]
    title: string
    format: 'premiere-csv' | 'edl' | 'csv' | 'txt'
    outputDir: string
    fps?: number
  }) => ipcRenderer.invoke('export-chapters', opts),

  loadDownloadHistory: () => ipcRenderer.invoke('load-download-history'),

  saveDownloadHistory: (history: unknown[]) =>
    ipcRenderer.invoke('save-download-history', history),

  downloadThumbnail: (opts: { url: string; outputDir: string; filename: string }) =>
    ipcRenderer.invoke('download-thumbnail', opts),

  onDownloadProgress: (callback: (progress: unknown) => void): (() => void) => {
    const listener = (_event: Electron.IpcRendererEvent, progress: unknown): void => {
      callback(progress)
    }
    ipcRenderer.on('download-progress', listener)
    return () => {
      ipcRenderer.removeListener('download-progress', listener)
    }
  },

  onDownloadComplete: (callback: (result: unknown) => void): (() => void) => {
    const listener = (_event: Electron.IpcRendererEvent, result: unknown): void => {
      callback(result)
    }
    ipcRenderer.on('download-complete', listener)
    return () => {
      ipcRenderer.removeListener('download-complete', listener)
    }
  },

  onDownloadError: (callback: (error: unknown) => void): (() => void) => {
    const listener = (_event: Electron.IpcRendererEvent, error: unknown): void => {
      callback(error)
    }
    ipcRenderer.on('download-error', listener)
    return () => {
      ipcRenderer.removeListener('download-error', listener)
    }
  },

  onAppUpdateStatus: (callback: (status: unknown) => void): (() => void) => {
    const listener = (_event: Electron.IpcRendererEvent, status: unknown): void => {
      callback(status)
    }
    ipcRenderer.on('app-update-status', listener)
    return () => {
      ipcRenderer.removeListener('app-update-status', listener)
    }
  },

  onAppShortcut: (callback: (command: AppShortcutCommand) => void): (() => void) => {
    const listener = (_event: Electron.IpcRendererEvent, command: AppShortcutCommand): void => {
      callback(command)
    }
    ipcRenderer.on('app-shortcut', listener)
    return () => {
      ipcRenderer.removeListener('app-shortcut', listener)
    }
  },

  platform: process.platform
}

if (process.contextIsolated) {
  try {
    contextBridge.exposeInMainWorld('electron', electronAPI)
    contextBridge.exposeInMainWorld('api', api)
  } catch (err) {
    console.error('Failed to expose APIs via context bridge:', err)
  }
} else {
  // @ts-expect-error fallback for non-context-isolated environments
  window.electron = electronAPI
  // @ts-expect-error fallback for non-context-isolated environments
  window.api = api
}
